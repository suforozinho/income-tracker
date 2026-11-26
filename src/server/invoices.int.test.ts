import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createInvoice,
  deleteDraft,
  duplicateInvoice,
  getInvoice,
  listInvoices,
  markSent,
  updateDraft,
  voidInvoice,
} from "@/server/invoices";
import { recordPayment } from "@/server/payments";
import { createUserWithClient, invoiceInput } from "../../test/factories";

describe("invoice numbers", () => {
  it("are only given when an invoice is sent, in order", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const a = await createInvoice(user.id, invoiceInput(client.id));
    const b = await createInvoice(user.id, invoiceInput(client.id));
    expect((await getInvoice(user.id, a.id)).number).toBeNull();

    expect(await markSent(user.id, b.id)).toBe(1);
    expect(await markSent(user.id, a.id)).toBe(2);
    expect((await getInvoice(user.id, a.id)).numberLabel).toBe("INV-0002");
  });

  it("have no gap when a draft is deleted", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const first = await createInvoice(user.id, invoiceInput(client.id));
    const doomed = await createInvoice(user.id, invoiceInput(client.id));
    const third = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, first.id);
    await deleteDraft(user.id, doomed.id);
    await markSent(user.id, third.id);

    const numbers = (await listInvoices(user.id)).map((i) => i.number).sort();
    expect(numbers).toEqual([1, 2]);
  });

  it("are not skipped when sending fails", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const a = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, a.id);
    await expect(markSent(user.id, a.id)).rejects.toThrow("already been sent");
    const b = await createInvoice(user.id, invoiceInput(client.id));
    expect(await markSent(user.id, b.id)).toBe(2);
  });

  it("stay unique and gap-free when many invoices are sent at once", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const drafts = await Promise.all(
      Array.from({ length: 8 }, () => createInvoice(user.id, invoiceInput(client.id))),
    );
    const numbers = await Promise.all(drafts.map((d) => markSent(user.id, d.id)));
    expect(numbers.sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("give one number when the same draft is sent twice at once", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const a = await createInvoice(user.id, invoiceInput(client.id));
    const results = await Promise.allSettled([markSent(user.id, a.id), markSent(user.id, a.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const b = await createInvoice(user.id, invoiceInput(client.id));
    expect(await markSent(user.id, b.id)).toBe(2);
  });

  it("are per user", async () => {
    const ann = await createUserWithClient("Ann");
    const bob = await createUserWithClient("Bob");
    const a = await createInvoice(ann.user.id, invoiceInput(ann.client.id));
    const b = await createInvoice(bob.user.id, invoiceInput(bob.client.id));
    expect(await markSent(ann.user.id, a.id)).toBe(1);
    expect(await markSent(bob.user.id, b.id)).toBe(1);
  });
});

describe("invoice lifecycle", () => {
  it("stores items with integer amounts and computes the total", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    const inv = await getInvoice(user.id, id);
    // 10 h x $85 + 2.5 h x $85 = $1,062.50
    expect(inv.items.map((i) => i.lineTotal)).toEqual([85_000, 21_250]);
    expect(inv.total).toBe(106_250);
  });

  it("only lets drafts be edited or deleted", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    await updateDraft(
      user.id,
      id,
      invoiceInput(client.id, { items: [{ description: "x", quantity: 100, unitPrice: 5 }] }),
    );
    expect((await getInvoice(user.id, id)).total).toBe(5);

    await markSent(user.id, id);
    await expect(updateDraft(user.id, id, invoiceInput(client.id))).rejects.toThrow(
      "Only draft invoices can be edited",
    );
    await expect(deleteDraft(user.id, id)).rejects.toThrow("Only drafts can be deleted");
  });

  it("voids a sent invoice without payments and keeps its number", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, id);
    await voidInvoice(user.id, id);
    const inv = await getInvoice(user.id, id);
    expect(inv.status).toBe("void");
    expect(inv.number).toBe(1);
  });

  it("refuses to void an invoice that has payments", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, id);
    await recordPayment(
      user.id,
      id,
      {
        receivedDate: "2026-11-10",
        amountReceived: 100,
        amountBRL: 550,
        feesBRL: 0,
        rateMode: "none",
        manualRateMicros: null,
        settlesInvoice: false,
        note: "",
      },
      { today: "2026-11-25" },
    );
    await expect(voidInvoice(user.id, id)).rejects.toThrow("Delete them before voiding");
  });

  it("duplicates into a new draft dated today", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, id);
    const copy = await duplicateInvoice(user.id, id, "2026-12-01");
    const inv = await getInvoice(user.id, copy.id);
    expect(inv).toMatchObject({
      status: "draft",
      number: null,
      issueDate: "2026-12-01",
      dueDate: "2026-12-31",
      total: 106_250,
    });
  });

  it("refuses new invoices for archived clients", async () => {
    const { user, client } = await createUserWithClient("Ann");
    await prisma.client.update({ where: { id: client.id }, data: { archivedAt: new Date() } });
    await expect(createInvoice(user.id, invoiceInput(client.id))).rejects.toThrow("archived");
  });
});

describe("derived status in the list", () => {
  it("filters by overdue, which is never stored", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const late = await createInvoice(user.id, invoiceInput(client.id, { dueDate: "2026-11-10" }));
    const fine = await createInvoice(user.id, invoiceInput(client.id, { dueDate: "2026-12-10" }));
    await markSent(user.id, late.id);
    await markSent(user.id, fine.id);
    const overdue = await listInvoices(user.id, { status: "overdue" }, "2026-11-25");
    expect(overdue.map((i) => i.id)).toEqual([late.id]);
    const sent = await listInvoices(user.id, { status: "sent" }, "2026-11-25");
    expect(sent.map((i) => i.id)).toEqual([fine.id]);
  });
});
