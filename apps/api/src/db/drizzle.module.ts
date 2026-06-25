import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

const DrizzleProvider = {
  provide: DRIZZLE,
  useFactory: () => {
    const client = postgres(process.env.DATABASE_URL!);
    return drizzle(client, { schema });
  },
};

@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
export class DrizzleModule {}
