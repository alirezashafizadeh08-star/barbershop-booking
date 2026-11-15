import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env, requireDatabaseUrl } from '../config/env.ts';

const globalForPrisma = globalThis as unknown as {
  pgPool?: Pool;
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = requireDatabaseUrl();
  const pool = globalForPrisma.pgPool ?? new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (env.NODE_ENV !== 'production') {
    globalForPrisma.pgPool = pool;
    globalForPrisma.prisma = client;
  }

  return { pool, client };
}

const { pool, client } = globalForPrisma.prisma && globalForPrisma.pgPool
  ? { pool: globalForPrisma.pgPool, client: globalForPrisma.prisma }
  : createPrismaClient();

export const prisma = client;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
