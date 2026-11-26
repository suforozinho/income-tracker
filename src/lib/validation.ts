import { z } from "zod";
import { isCalendarDate } from "./dates";
import { MAX_AMOUNT_MINOR, parseDecimal, parseMoney } from "./money";

/*
 * One schema per form, used twice: by React Hook Form in the browser, and by
 * the server action on the raw form values. Forms hold strings; the schemas
 * turn them into integers and calendar dates.
 */

export const CURRENCIES = ["USD", "EUR"] as const;
export const currencySchema = z.enum(CURRENCIES, { message: "Choose USD or EUR" });

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const required = (max: number, message: string) => text(max).min(1, message);

function money(options: { min?: number; label?: string } = {}) {
  const min = options.min ?? 1;
  return z
    .string()
    .trim()
    .min(1, options.label ?? "Enter an amount")
    .transform((value, ctx) => {
      const amount = parseMoney(value);
      if (amount === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount like 1,250.00" });
        return z.NEVER;
      }
      if (amount < min) {
        ctx.addIssue({
          code: "custom",
          message: min > 0 ? "Must be more than zero" : "Can't be negative",
        });
        return z.NEVER;
      }
      if (amount > MAX_AMOUNT_MINOR) {
        ctx.addIssue({ code: "custom", message: "That amount is too large" });
        return z.NEVER;
      }
      return amount;
    });
}

/** Empty string means zero. */
const optionalMoney = z
  .string()
  .trim()
  .transform((v) => (v === "" ? "0" : v))
  .pipe(money({ min: 0 }));

const calendarDate = (label: string) =>
  z.string().refine(isCalendarDate, { message: `Enter a valid ${label}` });

const quantity = z
  .string()
  .trim()
  .min(1, "Enter a quantity")
  .transform((value, ctx) => {
    const q = parseDecimal(value, 2);
    if (q === null || q <= 0 || q > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Use a number above zero, up to 2 decimals" });
      return z.NEVER;
    }
    return q;
  });

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Enter a valid email" });

// ---------- Clients ----------

export const clientSchema = z.object({
  name: required(120, "Enter the client's name"),
  country: required(60, "Enter the client's country"),
  email: optionalEmail,
  address: text(500),
  defaultCurrency: currencySchema,
  paymentTermsDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Enter a number of days")
    .transform(Number)
    .refine((n) => n <= 365, "Use 365 days or fewer"),
});
export type ClientFormValues = z.input<typeof clientSchema>;
export type ClientInput = z.output<typeof clientSchema>;

// ---------- Invoices ----------

export const invoiceItemSchema = z.object({
  description: required(500, "Describe the work"),
  quantity,
  unitPrice: money({ min: 0, label: "Enter a price" }),
});

export const MAX_ITEMS = 100;

const invoiceNotes = {
  notes: text(2000),
  taxTreatmentNote: text(1000),
  nfseNumber: text(60),
};

export const invoiceSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client"),
    currency: currencySchema,
    issueDate: calendarDate("issue date"),
    dueDate: calendarDate("due date"),
    items: z
      .array(invoiceItemSchema)
      .min(1, "Add at least one item")
      .max(MAX_ITEMS, `Use ${MAX_ITEMS} items or fewer`),
    ...invoiceNotes,
  })
  .refine((v) => !isCalendarDate(v.dueDate) || v.dueDate >= v.issueDate, {
    path: ["dueDate"],
    message: "The due date can't be before the issue date",
  });
export type InvoiceFormValues = z.input<typeof invoiceSchema>;
export type InvoiceInput = z.output<typeof invoiceSchema>;

/** The parts of a sent invoice that can still change. */
export const invoiceDetailsSchema = z.object(invoiceNotes);
export type InvoiceDetailsInput = z.output<typeof invoiceDetailsSchema>;

// ---------- Payments ----------

export const RATE_MODES = ["ptax", "manual", "none"] as const;

export const paymentSchema = z
  .object({
    receivedDate: calendarDate("date"),
    amountReceived: money({ label: "Enter the amount the client paid" }),
    amountBRL: money({ label: "Enter the reais that reached your account" }),
    feesBRL: optionalMoney,
    rateMode: z.enum(RATE_MODES),
    manualRate: z.string().trim(),
    settlesInvoice: z.boolean(),
    note: text(500),
  })
  .transform((v, ctx) => {
    let manualRateMicros: number | null = null;
    if (v.rateMode === "manual") {
      const rate = parseDecimal(v.manualRate, 6);
      if (rate === null || rate <= 0 || rate > 1_000 * 1_000_000) {
        ctx.addIssue({
          code: "custom",
          path: ["manualRate"],
          message: "Enter a rate like 5.4321",
        });
        return z.NEVER;
      }
      manualRateMicros = rate;
    }
    const { manualRate: _ignored, ...rest } = v;
    void _ignored;
    return { ...rest, manualRateMicros };
  });
export type PaymentFormValues = z.input<typeof paymentSchema>;
export type PaymentInput = z.output<typeof paymentSchema>;

// ---------- Settings ----------

export const settingsSchema = z.object({
  businessName: text(120),
  businessDetails: text(1000),
  paymentInstructions: text(2000),
  regimeLabel: text(60),
  revenueCeiling: money({ label: "Enter your revenue ceiling" }),
  setAsidePercent: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const bp = parseDecimal(value === "" ? "0" : value, 2);
      if (bp === null || bp < 0 || bp > 10_000) {
        ctx.addIssue({ code: "custom", message: "Enter a percentage between 0 and 100" });
        return z.NEVER;
      }
      return bp;
    }),
});
export type SettingsFormValues = z.input<typeof settingsSchema>;
export type SettingsInput = z.output<typeof settingsSchema>;

/** Field errors keyed by dotted path ("items.0.unitPrice"), for server responses. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
