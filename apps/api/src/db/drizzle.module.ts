import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

const DrizzleProvider = {
  provide: DRIZZLE,
  useFactory: () => {
    const client = postgres(process.env.DATABASE_URL!, {
      max: Number(process.env.DB_POOL_MAX ?? 10), // one shared pool; the default is also 10 but was never explicit
      idle_timeout: 20, // seconds: free idle connections instead of holding them
      connect_timeout: 10, // fail fast instead of hanging a request when the database is unreachable
    });
    return drizzle(client, { schema });
  },
};

@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
export class DrizzleModule {}
