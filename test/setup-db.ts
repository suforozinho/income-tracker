import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

if (!process.env.DATABASE_URL?.includes("test")) {
  throw new Error("Integration tests must run against a database whose name contains 'test'.");
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Payment", "InvoiceItem", "Invoice", "Client", "ExchangeRate", "Account", "User" CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
