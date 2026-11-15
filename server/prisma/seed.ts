import { randomBytes, scryptSync } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const DEFAULT_BARBERSHOP_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_BRANCH_ID = '00000000-0000-4000-8000-000000000002';
const DEFAULT_BARBER_ID = '00000000-0000-4000-8000-000000000003';

const INITIAL_SERVICES = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'اصلاح مو',
    durationMinutes: 30,
    priceToman: 250000,
    sortOrder: 1,
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'اصلاح مو و ریش',
    durationMinutes: 60,
    priceToman: 350000,
    sortOrder: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    name: 'رنگ مو',
    durationMinutes: 90,
    priceToman: 900000,
    sortOrder: 3,
  },
  {
    id: '00000000-0000-4000-8000-000000000014',
    name: 'شست‌وشو و حالت‌دهی',
    durationMinutes: 30,
    priceToman: 150000,
    sortOrder: 4,
  },
] as const;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run seed.');
  }

  const adminUsername = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is required in server/.env to seed the primary admin.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.barbershop.upsert({
      where: { id: DEFAULT_BARBERSHOP_ID },
      update: { name: 'آرایشگاه مرکزی', isActive: true },
      create: {
        id: DEFAULT_BARBERSHOP_ID,
        name: 'آرایشگاه مرکزی',
        slug: 'default-barbershop',
        isActive: true,
      },
    });

    await prisma.branch.upsert({
      where: { id: DEFAULT_BRANCH_ID },
      update: { name: 'شعبه مرکزی', timezone: 'Asia/Tehran', isActive: true },
      create: {
        id: DEFAULT_BRANCH_ID,
        barbershopId: DEFAULT_BARBERSHOP_ID,
        name: 'شعبه مرکزی',
        timezone: 'Asia/Tehran',
        isActive: true,
      },
    });

    await prisma.barber.upsert({
      where: { id: DEFAULT_BARBER_ID },
      update: { fullName: 'آرایشگر اصلی', isActive: true },
      create: {
        id: DEFAULT_BARBER_ID,
        branchId: DEFAULT_BRANCH_ID,
        fullName: 'آرایشگر اصلی',
        isActive: true,
      },
    });

    for (const service of INITIAL_SERVICES) {
      await prisma.service.upsert({
        where: { id: service.id },
        update: {
          name: service.name,
          durationMinutes: service.durationMinutes,
          priceToman: service.priceToman,
          sortOrder: service.sortOrder,
          isActive: true,
        },
        create: {
          id: service.id,
          branchId: DEFAULT_BRANCH_ID,
          name: service.name,
          durationMinutes: service.durationMinutes,
          priceToman: service.priceToman,
          sortOrder: service.sortOrder,
          isActive: true,
        },
      });
    }

    await prisma.admin.upsert({
      where: { username: adminUsername },
      update: {
        passwordHash: hashPassword(adminPassword),
        barbershopId: DEFAULT_BARBERSHOP_ID,
        branchId: DEFAULT_BRANCH_ID,
        isActive: true,
      },
      create: {
        username: adminUsername,
        passwordHash: hashPassword(adminPassword),
        barbershopId: DEFAULT_BARBERSHOP_ID,
        branchId: DEFAULT_BRANCH_ID,
        isActive: true,
      },
    });

    console.log('Seed completed: barbershop, branch, barber, 4 services, and primary admin.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
