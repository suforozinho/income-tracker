import "server-only";
import { toDbDate, todayInBrazil, type CalendarDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { conflict, HttpError, notFound } from "@/lib/errors";
import { canRecordPayment } from "@/lib/invoice-status";
import type { PaymentInput } from "@/lib/validation";
import { getPtaxRate } from "./rates";

type RateLookup = typeof getPtaxRate;

/**
 * Record money that arrived for a sent invoice. The reais typed by the user are
 * stored as-is; the PTAX rate is kept only as a reference next to them.
 */
export async function recordPayment(
  userId: string,
  invoiceId: string,
  input: PaymentInput,
  options: { today?: CalendarDate; getRate?: RateLookup } = {},
): Promise<{ id: string }> {
  const today = options.today ?? todayInBrazil();
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { status: true, currency: true, issueDate: true },
  });
  if (!invoice) throw notFound("Invoice");
  if (!canRecordPayment(invoice.status)) {
    throw conflict(
      invoice.status === "DRAFT"
        ? "Mark the invoice as sent before recording a payment"
        : "Payments can't be recorded on a void invoice",
    );
  }
  if (input.receivedDate > today) {
    throw new HttpError(400, "The payment date can't be in the future");
  }

  let rate: {
    rateMicros: number;
    rateDate: Date;
    rateSource: "PTAX" | "MANUAL";
    rateBulletin: string | null;
  } | null = null;
  if (input.rateMode === "manual" && input.manualRateMicros) {
    rate = {
      rateMicros: input.manualRateMicros,
      rateDate: toDbDate(input.receivedDate),
      rateSource: "MANUAL",
      rateBulletin: null,
    };
  } else if (input.rateMode === "ptax") {
    // Looked up again here: the server never trusts a rate sent by the browser.
    const ptax = await (options.getRate ?? getPtaxRate)(invoice.currency, input.receivedDate, {
      today,
    });
    rate = {
      rateMicros: ptax.sellMicros,
      rateDate: toDbDate(ptax.rateDate),
      rateSource: "PTAX",
      rateBulletin: ptax.bulletin,
    };
  }

  // Re-check the status inside the write so a concurrent void can't slip between.
  return prisma.$transaction(async (tx) => {
    const stillSent = await tx.invoice.count({ where: { id: invoiceId, userId, status: "SENT" } });
    if (!stillSent) throw conflict("This invoice is no longer open for payments");
    return tx.payment.create({
      data: {
        userId,
        invoiceId,
        receivedDate: toDbDate(input.receivedDate),
        amountReceived: input.amountReceived,
        amountBRL: input.amountBRL,
        feesBRL: input.feesBRL,
        settlesInvoice: input.settlesInvoice,
        note: input.note,
        ...(rate ?? {}),
      },
      select: { id: true },
    });
  });
}

export async function deletePayment(
  userId: string,
  paymentId: string,
): Promise<{ invoiceId: string }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    select: { invoiceId: true },
  });
  if (!payment) throw notFound("Payment");
  await prisma.payment.deleteMany({ where: { id: paymentId, userId } });
  return payment;
}
