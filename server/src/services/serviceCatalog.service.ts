import { prisma } from '../lib/prisma.ts';

export interface ServiceDto {
  id: string;
  name: string;
  durationMinutes: number;
  priceToman: number;
}

/**
 * Returns all active services ordered by sortOrder ascending.
 * Only the fields needed by the public booking flow are exposed.
 */
export async function getActiveServices(): Promise<ServiceDto[]> {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      priceToman: true,
    },
  });

  return services;
}
