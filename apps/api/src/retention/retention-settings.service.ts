import { Injectable } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { normalizeRetention, RetentionSettings } from './retention.types';

@Injectable()
export class RetentionSettingsService {
  constructor(private readonly settings: AppSettingsService) {}

  async get(): Promise<RetentionSettings> {
    return normalizeRetention(await this.settings.get<Partial<RetentionSettings>>('retention'));
  }

  async save(input: Partial<RetentionSettings>, updatedBy: string | null): Promise<RetentionSettings> {
    const next = normalizeRetention({ ...(await this.get()), ...input });
    await this.settings.set('retention', next, updatedBy);
    return next;
  }
}
