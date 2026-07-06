import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../db/drizzle.module';

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: 'jonathalimax',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  firebaseUid: null,
  appleId: null,
  profileImageUrl: null,
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

const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('findOrCreateUser', () => {
    it('returns existing user when email+clientId match', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const result = await service.findOrCreateUser({
        email: 'test@example.com',
        clientId: 'jonathalimax',
      });
      expect(result.id).toBe(fakeUser.id);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('does not reset premium access dates for an existing user', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const result = await service.findOrCreateUser({
        email: 'test@example.com',
        clientId: 'jonathalimax',
      });

      expect(result.premiumAccessStartedAt).toEqual(fakeUser.premiumAccessStartedAt);
      expect(result.premiumAccessEndsAt).toEqual(fakeUser.premiumAccessEndsAt);
    });

    it('initializes premium access for a legacy existing user missing premium dates', async () => {
      const legacyUser = {
        ...fakeUser,
        premiumAccessStartedAt: null,
        premiumAccessEndsAt: null,
        premiumStatus: null,
      };

      const whereSpy = jest.fn().mockResolvedValue([legacyUser]);
      const setSpy = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([legacyUser]) });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({ where: whereSpy }),
      });
      mockDb.update.mockReturnValue({ set: setSpy });

      const result = await service.findOrCreateUser({
        email: 'test@example.com',
        clientId: 'jonathalimax',
      });

      expect(result.premiumAccessStartedAt).toBeInstanceOf(Date);
      expect(result.premiumAccessEndsAt).toBeInstanceOf(Date);
      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
        premiumAccessStartedAt: expect.any(Date),
        premiumAccessEndsAt: expect.any(Date),
        premiumStatus: 'trialing',
      }));
    });

    it('creates user when none exists', async () => {
      const insertedUser = {
        ...fakeUser,
        premiumAccessStartedAt: new Date('2026-07-02T15:30:00.000Z'),
        premiumAccessEndsAt: new Date('2026-08-16T15:30:00.000Z'),
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([insertedUser]),
        }),
      });

      const result = await service.findOrCreateUser({
        email: 'test@example.com',
        clientId: 'jonathalimax',
        name: 'Test User',
      });
      expect(result.id).toBe(fakeUser.id);
      expect(result.premiumStatus).toBe('trialing');
      expect(result.premiumAccessStartedAt).toBeInstanceOf(Date);
      expect(result.premiumAccessEndsAt).toBeInstanceOf(Date);
      expect(result.premiumPurchasedAt).toBeNull();
      expect(result.premiumPaymentProvider).toBeNull();
      expect(result.premiumProviderPaymentId).toBeNull();
    });
  });

  describe('issueTokens', () => {
    it('returns access and refresh tokens', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.issueTokens(fakeUser);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateRefreshToken', () => {
    it('returns null when user has no stored hash', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });
      const result = await service.validateRefreshToken(fakeUser.id, 'any-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears the refresh token hash', async () => {
      const setSpy = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      });
      mockDb.update.mockReturnValue({ set: setSpy });

      await service.logout(fakeUser.id);
      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: null }));
    });
  });

  describe('findById', () => {
    it('returns the matching user when present', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const result = await service.findById(fakeUser.id);
      expect(result).toEqual(fakeUser);
    });

    it('returns null when the user does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.findById(fakeUser.id);
      expect(result).toBeNull();
    });
  });
});
