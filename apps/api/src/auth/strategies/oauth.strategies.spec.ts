import { GoogleStrategy } from './google.strategy';
import { AppleSignInStrategy } from './apple.strategy';

describe('OAuth strategies', () => {
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.APPLE_CLIENT_ID = 'apple-client-id';
    process.env.APPLE_TEAM_ID = 'apple-team-id';
    process.env.APPLE_KEY_ID = 'apple-key-id';
    process.env.APPLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----';
  });

  describe('GoogleStrategy', () => {
    it('returns the normalized user instead of relying on done callback', async () => {
      const strategy = new GoogleStrategy();

      await expect(
        strategy.validate(
          'access-token',
          'refresh-token',
          {
            id: 'google-id-1',
            displayName: 'Test User',
            emails: [{ value: 'user@example.com' }],
            photos: [{ value: 'https://avatars.example.com/google-user.png' }],
          } as never,
        ),
      ).resolves.toEqual({
        email: 'user@example.com',
        name: 'Test User',
        googleId: 'google-id-1',
        profileImageUrl: 'https://avatars.example.com/google-user.png',
      });
    });

    it('throws when Google does not return an email', async () => {
      const strategy = new GoogleStrategy();

      await expect(
        strategy.validate(
          'access-token',
          'refresh-token',
          {
            id: 'google-id-1',
            displayName: 'Test User',
            emails: [],
          } as never,
        ),
      ).rejects.toThrow('No email returned from Google');
    });
  });

  describe('AppleSignInStrategy', () => {
    it('returns the normalized user instead of relying on done callback', async () => {
      const strategy = new AppleSignInStrategy();

      await expect(
        strategy.validate(
          'access-token',
          'refresh-token',
          { sub: 'apple-sub-1', email: 'user@example.com', picture: 'https://avatars.example.com/apple-user.png' },
          { name: { firstName: 'Test', lastName: 'User' } } as never,
        ),
      ).resolves.toEqual({
        email: 'user@example.com',
        name: 'Test User',
        appleId: 'apple-sub-1',
        profileImageUrl: 'https://avatars.example.com/apple-user.png',
      });
    });

    it('throws when Apple does not return a subject identifier', async () => {
      const strategy = new AppleSignInStrategy();

      await expect(
        strategy.validate(
          'access-token',
          'refresh-token',
          {},
          {} as never,
        ),
      ).rejects.toThrow('No sub in Apple id_token');
    });
  });
});
