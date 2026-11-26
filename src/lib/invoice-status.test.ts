import { describe, expect, it } from "vitest";
import {
  balanceDue,
  canRecordPayment,
  deriveStatus,
  formatInvoiceNumber,
  invoiceTotal,
  type StatusInput,
} from "./invoice-status";

const today = "2026-11-25";

function invoice(overrides: Partial<StatusInput> = {}): StatusInput {
  return { status: "SENT", dueDate: "2026-12-10", total: 100_000, payments: [], ...overrides };
}

const pay = (amountReceived: number, settlesInvoice = false) => ({
  amountReceived,
  settlesInvoice,
});

describe("invoiceTotal", () => {
  it("adds rounded line totals", () => {
    expect(
      invoiceTotal([
        { unitPrice: 3333, quantityHundredths: 150 }, // 49.995 -> 50.00
        { unitPrice: 3333, quantityHundredths: 150 }, // 50.00
        { unitPrice: 10_000, quantityHundredths: 100 },
      ]),
    ).toBe(20_000);
  });

  it("is zero for no items", () => {
    expect(invoiceTotal([])).toBe(0);
  });
});

describe("deriveStatus", () => {
  it("keeps draft and void as stored, whatever the dates", () => {
    expect(deriveStatus(invoice({ status: "DRAFT", dueDate: "2020-01-01" }), today)).toBe("draft");
    expect(deriveStatus(invoice({ status: "VOID", dueDate: "2020-01-01" }), today)).toBe("void");
  });

  it("is sent before the due date with no payments", () => {
    expect(deriveStatus(invoice(), today)).toBe("sent");
  });

  it("is still sent on the due date itself", () => {
    expect(deriveStatus(invoice({ dueDate: today }), today)).toBe("sent");
  });

  it("is overdue the day after the due date", () => {
    expect(deriveStatus(invoice({ dueDate: "2026-11-24" }), today)).toBe("overdue");
  });

  it("is partly paid when some money arrived", () => {
    expect(deriveStatus(invoice({ payments: [pay(40_000)] }), today)).toBe("partly_paid");
  });

  it("is overdue when partly paid and past due", () => {
    expect(deriveStatus(invoice({ dueDate: "2026-11-01", payments: [pay(40_000)] }), today)).toBe(
      "overdue",
    );
  });

  it("is paid when payments cover the total, even past due", () => {
    const paid = invoice({ dueDate: "2026-11-01", payments: [pay(40_000), pay(60_000)] });
    expect(deriveStatus(paid, today)).toBe("paid");
    expect(balanceDue(paid)).toBe(0);
  });

  it("is paid when a short payment is marked as settling the invoice", () => {
    // The intermediary bank kept $15.
    const short = invoice({ payments: [pay(98_500, true)] });
    expect(deriveStatus(short, today)).toBe("paid");
    expect(balanceDue(short)).toBe(0);
  });

  it("reports the remaining balance", () => {
    expect(balanceDue(invoice({ payments: [pay(40_000)] }))).toBe(60_000);
    expect(balanceDue(invoice({ payments: [pay(120_000)] }))).toBe(0);
  });
});

describe("rules", () => {
  it("only accepts payments on sent invoices", () => {
    expect(canRecordPayment("SENT")).toBe(true);
    expect(canRecordPayment("DRAFT")).toBe(false);
    expect(canRecordPayment("VOID")).toBe(false);
  });

  it("formats invoice numbers", () => {
    expect(formatInvoiceNumber(7)).toBe("INV-0007");
    expect(formatInvoiceNumber(null)).toBe("Draft");
  });
});
