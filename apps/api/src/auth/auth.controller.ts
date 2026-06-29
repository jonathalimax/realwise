import {
  Logger,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Next,
  Query,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import passport from 'passport';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { GoogleProfile } from './strategies/google.strategy';
import { AppleProfile } from './strategies/apple.strategy';

function hmacSign(data: string): string {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function buildState(clientId: string, nonce: string): string {
  const payload = JSON.stringify({ clientId, nonce });
  const sig = hmacSign(payload);
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

export function resolveClientIdForLogin(clientId: string | undefined, email: string | null | undefined): string {
  if (clientId && clientId.trim()) {
    return clientId.trim();
  }

  const localPart = email?.split('@')[0]?.trim();
  if (localPart) {
    return localPart;
  }

  throw new BadRequestException('Unable to resolve clientId for login');
}

function verifyState(state: string, cookieNonce: string): { clientId: string } {
  let parsed: { payload: string; sig: string };
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    throw new BadRequestException('Invalid state');
  }
  const expected = hmacSign(parsed.payload);
  if (!crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expected))) {
    throw new BadRequestException('State signature invalid');
  }
  const { clientId, nonce } = JSON.parse(parsed.payload);
  if (!nonce || nonce !== cookieNonce) {
    throw new BadRequestException('State nonce mismatch');
  }
  return { clientId };
}

function extractOauthReason(error: unknown, info?: unknown): string {
  const candidates = [
    error instanceof Error ? error.message : null,
    typeof error === 'string' ? error : null,
    info instanceof Error ? info.message : null,
    typeof info === 'string' ? info : null,
    typeof info === 'object' && info && 'message' in info && typeof info.message === 'string' ? info.message : null,
    typeof info === 'object' && info && 'code' in info && typeof info.code === 'string' ? info.code : null,
    typeof info === 'object' && info && 'error' in info && typeof info.error === 'string' ? info.error : null,
  ];

  const reason = candidates.find((value) => value && value.trim());
  if (!reason) {
    return '';
  }

  return reason.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function buildOauthFailureRedirect(frontend: string, provider: 'google' | 'apple', error: unknown, info?: unknown): string {
  const params = new URLSearchParams({ error: 'oauth', provider });
  const reason = extractOauthReason(error, info);
  if (reason) {
    params.set('reason', reason);
  }
  return `${frontend}/login?${params.toString()}`;
}

function safeRedirect(res: Response, location: string): void {
  if (res.headersSent) {
    return;
  }
  res.redirect(location);
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  private get isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    const base = { httpOnly: true, secure: this.isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie('access_token', accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  private setNonceCookie(res: Response, nonce: string): void {
    res.cookie('oauth_state', nonce, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000, // 10 minutes — enough for OAuth round trip
    });
  }

  // ─── Google ──────────────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  googleAuth(
    @Query('clientId') clientId = '',
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    const nonce = crypto.randomBytes(32).toString('base64url');
    this.setNonceCookie(res, nonce);
    passport.authenticate('google', {
      scope: ['email', 'profile'],
      state: buildState(clientId, nonce),
      session: false,
    })(req, res, next);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    const frontend = process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173';
    passport.authenticate('google', { session: false }, async (err: unknown, profile: GoogleProfile, info?: unknown) => {
      if (err || !profile) {
        this.logger.warn(`Google OAuth failed: ${extractOauthReason(err, info) || 'unknown_oauth_error'}`);
        return safeRedirect(res, buildOauthFailureRedirect(frontend, 'google', err, info));
      }
      try {
        const cookieNonce = (req.cookies as Record<string, string>)?.oauth_state;
        const { clientId } = verifyState(state, cookieNonce);
        const resolvedClientId = resolveClientIdForLogin(clientId, profile.email);
        res.clearCookie('oauth_state', { path: '/' });
        const user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId: resolvedClientId,
          name: profile.name,
        });
        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        return safeRedirect(res, `${frontend}/${resolvedClientId}/dashboard`);
      } catch {
        return safeRedirect(res, `${frontend}/login?error=server`);
      }
    })(req, res, next);
  }

  // ─── Apple ───────────────────────────────────────────────────────────────────

  @Public()
  @Get('apple')
  appleAuth(
    @Query('clientId') clientId = '',
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    const nonce = crypto.randomBytes(32).toString('base64url');
    this.setNonceCookie(res, nonce);
    passport.authenticate('apple', {
      state: buildState(clientId, nonce),
      session: false,
    })(req, res, next);
  }

  @Public()
  @Post('apple/callback')
  async appleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    const frontend = process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173';
    passport.authenticate('apple', { session: false }, async (err: unknown, profile: AppleProfile, info?: unknown) => {
      if (err || !profile) {
        this.logger.warn(`Apple OAuth failed: ${extractOauthReason(err, info) || 'unknown_oauth_error'}`);
        return safeRedirect(res, buildOauthFailureRedirect(frontend, 'apple', err, info));
      }
      try {
        const state = (req.body as Record<string, string>)?.state ?? '';
        const cookieNonce = (req.cookies as Record<string, string>)?.oauth_state;
        const { clientId } = verifyState(state, cookieNonce);
        const resolvedClientId = resolveClientIdForLogin(clientId, profile.email);
        res.clearCookie('oauth_state', { path: '/' });

        if (!profile.email) {
          // Subsequent Apple logins — no email; look up by appleId
          throw new Error('Apple subsequent login without email not yet supported — look up by appleId');
        }

        const user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId: resolvedClientId,
          name: profile.name,
          appleId: profile.appleId,
        });

        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        return safeRedirect(res, `${frontend}/${resolvedClientId}/dashboard`);
      } catch {
        return safeRedirect(res, `${frontend}/login?error=server`);
      }
    })(req, res, next);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token: string | undefined = (req.cookies as Record<string, string>)?.refresh_token;
    if (!token) throw new UnauthorizedException();

    const reqWithUser = req as Request & { user?: JwtPayload };
    let sub = reqWithUser.user?.sub;
    if (!sub) {
      const parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedException();
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      sub = payload.sub;
    }

    if (!sub) throw new UnauthorizedException();

    const user = await this.authService.validateRefreshToken(sub, token);
    if (!user) throw new UnauthorizedException();

    const { accessToken, refreshToken } = await this.authService.issueTokens(user);
    this.setTokenCookies(res, accessToken, refreshToken);
    res.json({ ok: true });
  }

  // ─── Me ──────────────────────────────────────────────────────────────────────

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const currentUser = await this.authService.findById(user.sub);
    return {
      sub: user.sub,
      uid: user.sub,
      clientId: user.clientId,
      role: user.role,
      email: currentUser?.email ?? null,
      name: currentUser?.name ?? null,
      displayName: currentUser?.name ?? null,
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload, @Res() res: Response): Promise<void> {
    await this.authService.logout(user.sub);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ ok: true });
  }
}
