import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { getClient, listClients, setClientArchived, updateClient } from "@/server/clients";
import { getDashboard } from "@/server/dashboard";
import {
  createInvoice,
  deleteDraft,
  duplicateInvoice,
  getInvoice,
  listInvoices,
  markSent,
  updateDraft,
  updateInvoiceDetails,
  voidInvoice,
} from "@/server/invoices";
import { deletePayment, recordPayment } from "@/server/payments";
import { createUserWithInvoice, invoiceInput } from "../../test/factories";

const notFound = (p: Promise<unknown>) =>
  expect(p).rejects.toSatisfy((e) => e instanceof HttpError && e.status === 404);

const paymentInput = {
  receivedDate: "2026-11-20",
  amountReceived: 106_250,
  amountBRL: 600_000,
  feesBRL: 0,
  rateMode: "none" as const,
  manualRateMicros: null,
  settlesInvoice: false,
  note: "",
};
const today = "2026-11-25";

/** Ann and Bob each have a client and an invoice. Bob tries to reach Ann's. */
async function twoUsers() {
  const ann = await createUserWithInvoice("Ann");
  const bob = await createUserWithInvoice("Bob");
  return { ann, bob };
}

describe("a user can never read another user's rows", () => {
  it("does not list them", async () => {
    const { ann, bob } = await twoUsers();
    expect((await listClients(bob.user.id)).map((c) => c.id)).toEqual([bob.client.id]);
    expect((await listInvoices(bob.user.id)).map((i) => i.id)).toEqual([bob.invoice.id]);
    expect((await listInvoices(ann.user.id)).map((i) => i.id)).toEqual([ann.invoice.id]);
  });

  it("does not return them by id", async () => {
    const { ann, bob } = await twoUsers();
    await notFound(getClient(bob.user.id, ann.client.id));
    await notFound(getInvoice(bob.user.id, ann.invoice.id));
  });

  it("filters by the user even when given another user's client id", async () => {
    const { ann, bob } = await twoUsers();
    expect(await listInvoices(bob.user.id, { clientId: ann.client.id })).toEqual([]);
  });

  it("does not count them in the dashboard", async () => {
    const { ann, bob } = await twoUsers();
    await markSent(ann.user.id, ann.invoice.id);
    await recordPayment(ann.user.id, ann.invoice.id, paymentInput, { today });
    const bobs = await getDashboard(bob.user.id, 2026, today);
    expect(bobs.totalBRL).toBe(0);
    expect(bobs.byClient).toEqual([]);
    const anns = await getDashboard(ann.user.id, 2026, today);
    expect(anns.totalBRL).toBe(600_000);
  });
});

describe("a user can never change or delete another user's rows", () => {
  it("can't edit, archive, send, void, duplicate or delete them", async () => {
    const { ann, bob } = await twoUsers();
    const b = bob.user.id;
    await notFound(
      updateClient(b, ann.client.id, {
        name: "hacked",
        country: "x",
        email: "",
        address: "",
        defaultCurrency: "USD",
        paymentTermsDays: 1,
      }),
    );
    await notFound(setClientArchived(b, ann.client.id, true));
    await notFound(updateDraft(b, ann.invoice.id, invoiceInput(bob.client.id)));
    await notFound(
      updateInvoiceDetails(b, ann.invoice.id, { notes: "x", taxTreatmentNote: "", nfseNumber: "" }),
    );
    await notFound(markSent(b, ann.invoice.id));
    await notFound(voidInvoice(b, ann.invoice.id));
    await notFound(duplicateInvoice(b, ann.invoice.id));
    await notFound(deleteDraft(b, ann.invoice.id));

    const untouched = await getInvoice(ann.user.id, ann.invoice.id);
    expect(untouched.storedStatus).toBe("DRAFT");
    expect(untouched.client.name).toBe("Ann's client");
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ann.user.id } })).lastInvoiceNumber,
    ).toBe(0);
  });

  it("can't create an invoice for another user's client", async () => {
    const { ann, bob } = await twoUsers();
    await expect(createInvoice(bob.user.id, invoiceInput(ann.client.id))).rejects.toThrow(
      "Choose one of your clients",
    );
    await expect(
      updateDraft(bob.user.id, bob.invoice.id, invoiceInput(ann.client.id)),
    ).rejects.toThrow("Choose one of your clients");
  });

  it("can't record or delete payments on another user's invoice", async () => {
    const { ann, bob } = await twoUsers();
    await markSent(ann.user.id, ann.invoice.id);
    await notFound(recordPayment(bob.user.id, ann.invoice.id, paymentInput, { today }));
    const { id } = await recordPayment(ann.user.id, ann.invoice.id, paymentInput, { today });
    await notFound(deletePayment(bob.user.id, id));
    expect(await prisma.payment.count()).toBe(1);
  });
});
