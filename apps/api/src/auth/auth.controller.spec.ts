import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: 'jonathalimax',
  email: 'test@example.com',
  name: 'Test',
  role: 'user' as const,
  firebaseUid: null,
  appleId: null,
  refreshTokenHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAuthService = {
  findOrCreateUser: jest.fn().mockResolvedValue(fakeUser),
  issueTokens: jest.fn().mockResolvedValue({
    accessToken: 'access-jwt',
    refreshToken: 'refresh-jwt',
  }),
  validateRefreshToken: jest.fn(),
  logout: jest.fn(),
};

type MockRes = {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
  json: jest.Mock;
};

const mockRes = (): MockRes => {
  const res = {} as MockRes;
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

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

  describe('me', () => {
    it('returns current user payload', () => {
      const payload = { sub: fakeUser.id, clientId: 'jonathalimax', role: 'user' as const };
      const result = controller.me(payload);
      expect(result).toEqual(payload);
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
