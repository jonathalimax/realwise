import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    DrizzleModule,
    NotificationsModule,
    // Only used to read the session cookie on the public contact endpoint (same secret as AuthModule).
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
