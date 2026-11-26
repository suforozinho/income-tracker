import "server-only";
import { todayInBrazil } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { createDemoData } from "./demo-data";

const GUEST_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * "Try the demo": each visitor gets a throwaway user filled with fake data,
 * so they can create invoices and record payments without touching anyone
 * else's demo. Guests older than a day are removed first.
 */
export async function createGuestUser(): Promise<{ id: string; name: string }> {
  await prisma.user.deleteMany({
    where: { isGuest: true, createdAt: { lt: new Date(Date.now() - GUEST_LIFETIME_MS) } },
  });

  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({ data: { name: "Demo user", isGuest: true } });
      await createDemoData(tx, user.id, todayInBrazil());
      return { id: user.id, name: user.name ?? "Demo user" };
    },
    { timeout: 20_000 },
  );
}

export async function isGuestUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
  return user?.isGuest ?? false;
}
