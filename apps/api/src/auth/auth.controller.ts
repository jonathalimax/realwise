import {
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

@Controller('auth')
export class AuthController {
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
    @Query('clientId') clientId: string = 'app',
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
    passport.authenticate('google', { session: false }, async (err: unknown, profile: GoogleProfile) => {
      if (err || !profile) {
        return res.redirect(`${frontend}/login?error=oauth`);
      }
      try {
        const cookieNonce = (req.cookies as Record<string, string>)?.oauth_state;
        const { clientId } = verifyState(state, cookieNonce);
        res.clearCookie('oauth_state', { path: '/' });
        const user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId,
          name: profile.name,
        });
        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        res.redirect(`${frontend}/${clientId}/dashboard`);
      } catch {
        res.redirect(`${frontend}/login?error=server`);
      }
    })(req, res, next);
  }

  // ─── Apple ───────────────────────────────────────────────────────────────────

  @Public()
  @Get('apple')
  appleAuth(
    @Query('clientId') clientId: string = 'app',
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
    passport.authenticate('apple', { session: false }, async (err: unknown, profile: AppleProfile) => {
      if (err || !profile) {
        return res.redirect(`${frontend}/login?error=oauth`);
      }
      try {
        const state = (req.body as Record<string, string>)?.state ?? '';
        const cookieNonce = (req.cookies as Record<string, string>)?.oauth_state;
        const { clientId } = verifyState(state, cookieNonce);
        res.clearCookie('oauth_state', { path: '/' });

        if (!profile.email) {
          // Subsequent Apple logins — no email; look up by appleId
          throw new Error('Apple subsequent login without email not yet supported — look up by appleId');
        }

        const user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId,
          name: profile.name,
          appleId: profile.appleId,
        });

        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        res.redirect(`${frontend}/${clientId}/dashboard`);
      } catch {
        res.redirect(`${frontend}/login?error=server`);
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
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
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
