import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminLandingController, PublicLandingController } from './landing.controller';

@Module({ imports: [DrizzleModule], controllers: [PublicLandingController, AdminLandingController], providers: [AdminGuard] })
export class LandingModule {}
