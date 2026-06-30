import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  email: string;
  name: string | null;
  googleId: string;
  profileImageUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<GoogleProfile> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('No email returned from Google');
    }

    return {
      email,
      name: profile.displayName ?? null,
      googleId: profile.id,
      profileImageUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
