import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { AppSettingsService } from './app-settings.service';

@Global()
@Module({ imports: [DrizzleModule], providers: [AppSettingsService], exports: [AppSettingsService] })
export class AppSettingsModule {}
