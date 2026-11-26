import { tz } from "@date-fns/tz";
import { addDays as addDaysFns, differenceInCalendarDays, format, parseISO } from "date-fns";

/*
 * Invoices, payments and reminders deal in calendar dates, not instants.
 * A CalendarDate is a "YYYY-MM-DD" string in the Brazil calendar. Instants
 * (like "now") are turned into a calendar date once, in America/Sao_Paulo,
 * so an invoice issued at 23:30 on the 31st stays in that month even though
 * it is already the 1st in UTC.
 */

export type CalendarDate = string;

export const BRAZIL_TZ = "America/Sao_Paulo";
const brazil = tz(BRAZIL_TZ);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): value is CalendarDate {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The calendar date in Brazil at a given instant (default: now). */
export function todayInBrazil(now: Date = new Date()): CalendarDate {
  return format(now, "yyyy-MM-dd", { in: brazil });
}

/** Prisma maps @db.Date to a Date at UTC midnight. */
export function toDbDate(date: CalendarDate): Date {
  if (!isCalendarDate(date)) throw new RangeError(`Not a calendar date: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

// Calendar arithmetic is done on the plain date, with no time zone involved.
export function addDays(date: CalendarDate, days: number): CalendarDate {
  return format(addDaysFns(parseISO(date), days), "yyyy-MM-dd");
}

export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(date: CalendarDate): number {
  return parseISO(date).getDay();
}

export function isWeekend(date: CalendarDate): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

export function monthKey(date: CalendarDate): string {
  return date.slice(0, 7);
}

export function yearOf(date: CalendarDate): number {
  return Number(date.slice(0, 4));
}

/** "Nov 25, 2026" */
export function formatDate(date: CalendarDate): string {
  return format(parseISO(date), "MMM d, yyyy");
}

/** "2026-11" -> "Nov" (or "Nov 2026" with the year) */
export function formatMonth(key: string, withYear = false): string {
  return format(parseISO(`${key}-01`), withYear ? "MMM yyyy" : "MMM");
}

/** Moves a Saturday or Sunday to the following Monday. Holidays are not handled. */
export function nextWeekday(date: CalendarDate): CalendarDate {
  const d = dayOfWeek(date);
  if (d === 6) return addDays(date, 2);
  if (d === 0) return addDays(date, 1);
  return date;
}

/** Moves a Saturday or Sunday back to the Friday before. Used for rate lookups. */
export function previousWeekday(date: CalendarDate): CalendarDate {
  const d = dayOfWeek(date);
  if (d === 6) return addDays(date, -1);
  if (d === 0) return addDays(date, -2);
  return date;
}

export const TAX_PAYMENT_DAY = 20;

function taxDateForMonth(year: number, month: number): CalendarDate {
  const mm = String(month).padStart(2, "0");
  return nextWeekday(`${year}-${mm}-${TAX_PAYMENT_DAY}`);
}

/**
 * The next monthly tax payment date (the 20th, moved to Monday when it falls
 * on a weekend), on or after `today`. National and local holidays are ignored.
 */
export function nextTaxPaymentDate(today: CalendarDate): CalendarDate {
  const year = yearOf(today);
  const month = Number(today.slice(5, 7));
  const thisMonth = taxDateForMonth(year, month);
  if (thisMonth >= today) return thisMonth;
  return month === 12 ? taxDateForMonth(year + 1, 1) : taxDateForMonth(year, month + 1);
}

/** The twelve month keys of a year: ["2026-01", ..., "2026-12"]. */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}
