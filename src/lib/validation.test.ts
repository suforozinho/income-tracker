import { describe, expect, it } from "vitest";
import {
  clientSchema,
  fieldErrors,
  invoiceSchema,
  paymentSchema,
  settingsSchema,
  type InvoiceFormValues,
  type PaymentFormValues,
} from "./validation";

const invoice = (overrides: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  clientId: "c1",
  currency: "USD",
  issueDate: "2026-11-25",
  dueDate: "2026-12-25",
  items: [{ description: "Development", quantity: "10", unitPrice: "85.00" }],
  notes: "",
  taxTreatmentNote: "",
  nfseNumber: "",
  ...overrides,
});

const payment = (overrides: Partial<PaymentFormValues> = {}): PaymentFormValues => ({
  receivedDate: "2026-11-25",
  amountReceived: "1,000.00",
  amountBRL: "5,650.00",
  feesBRL: "",
  rateMode: "ptax",
  manualRate: "",
  settlesInvoice: false,
  note: "",
  ...overrides,
});

describe("invoiceSchema", () => {
  it("turns typed strings into integers", () => {
    const parsed = invoiceSchema.parse(
      invoice({
        items: [
          { description: "Dev", quantity: "7.5", unitPrice: "1,200.50" },
          { description: "Hosting", quantity: "1", unitPrice: "0" },
        ],
      }),
    );
    // Quantities come out in hundredths, prices in cents.
    expect(parsed.items).toEqual([
      { description: "Dev", quantity: 750, unitPrice: 120_050 },
      { description: "Hosting", quantity: 100, unitPrice: 0 },
    ]);
  });

  it("needs at least one item", () => {
    const result = invoiceSchema.safeParse(invoice({ items: [] }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toHaveProperty("items");
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceSchema.safeParse(invoice({ dueDate: "2026-11-24" }));
    expect(fieldErrors(result.error!)).toEqual({
      dueDate: "The due date can't be before the issue date",
    });
  });

  it("rejects bad amounts and quantities with a field path", () => {
    const result = invoiceSchema.safeParse(
      invoice({ items: [{ description: "x", quantity: "0", unitPrice: "1.234" }] }),
    );
    const errors = fieldErrors(result.error!);
    expect(errors["items.0.quantity"]).toBeDefined();
    expect(errors["items.0.unitPrice"]).toBe("Enter an amount like 1,250.00");
  });

  it("rejects impossible dates and unknown currencies", () => {
    const result = invoiceSchema.safeParse(
      invoice({ issueDate: "2026-02-30", currency: "GBP" as "USD" }),
    );
    const errors = fieldErrors(result.error!);
    expect(errors.issueDate).toBeDefined();
    expect(errors.currency).toBeDefined();
  });
});

describe("paymentSchema", () => {
  it("parses amounts and treats empty fees as zero", () => {
    const parsed = paymentSchema.parse(payment());
    expect(parsed).toMatchObject({
      amountReceived: 100_000,
      amountBRL: 565_000,
      feesBRL: 0,
      manualRateMicros: null,
    });
  });

  it("needs a valid rate in manual mode", () => {
    expect(paymentSchema.safeParse(payment({ rateMode: "manual" })).success).toBe(false);
    expect(
      paymentSchema.parse(payment({ rateMode: "manual", manualRate: "5.4321" })).manualRateMicros,
    ).toBe(5_432_100);
  });

  it("rejects a zero payment", () => {
    expect(paymentSchema.safeParse(payment({ amountReceived: "0" })).success).toBe(false);
  });
});

describe("clientSchema and settingsSchema", () => {
  it("validates a client", () => {
    const parsed = clientSchema.parse({
      name: " Acme GmbH ",
      country: "Germany",
      email: "",
      address: "",
      defaultCurrency: "EUR",
      paymentTermsDays: "30",
    });
    expect(parsed.name).toBe("Acme GmbH");
    expect(parsed.paymentTermsDays).toBe(30);
    expect(
      clientSchema.safeParse({ ...parsed, email: "nope", paymentTermsDays: "30" }).success,
    ).toBe(false);
  });

  it("stores the set-aside percentage in basis points", () => {
    const parsed = settingsSchema.parse({
      businessName: "",
      businessDetails: "",
      paymentInstructions: "",
      regimeLabel: "MEI",
      revenueCeiling: "81,000.00",
      setAsidePercent: "6.5",
    });
    expect(parsed.setAsidePercent).toBe(650);
    expect(parsed.revenueCeiling).toBe(8_100_000);
  });
});
