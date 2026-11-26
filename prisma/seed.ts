/*
 * Local development seed: one fake user with a year of fake invoices.
 * Never point this at a database that holds real data.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { todayInBrazil } from "../src/lib/dates";
import { createDemoData } from "../src/server/demo-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = "demo@example.com";
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({ data: { name: "Demo Freelancer", email } });
      await createDemoData(tx, user.id, todayInBrazil());
    },
    { timeout: 30_000 },
  );
  const [clients, invoices, payments] = await Promise.all([
    prisma.client.count({ where: { user: { email } } }),
    prisma.invoice.count({ where: { user: { email } } }),
    prisma.payment.count({ where: { user: { email } } }),
  ]);
  console.log(`Seeded ${email}: ${clients} clients, ${invoices} invoices, ${payments} payments.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
