import "server-only";
import {
  addDays,
  daysBetween,
  fromDbDate,
  monthKey,
  monthsOfYear,
  nextTaxPaymentDate,
  toDbDate,
  todayInBrazil,
  yearOf,
  type CalendarDate,
} from "@/lib/dates";
import { ceilingLevel, type CeilingLevel } from "@/lib/ceiling";
import { prisma } from "@/lib/db";
import { balanceDue, deriveStatus, formatInvoiceNumber, invoiceTotal } from "@/lib/invoice-status";
import { add, percentOf, ratio, sum } from "@/lib/money";
import type { Currency } from "@/lib/types";

export interface Reminder {
  kind: "overdue" | "due_soon" | "tax";
  date: CalendarDate;
  days: number;
  invoiceId?: string;
  label: string;
  amount?: number;
  currency?: Currency;
}

export interface DashboardData {
  year: number;
  today: CalendarDate;
  isCurrentYear: boolean;
  monthly: { month: string; amountBRL: number; feesBRL: number }[];
  byClient: { clientId: string; name: string; amountBRL: number }[];
  totalBRL: number;
  feesBRL: number;
  paymentCount: number;
  ceiling: { amountBRL: number; ratio: number; level: CeilingLevel; remainingBRL: number };
  setAside: { basisPoints: number; amountBRL: number };
  outstanding: { currency: Currency; amount: number; count: number }[];
  reminders: Reminder[];
  availableYears: number[];
}

const DUE_SOON_DAYS = 7;

/** Income is counted by the date the money arrived, in reais that reached the bank. */
export async function getDashboard(
  userId: string,
  year: number,
  today: CalendarDate = todayInBrazil(),
): Promise<DashboardData> {
  const [user, payments, openInvoices, years] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { revenueCeilingBRL: true, setAsideBasisPoints: true },
    }),
    prisma.payment.findMany({
      where: {
        userId,
        receivedDate: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) },
      },
      select: {
        receivedDate: true,
        amountBRL: true,
        feesBRL: true,
        invoice: { select: { client: { select: { id: true, name: true } } } },
      },
    }),
    prisma.invoice.findMany({
      where: { userId, status: "SENT" },
      include: {
        client: { select: { name: true } },
        items: { select: { quantityHundredths: true, unitPrice: true } },
        payments: { select: { amountReceived: true, settlesInvoice: true } },
      },
    }),
    prisma.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM "receivedDate")::int AS year
      FROM "Payment" WHERE "userId" = ${userId}`,
  ]);

  const months = monthsOfYear(year);
  const monthly = months.map((month) => ({ month, amountBRL: 0, feesBRL: 0 }));
  const clients = new Map<string, { clientId: string; name: string; amountBRL: number }>();
  for (const p of payments) {
    const m = monthly[months.indexOf(monthKey(fromDbDate(p.receivedDate)))];
    m.amountBRL = add(m.amountBRL, p.amountBRL);
    m.feesBRL = add(m.feesBRL, p.feesBRL);
    const c = p.invoice.client;
    const entry = clients.get(c.id) ?? { clientId: c.id, name: c.name, amountBRL: 0 };
    entry.amountBRL = add(entry.amountBRL, p.amountBRL);
    clients.set(c.id, entry);
  }

  const totalBRL = sum(payments.map((p) => p.amountBRL));
  const ceilingBRL = user.revenueCeilingBRL;

  const reminders: Reminder[] = [];
  const outstanding = new Map<Currency, { currency: Currency; amount: number; count: number }>();
  for (const inv of openInvoices) {
    const statusInput = {
      status: inv.status,
      dueDate: fromDbDate(inv.dueDate),
      total: invoiceTotal(inv.items),
      payments: inv.payments,
    };
    const balance = balanceDue(statusInput);
    if (balance === 0) continue;
    const o = outstanding.get(inv.currency) ?? { currency: inv.currency, amount: 0, count: 0 };
    o.amount = add(o.amount, balance);
    o.count += 1;
    outstanding.set(inv.currency, o);

    const status = deriveStatus(statusInput, today);
    const days = daysBetween(today, statusInput.dueDate);
    const label = `${formatInvoiceNumber(inv.number)} · ${inv.client.name}`;
    const base = {
      date: statusInput.dueDate,
      days,
      invoiceId: inv.id,
      label,
      amount: balance,
      currency: inv.currency,
    };
    if (status === "overdue") reminders.push({ kind: "overdue", ...base });
    else if (statusInput.dueDate <= addDays(today, DUE_SOON_DAYS))
      reminders.push({ kind: "due_soon", ...base });
  }
  const taxDate = nextTaxPaymentDate(today);
  reminders.push({
    kind: "tax",
    date: taxDate,
    days: daysBetween(today, taxDate),
    label: "Monthly tax payment (DAS)",
  });
  const order = { overdue: 0, due_soon: 1, tax: 2 };
  reminders.sort((a, b) => order[a.kind] - order[b.kind] || a.date.localeCompare(b.date));

  const availableYears = [...new Set([...years.map((y) => y.year), yearOf(today), year])].sort(
    (a, b) => b - a,
  );

  return {
    year,
    today,
    isCurrentYear: year === yearOf(today),
    monthly,
    byClient: [...clients.values()].sort((a, b) => b.amountBRL - a.amountBRL),
    totalBRL,
    feesBRL: sum(payments.map((p) => p.feesBRL)),
    paymentCount: payments.length,
    ceiling: {
      amountBRL: ceilingBRL,
      ratio: ratio(totalBRL, ceilingBRL),
      level: ceilingLevel(totalBRL, ceilingBRL),
      remainingBRL: Math.max(0, ceilingBRL - totalBRL),
    },
    setAside: {
      basisPoints: user.setAsideBasisPoints,
      amountBRL: percentOf(totalBRL, user.setAsideBasisPoints),
    },
    outstanding: [...outstanding.values()],
    reminders,
    availableYears,
  };
}
