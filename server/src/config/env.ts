import { z } from 'zod';

const DEFAULT_PORT = 3000;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, 'DATABASE_URL نمی‌تواند خالی باشد.')
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL باید یک رشته اتصال معتبر PostgreSQL باشد.',
    )
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

/** Validated environment variables. Server boots even without `.env`; DB helpers require `DATABASE_URL`. */
export const env = loadEnv();

export function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Configure server/.env before accessing the database.');
  }

  return env.DATABASE_URL;
}
