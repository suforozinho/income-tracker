import { prisma } from "@/lib/db";
import { createClient } from "@/server/clients";
import { createInvoice } from "@/server/invoices";
import type { InvoiceInput } from "@/lib/validation";

export async function createUser(name: string) {
  return prisma.user.create({ data: { name, email: `${name.toLowerCase()}@example.com` } });
}

/** A user with one USD client. */
export async function createUserWithClient(name: string) {
  const user = await createUser(name);
  const client = await createClient(user.id, {
    name: `${name}'s client`,
    country: "United States",
    email: "",
    address: "",
    defaultCurrency: "USD",
    paymentTermsDays: 30,
  });
  return { user, client };
}

export function invoiceInput(
  clientId: string,
  overrides: Partial<InvoiceInput> = {},
): InvoiceInput {
  return {
    clientId,
    currency: "USD",
    issueDate: "2026-11-02",
    dueDate: "2026-12-02",
    items: [
      { description: "Development", quantity: 1000, unitPrice: 8_500 },
      { description: "Code review", quantity: 250, unitPrice: 8_500 },
    ],
    notes: "",
    taxTreatmentNote: "",
    nfseNumber: "",
    ...overrides,
  };
}

/** A user with a client and one draft invoice for $1,062.50. */
export async function createUserWithInvoice(name: string) {
  const { user, client } = await createUserWithClient(name);
  const invoice = await createInvoice(user.id, invoiceInput(client.id));
  return { user, client, invoice };
}
