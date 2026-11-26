import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, fromDbDate, toDbDate, todayInBrazil, type CalendarDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { conflict, HttpError, notFound } from "@/lib/errors";
import {
  amountPaid,
  balanceDue,
  deriveStatus,
  formatInvoiceNumber,
  invoiceTotal,
  lineTotal,
  type DisplayStatus,
} from "@/lib/invoice-status";
import type { InvoiceDetailDTO, InvoiceSummaryDTO, PaymentDTO } from "@/lib/types";
import type { InvoiceDetailsInput, InvoiceInput } from "@/lib/validation";
import { toClientDTO } from "./clients";

/*
 * Every query here includes the user id. A record that exists but belongs to
 * someone else is reported exactly like one that does not exist.
 */

const summaryInclude = {
  client: { select: { id: true, name: true } },
  items: { select: { quantityHundredths: true, unitPrice: true } },
  payments: { select: { amountReceived: true, settlesInvoice: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithSummary = Prisma.InvoiceGetPayload<{ include: typeof summaryInclude }>;

function toSummary(inv: InvoiceWithSummary, today: CalendarDate): InvoiceSummaryDTO {
  const total = invoiceTotal(inv.items);
  const statusInput = {
    status: inv.status,
    dueDate: fromDbDate(inv.dueDate),
    total,
    payments: inv.payments,
  };
  return {
    id: inv.id,
    number: inv.number,
    numberLabel: formatInvoiceNumber(inv.number),
    client: inv.client,
    issueDate: fromDbDate(inv.issueDate),
    dueDate: fromDbDate(inv.dueDate),
    currency: inv.currency,
    storedStatus: inv.status,
    status: deriveStatus(statusInput, today),
    total,
    paid: amountPaid(inv.payments),
    balance: balanceDue(statusInput),
  };
}

export interface InvoiceFilters {
  status?: DisplayStatus;
  clientId?: string;
  year?: number;
}

export async function listInvoices(
  userId: string,
  filters: InvoiceFilters = {},
  today: CalendarDate = todayInBrazil(),
): Promise<InvoiceSummaryDTO[]> {
  const where: Prisma.InvoiceWhereInput = { userId };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.year) {
    where.issueDate = {
      gte: toDbDate(`${filters.year}-01-01`),
      lte: toDbDate(`${filters.year}-12-31`),
    };
  }
  // Narrow by stored status in the database; derived statuses are filtered after.
  if (filters.status === "draft") where.status = "DRAFT";
  else if (filters.status === "void") where.status = "VOID";
  else if (filters.status) where.status = "SENT";

  const invoices = await prisma.invoice.findMany({
    where,
    include: summaryInclude,
    orderBy: [{ issueDate: "desc" }, { number: { sort: "desc", nulls: "first" } }],
  });
  const summaries = invoices.map((inv) => toSummary(inv, today));
  return filters.status ? summaries.filter((s) => s.status === filters.status) : summaries;
}

export async function getInvoice(
  userId: string,
  invoiceId: string,
  today: CalendarDate = todayInBrazil(),
): Promise<InvoiceDetailDTO> {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      client: true,
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!inv) throw notFound("Invoice");

  const summary = toSummary(inv, today);
  return {
    ...summary,
    client: toClientDTO(inv.client),
    items: inv.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantityHundredths: item.quantityHundredths,
      unitPrice: item.unitPrice,
      lineTotal: lineTotal(item),
    })),
    payments: inv.payments.map((p): PaymentDTO => ({
      id: p.id,
      receivedDate: fromDbDate(p.receivedDate),
      amountReceived: p.amountReceived,
      amountBRL: p.amountBRL,
      feesBRL: p.feesBRL,
      rateMicros: p.rateMicros,
      rateDate: p.rateDate ? fromDbDate(p.rateDate) : null,
      rateSource: p.rateSource,
      rateBulletin: p.rateBulletin,
      settlesInvoice: p.settlesInvoice,
      note: p.note,
    })),
    notes: inv.notes,
    taxTreatmentNote: inv.taxTreatmentNote,
    nfseNumber: inv.nfseNumber,
  };
}

async function assertClientUsable(
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string,
  allowArchived = false,
) {
  const client = await tx.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw new HttpError(400, "Choose one of your clients");
  if (client.archivedAt && !allowArchived) throw conflict("That client is archived");
}

function itemRows(items: InvoiceInput["items"]) {
  return items.map((item, position) => ({
    position,
    description: item.description,
    quantityHundredths: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

function invoiceData(input: InvoiceInput) {
  return {
    clientId: input.clientId,
    currency: input.currency,
    issueDate: toDbDate(input.issueDate),
    dueDate: toDbDate(input.dueDate),
    notes: input.notes,
    taxTreatmentNote: input.taxTreatmentNote,
    nfseNumber: input.nfseNumber,
  };
}

/** New invoices are drafts with no number. */
export async function createInvoice(userId: string, input: InvoiceInput): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    await assertClientUsable(tx, userId, input.clientId);
    const invoice = await tx.invoice.create({
      data: {
        ...invoiceData(input),
        userId,
        status: "DRAFT",
        items: { create: itemRows(input.items) },
      },
      select: { id: true },
    });
    return invoice;
  });
}

/** Only drafts can change their client, items, dates or currency. */
export async function updateDraft(
  userId: string,
  invoiceId: string,
  input: InvoiceInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, userId },
      select: { status: true, clientId: true },
    });
    if (!existing) throw notFound("Invoice");
    if (existing.status !== "DRAFT") throw conflict("Only draft invoices can be edited");
    await assertClientUsable(tx, userId, input.clientId, input.clientId === existing.clientId);
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { ...invoiceData(input), items: { create: itemRows(input.items) } },
    });
  });
}

/** The NFS-e number and notes can still be filled in after an invoice is sent. */
export async function updateInvoiceDetails(
  userId: string,
  invoiceId: string,
  input: InvoiceDetailsInput,
): Promise<void> {
  const { count } = await prisma.invoice.updateMany({
    where: { id: invoiceId, userId, status: { not: "VOID" } },
    data: input,
  });
  if (count === 0) throw notFound("Invoice");
}

/** Drafts have no number, so deleting one never leaves a gap. */
export async function deleteDraft(userId: string, invoiceId: string): Promise<void> {
  const { count } = await prisma.invoice.deleteMany({
    where: { id: invoiceId, userId, status: "DRAFT" },
  });
  if (count === 0) {
    const exists = await prisma.invoice.count({ where: { id: invoiceId, userId } });
    if (!exists) throw notFound("Invoice");
    throw conflict("Only drafts can be deleted. Void a sent invoice instead");
  }
}

/**
 * Give a draft the next number and mark it sent, in one transaction.
 * The increment on the user's counter locks that row, so two invoices sent at
 * the same moment get consecutive numbers. If anything fails, the increment
 * rolls back too, so no number is ever skipped.
 */
export async function markSent(userId: string, invoiceId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.invoice.findFirst({
      where: { id: invoiceId, userId },
      select: { status: true, _count: { select: { items: true } } },
    });
    if (!draft) throw notFound("Invoice");
    if (draft.status !== "DRAFT") throw conflict("This invoice has already been sent");
    if (draft._count.items === 0) throw conflict("Add at least one item before sending");

    const { lastInvoiceNumber: number } = await tx.user.update({
      where: { id: userId },
      data: { lastInvoiceNumber: { increment: 1 } },
      select: { lastInvoiceNumber: true },
    });
    const { count } = await tx.invoice.updateMany({
      where: { id: invoiceId, userId, status: "DRAFT" },
      data: { status: "SENT", number },
    });
    if (count === 0) throw conflict("This invoice has already been sent");
    return number;
  });
}

/** A sent invoice keeps its number when voided. Remove its payments first. */
export async function voidInvoice(userId: string, invoiceId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({
      where: { id: invoiceId, userId },
      select: { status: true, _count: { select: { payments: true } } },
    });
    if (!inv) throw notFound("Invoice");
    if (inv.status !== "SENT") throw conflict("Only sent invoices can be voided");
    if (inv._count.payments > 0) {
      throw conflict("This invoice has payments. Delete them before voiding it");
    }
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
  });
}

/** Copy an invoice's client and items into a new draft dated today. */
export async function duplicateInvoice(
  userId: string,
  invoiceId: string,
  today: CalendarDate = todayInBrazil(),
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: { items: { orderBy: { position: "asc" } }, client: true },
    });
    if (!source) throw notFound("Invoice");
    return tx.invoice.create({
      data: {
        userId,
        clientId: source.clientId,
        currency: source.currency,
        issueDate: toDbDate(today),
        dueDate: toDbDate(addDays(today, source.client.paymentTermsDays)),
        notes: source.notes,
        taxTreatmentNote: source.taxTreatmentNote,
        status: "DRAFT",
        items: {
          create: source.items.map(({ position, description, quantityHundredths, unitPrice }) => ({
            position,
            description,
            quantityHundredths,
            unitPrice,
          })),
        },
      },
      select: { id: true },
    });
  });
}
