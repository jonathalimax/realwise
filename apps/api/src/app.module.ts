import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';

@Module({ imports: [HealthModule, DrizzleModule] })
export class AppModule {}
