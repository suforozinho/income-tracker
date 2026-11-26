// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { InvoiceDetailDTO, SettingsDTO } from "@/lib/types";
import { lineTotal, invoiceTotal } from "@/lib/invoice-status";
import { pdfFilename, renderInvoicePdf } from "./render";

const business: SettingsDTO = {
  businessName: "Demo Dev Studio LTDA",
  businessDetails: "Rua Exemplo, 123 · São Paulo, SP\nCNPJ 00.000.000/0001-00",
  paymentInstructions: "IBAN: BR00 0000 0000 0000 0000 0000 000X 0\nSWIFT: EXAMPLEXXX",
  regimeLabel: "MEI",
  revenueCeilingBRL: 8_100_000,
  setAsideBasisPoints: 600,
};

function invoiceWith(
  items: { description: string; quantityHundredths: number; unitPrice: number }[],
): InvoiceDetailDTO {
  const withTotals = items.map((item, i) => ({
    id: String(i),
    ...item,
    lineTotal: lineTotal(item),
  }));
  const total = invoiceTotal(items);
  return {
    id: "inv1",
    number: 7,
    numberLabel: "INV-0007",
    client: {
      id: "c1",
      name: "Kestrel Software GmbH",
      country: "Germany",
      email: "rechnung@kestrel.example",
      address: "Musterstraße 12\n10115 Berlin",
      defaultCurrency: "EUR",
      paymentTermsDays: 30,
      archived: false,
    },
    issueDate: "2026-11-02",
    dueDate: "2026-12-02",
    currency: "EUR",
    storedStatus: "SENT",
    status: "sent",
    total,
    paid: 0,
    balance: total,
    items: withTotals,
    payments: [],
    notes: "Project ref. KS-42",
    taxTreatmentNote: "private",
    nfseNumber: "",
  };
}

/** Pages in a PDF, counted from its page objects. */
function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe("invoice PDF", () => {
  it("renders a one-item invoice on one page", async () => {
    const pdf = await renderInvoicePdf(
      invoiceWith([{ description: "Development", quantityHundredths: 1000, unitPrice: 8_500 }]),
      business,
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
    expect(pdf.toString("latin1")).toContain("Invoice INV-0007");
  });

  it("breaks 40 items across pages", async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      description: `Task ${i + 1}: feature work`,
      quantityHundredths: 150,
      unitPrice: 4_500,
    }));
    const pdf = await renderInvoicePdf(invoiceWith(items), business);
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(2);
  });

  it("wraps a very long description instead of overflowing", async () => {
    const long = "Refactored the reporting module and wrote migration notes. ".repeat(40);
    const pdf = await renderInvoicePdf(
      invoiceWith([{ description: long, quantityHundredths: 100, unitPrice: 100_000 }]),
      business,
    );
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(1);
  });

  it("works for a draft without business details", async () => {
    const draft = {
      ...invoiceWith([{ description: "x", quantityHundredths: 100, unitPrice: 1 }]),
      number: null,
      numberLabel: "Draft",
      storedStatus: "DRAFT" as const,
      status: "draft" as const,
    };
    const pdf = await renderInvoicePdf(draft, {
      ...business,
      businessName: "",
      businessDetails: "",
      paymentInstructions: "",
    });
    expect(pageCount(pdf)).toBe(1);
    expect(pdfFilename(draft)).toBe("invoice-draft-kestrel-software-gmbh.pdf");
  });
});
