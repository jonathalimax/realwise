import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import AppleStrategy, { AuthenticateOptions } from 'passport-apple';

export interface AppleProfile {
  email: string | null;
  name: string | null;
  appleId: string;
}

@Injectable()
export class AppleSignInStrategy extends PassportStrategy(AppleStrategy, 'apple') {
  constructor() {
    const privateKey = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    super({
      clientID: process.env.APPLE_CLIENT_ID ?? '',
      teamID: process.env.APPLE_TEAM_ID ?? '',
      keyID: process.env.APPLE_KEY_ID ?? '',
      privateKeyString: privateKey,
      callbackURL: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/auth/apple/callback`,
      passReqToCallback: false,
      scope: ['name', 'email'],
    } as AuthenticateOptions);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    idToken: Record<string, unknown>,
    profile: Record<string, unknown> & { name?: { firstName?: string; lastName?: string } },
    done: (err: Error | null, user?: AppleProfile) => void,
  ): Promise<void> {
    const appleId = (idToken?.sub ?? profile?.id) as string | undefined;
    if (!appleId) {
      done(new Error('No sub in Apple id_token'), undefined);
      return;
    }

    const email = (idToken?.email ?? profile?.email ?? null) as string | null;
    const firstName = (profile?.name?.firstName ?? null) as string | null;
    const lastName = (profile?.name?.lastName ?? null) as string | null;
    const name =
      firstName || lastName
        ? [firstName, lastName].filter(Boolean).join(' ')
        : null;

    done(null, { email, name, appleId });
  }
}
