import { Injectable, Logger } from '@nestjs/common';
import { join } from 'node:path';
import { CityResponse, Reader, open, validate } from 'maxmind';

export interface GeoPlace {
  country: string | null;
  region: string | null;
  city: string | null;
}

const clean = (value: string | undefined, max: number): string | null => {
  const v = value?.replace(/^(State of|Estado de|Estado do|Estado da)\s+/i, '').trim();
  return v ? v.slice(0, max) : null;
};

/**
 * Approximate place names (country, state, city) for an IP, read from a local DB-IP "City Lite" file (CC BY 4.0).
 * The lookup happens in this process: the IP never leaves the server and is never stored. Without the file
 * (GEO_DB_PATH, default ./geo/city.mmdb) every lookup returns null and the app works as before.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private reader: Promise<Reader<CityResponse> | null> | null = null;

  private load(): Promise<Reader<CityResponse> | null> {
    this.reader ??= (async () => {
      const path = process.env.GEO_DB_PATH ?? join(process.cwd(), 'geo', 'city.mmdb');
      try {
        return await open<CityResponse>(path);
      } catch (e) {
        this.logger.warn(`IP location database not available at ${path}: ${(e as Error).message}. Locations will not be recorded.`);
        return null;
      }
    })();
    return this.reader;
  }

  async lookup(rawIp: string | undefined): Promise<GeoPlace | null> {
    const ip = rawIp?.trim().replace(/^::ffff:/i, '');
    if (!ip || !validate(ip)) return null;
    const reader = await this.load();
    if (!reader) return null;
    const hit = reader.get(ip);
    if (!hit) return null;
    const place: GeoPlace = {
      country: hit.country?.iso_code?.slice(0, 2) ?? null,
      region: clean(hit.subdivisions?.[0]?.names?.en, 80),
      city: clean(hit.city?.names?.en, 120),
    };
    return place.country || place.region || place.city ? place : null;
  }
}
