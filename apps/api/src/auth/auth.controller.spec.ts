import { Test, TestingModule } from '@nestjs/testing';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import passport from 'passport';
import * as crypto from 'crypto';
import { AuthController, resolveClientIdForLogin } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

jest.mock('passport', () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn(),
  },
}));

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: 'jonathalimax',
  email: 'test@example.com',
  name: 'Test',
  profileImageUrl: 'https://avatars.example.com/test-user.png',
  role: 'user' as const,
  firebaseUid: null,
  appleId: null,
  refreshTokenHash: null,
  premiumAccessStartedAt: new Date('2026-07-02T12:00:00.000Z'),
  premiumAccessEndsAt: new Date('2026-08-16T12:00:00.000Z'),
  premiumPurchasedAt: null,
  premiumStatus: 'trialing' as const,
  premiumPaymentProvider: null,
  premiumProviderPaymentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAuthService = {
  findOrCreateUser: jest.fn().mockResolvedValue(fakeUser),
  issueTokens: jest.fn().mockResolvedValue({
    accessToken: 'access-jwt',
    refreshToken: 'refresh-jwt',
  }),
  findById: jest.fn(),
  validateRefreshToken: jest.fn(),
  logout: jest.fn(),
};

type MockRes = {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
  json: jest.Mock;
  headersSent: boolean;
};

const mockRes = (): MockRes => {
  const res = {} as MockRes;
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockImplementation(() => {
    res.headersSent = true;
    return res;
  });
  res.json = jest.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
};

function buildSignedState(clientId: string, nonce: string) {
  const payload = JSON.stringify({ clientId, nonce });
  const sig = crypto.createHmac('sha256', 'dev-secret').update(payload).digest('base64url');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no refresh cookie', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockRes();
      await expect(controller.refresh(req, res as unknown as Response)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      mockAuthService.validateRefreshToken.mockResolvedValue(null);
      const req = {
        cookies: { refresh_token: 'bad-token' },
        user: { sub: 'uuid', clientId: 'test', role: 'user' } as JwtPayload,
      } as unknown as Request;
      const res = mockRes();
      await expect(controller.refresh(req, res as unknown as Response)).rejects.toThrow(UnauthorizedException);
    });

    it('sets cookies and returns ok on valid refresh', async () => {
      mockAuthService.validateRefreshToken.mockResolvedValue(fakeUser);
      const req = {
        cookies: { refresh_token: 'valid-token' },
        user: { sub: fakeUser.id } as JwtPayload,
      } as unknown as Request;
      const res = mockRes();
      await controller.refresh(req, res as unknown as Response);
      expect(mockAuthService.issueTokens).toHaveBeenCalledWith(fakeUser);
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('googleCallback', () => {
    it('short-circuits to the frontend error redirect when Google returns an oauth error in the callback query', async () => {
      const req = {
        cookies: {},
        query: {
          error: 'access_denied',
          error_description: 'The user denied your request',
        },
      } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();

      await controller.googleCallback('state-token', req, res as unknown as Response, next);

      expect(passport.authenticate).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=oauth&provider=google&reason=The+user+denied+your+request',
      );
    });

    it('redirects with the oauth reason when Google authentication fails', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();
      const authError = new Error('redirect_uri_mismatch');

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: unknown, callback: (err: unknown, profile?: unknown) => void) =>
          () => callback(authError, undefined),
      );

      await controller.googleCallback('state-token', req, res as unknown as Response, next);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=oauth&provider=google&reason=redirect_uri_mismatch',
      );
    });

    it('does not attempt a second redirect after headers are already sent', async () => {
      const req = { cookies: { oauth_state: 'nonce-1' } } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();
      const state = buildSignedState(fakeUser.clientId, 'nonce-1');

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: unknown, callback: (err: unknown, profile?: unknown) => void) =>
          () => callback(null, { email: 'user@example.com', name: 'User', googleId: 'g-1' }),
      );

      mockAuthService.findOrCreateUser.mockResolvedValue(fakeUser);
      mockAuthService.issueTokens.mockImplementation(async () => {
        res.redirect('http://localhost:5173/jonathalimax/dashboard');
        throw new Error('late failure after redirect');
      });

      await expect(controller.googleCallback(state, req, res as unknown as Response, next)).resolves.toBeUndefined();
      expect(res.redirect).toHaveBeenCalledTimes(1);
      expect(res.redirect).not.toHaveBeenCalledWith('http://localhost:5173/login?error=server');
    });

    it('logs the internal callback error before redirecting with server error', async () => {
      const req = { cookies: { oauth_state: 'nonce-1' } } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();
      const state = buildSignedState(fakeUser.clientId, 'nonce-1');
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: unknown, callback: (err: unknown, profile?: unknown) => void) =>
          () => callback(null, { email: 'user@example.com', name: 'User', googleId: 'g-1' }),
      );

      mockAuthService.findOrCreateUser.mockRejectedValue(new Error('db write failed'));

      await controller.googleCallback(state, req, res as unknown as Response, next);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Google OAuth callback internal failure: Error: db write failed'),
      );
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/login?error=server');

      errorSpy.mockRestore();
    });

    it('extracts nested oauth error details from the token exchange failure', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();
      const authError = {
        message: 'Failed to obtain access token',
        oauthError: {
          statusCode: 401,
          data: JSON.stringify({
            error: 'invalid_client',
            error_description: 'The OAuth client was not found.',
          }),
        },
      };

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: unknown, callback: (err: unknown, profile?: unknown) => void) =>
          () => callback(authError, undefined),
      );

      await controller.googleCallback('state-token', req, res as unknown as Response, next);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=oauth&provider=google&reason=The+OAuth+client+was+not+found.',
      );
    });

    it('uses callback query params when Google returns an oauth error without passport details', async () => {
      const req = {
        cookies: {},
        query: {
          error: 'access_denied',
          error_description: 'The user denied your request',
        },
      } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: unknown, callback: (err: unknown, profile?: unknown, info?: unknown) => void) =>
          () => callback(null, undefined, undefined),
      );

      await controller.googleCallback('state-token', req, res as unknown as Response, next);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=oauth&provider=google&reason=The+user+denied+your+request',
      );
    });

    it('logs sanitized oauth debug context when passport returns no profile and no reason', async () => {
      const req = {
        cookies: {},
        query: {
          code: 'secret-auth-code',
          state: 'signed-state-token',
        },
      } as unknown as Request;
      const res = mockRes();
      const next = jest.fn();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: unknown, callback: (err: unknown, profile?: unknown, info?: unknown) => void) =>
          () => callback(null, undefined, undefined),
      );

      await controller.googleCallback('signed-state-token', req, res as unknown as Response, next);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Google OAuth failed: unknown_oauth_error'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('queryKeys=code,state'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('secret-auth-code'),
      );

      warnSpy.mockRestore();
    });
  });

  describe('me', () => {
    it('returns the enriched current user payload', async () => {
      const payload = { sub: fakeUser.id, clientId: 'jonathalimax', role: 'user' as const };
      mockAuthService.findById.mockResolvedValue(fakeUser);
      const result = await controller.me(payload);
      expect(result).toEqual({
        sub: fakeUser.id,
        uid: fakeUser.id,
        clientId: 'jonathalimax',
        role: 'user',
        email: fakeUser.email,
        name: fakeUser.name,
        displayName: fakeUser.name,
        profileImageUrl: fakeUser.profileImageUrl,
        premiumAccessStartedAt: fakeUser.premiumAccessStartedAt,
        premiumAccessEndsAt: fakeUser.premiumAccessEndsAt,
        premiumPurchasedAt: fakeUser.premiumPurchasedAt,
        premiumStatus: fakeUser.premiumStatus,
        premiumPaymentProvider: fakeUser.premiumPaymentProvider,
        premiumProviderPaymentId: fakeUser.premiumProviderPaymentId,
        access: expect.objectContaining({ state: expect.any(String), allowed: expect.any(Boolean) }),
      });
    });
  });

  describe('logout', () => {
    it('calls logout service and clears cookies', async () => {
      const payload = { sub: fakeUser.id, clientId: 'jonathalimax', role: 'user' as const };
      const res = mockRes();
      await controller.logout(payload, res as unknown as Response);
      expect(mockAuthService.logout).toHaveBeenCalledWith(fakeUser.id);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});

describe('resolveClientIdForLogin', () => {
  it('returns the explicit clientId when provided', () => {
    expect(resolveClientIdForLogin('custom-client', 'person@example.com')).toBe('custom-client');
  });

  it('derives the clientId from the email local-part when clientId is missing', () => {
    expect(resolveClientIdForLogin(undefined, 'jonathalimax@gmail.com')).toBe('jonathalimax');
  });

  it('throws when no clientId can be resolved', () => {
    expect(() => resolveClientIdForLogin(undefined, '')).toThrow('Unable to resolve clientId for login');
  });
});
