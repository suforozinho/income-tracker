import type { CalendarDate } from "./dates";
import { multiplyByQuantity, subtract, sum } from "./money";

/*
 * Only DRAFT, SENT and VOID are stored. Everything else is worked out here
 * from the items, payments and today's date, so it can never go stale.
 */

export type StoredStatus = "DRAFT" | "SENT" | "VOID";
export type DisplayStatus = "draft" | "sent" | "partly_paid" | "paid" | "overdue" | "void";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partly_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export interface ItemAmounts {
  quantityHundredths: number;
  unitPrice: number;
}

export interface PaymentAmounts {
  amountReceived: number;
  settlesInvoice: boolean;
}

export function lineTotal(item: ItemAmounts): number {
  return multiplyByQuantity(item.unitPrice, item.quantityHundredths);
}

/** Each line is rounded once, then the rounded lines are added. Matches the PDF. */
export function invoiceTotal(items: readonly ItemAmounts[]): number {
  return sum(items.map(lineTotal));
}

export function amountPaid(payments: readonly PaymentAmounts[]): number {
  return sum(payments.map((p) => p.amountReceived));
}

export interface StatusInput {
  status: StoredStatus;
  dueDate: CalendarDate;
  total: number;
  payments: readonly PaymentAmounts[];
}

export function deriveStatus(invoice: StatusInput, today: CalendarDate): DisplayStatus {
  if (invoice.status === "DRAFT") return "draft";
  if (invoice.status === "VOID") return "void";
  const paid = amountPaid(invoice.payments);
  if (paid >= invoice.total || invoice.payments.some((p) => p.settlesInvoice)) return "paid";
  if (invoice.dueDate < today) return "overdue";
  if (paid > 0) return "partly_paid";
  return "sent";
}

/** What the client still owes, never below zero. Zero once the invoice is settled. */
export function balanceDue(invoice: StatusInput): number {
  if (invoice.status !== "SENT") return 0;
  if (invoice.payments.some((p) => p.settlesInvoice)) return 0;
  return Math.max(0, subtract(invoice.total, amountPaid(invoice.payments)));
}

export function formatInvoiceNumber(number: number | null): string {
  return number === null ? "Draft" : `INV-${String(number).padStart(4, "0")}`;
}

/** Payments can only be recorded against an invoice that has been sent. */
export function canRecordPayment(status: StoredStatus): boolean {
  return status === "SENT";
}
