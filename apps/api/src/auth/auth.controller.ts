import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Next,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as passport from 'passport';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { GoogleProfile } from './strategies/google.strategy';
import { AppleProfile } from './strategies/apple.strategy';

function encodeState(clientId: string): string {
  return Buffer.from(JSON.stringify({ clientId })).toString('base64url');
}

function decodeState(state: string): { clientId: string } {
  return JSON.parse(Buffer.from(state, 'base64url').toString());
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie('access_token', accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
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
    passport.authenticate('google', {
      scope: ['email', 'profile'],
      state: encodeState(clientId),
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
    passport.authenticate('google', { session: false }, async (err: any, profile: GoogleProfile) => {
      if (err || !profile) {
        return res.redirect(
          `${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=oauth`,
        );
      }
      try {
        const { clientId } = decodeState(state ?? encodeState('app'));
        const user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId,
          name: profile.name,
        });
        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/${clientId}/dashboard`);
      } catch {
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=server`);
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
    passport.authenticate('apple', {
      state: encodeState(clientId),
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
    passport.authenticate('apple', { session: false }, async (err: any, profile: AppleProfile) => {
      if (err || !profile) {
        return res.redirect(
          `${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=oauth`,
        );
      }
      try {
        const state = (req.body as any)?.state ?? '';
        const { clientId } = decodeState(state || encodeState('app'));

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
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/${clientId}/dashboard`);
      } catch {
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=server`);
      }
    })(req, res, next);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token: string | undefined = (req.cookies as any)?.refresh_token;
    if (!token) throw new UnauthorizedException();

    let sub = (req as any).user?.sub;
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
