import { Prisma, PrismaClient } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
export const db = new PrismaClient();
export async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 4) {
        await delay(25 * 2 ** attempt + Math.floor(Math.random() * 25));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Transaction could not be completed');
}
export const publicUserSelect = {
  id: true, fictional: true, profile: true,
  teachingSkills: { include: { skill: true } },
  learningSkills: { include: { skill: true } },
  availability: { orderBy: [{ day: 'asc' as const }, { hour: 'asc' as const }] }
} satisfies Prisma.UserSelect;
export const exchangeInclude = {
  sender: { select: { id: true, fictional: true, profile: true } },
  receiver: { select: { id: true, fictional: true, profile: true } },
  sessions: { orderBy: { ordinal: 'asc' as const }, include: { skill: true, confirmations: true, reviews: true } }
} satisfies Prisma.ExchangeInclude;
