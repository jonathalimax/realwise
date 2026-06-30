import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { users } from '../db/schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type User = typeof users.$inferSelect;

@Injectable()
export class AuthService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Inject(DRIZZLE) private readonly db: any,
    private readonly jwtService: JwtService,
  ) {}

  async findOrCreateUser(opts: {
    email: string;
    clientId: string;
    name?: string | null;
    profileImageUrl?: string | null;
    firebaseUid?: string | null;
    appleId?: string | null;
  }): Promise<User> {
    const existing = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, opts.email), eq(users.clientId, opts.clientId)));

    if (existing.length > 0) {
      const user = existing[0] as User;
      const updates: Partial<User> = { updatedAt: new Date() };
      if (opts.firebaseUid && !user.firebaseUid) updates.firebaseUid = opts.firebaseUid;
      if (opts.appleId && !user.appleId) updates.appleId = opts.appleId;
      if (opts.name && !user.name) updates.name = opts.name;
      if (opts.profileImageUrl && opts.profileImageUrl !== user.profileImageUrl) updates.profileImageUrl = opts.profileImageUrl;
      await this.db.update(users).set(updates).where(eq(users.id, user.id));
      return { ...user, ...updates };
    }

    const inserted = await this.db
      .insert(users)
      .values({
        clientId: opts.clientId,
        email: opts.email,
        name: opts.name ?? null,
        profileImageUrl: opts.profileImageUrl ?? null,
        firebaseUid: opts.firebaseUid ?? null,
        appleId: opts.appleId ?? null,
      })
      .returning();

    return inserted[0] as User;
  }

  async issueTokens(user: Pick<User, 'id' | 'clientId' | 'role'>): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      clientId: user.clientId,
      role: user.role as 'user' | 'admin',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
    });

    const hash = await bcrypt.hash(refreshToken, 10);
    await this.db
      .update(users)
      .set({ refreshTokenHash: hash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { accessToken, refreshToken };
  }

  async validateRefreshToken(userId: string, token: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (rows.length === 0) return null;
    const user = rows[0] as User;
    if (!user.refreshTokenHash) return null;

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    return valid ? user : null;
  }

  async logout(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ refreshTokenHash: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async findById(userId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    return rows[0] ?? null;
  }
}
