/*
 * Money is always an integer number of minor units (cents, centavos).
 * Floats appear only at the very edge, when Intl.NumberFormat prints a value.
 * Every rounding in the app goes through `divideRounded`.
 */

export type CurrencyCode = "USD" | "EUR" | "BRL";

/** Upper bound for any single amount the user can type: 10 million in major units. */
export const MAX_AMOUNT_MINOR = 1_000_000_000;

/** Exchange rates are stored in millionths: 5.7324 BRL per USD -> 5_732_400. */
export const RATE_SCALE = 1_000_000;

export function assertMinor(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be a safe integer of minor units, got ${value}`);
  }
  return value;
}

/**
 * Divide and round half away from zero, in exact integer arithmetic.
 * This is the one place where money is rounded.
 */
export function divideRounded(numerator: bigint, denominator: bigint): number {
  if (denominator === BigInt(0)) throw new RangeError("Division by zero");
  const negative = numerator < BigInt(0) !== denominator < BigInt(0);
  const n = numerator < BigInt(0) ? -numerator : numerator;
  const d = denominator < BigInt(0) ? -denominator : denominator;
  let q = n / d;
  if ((n % d) * BigInt(2) >= d) q += BigInt(1);
  const result = Number(negative ? -q : q);
  return assertMinor(result);
}

export function add(...amounts: number[]): number {
  return assertMinor(amounts.reduce((total, a) => total + assertMinor(a), 0));
}

export function sum(amounts: readonly number[]): number {
  return add(...amounts);
}

export function subtract(a: number, b: number): number {
  return assertMinor(assertMinor(a) - assertMinor(b));
}

/** Line total: unit price times a quantity given in hundredths (1.5 -> 150). */
export function multiplyByQuantity(unitPrice: number, quantityHundredths: number): number {
  return divideRounded(
    BigInt(assertMinor(unitPrice)) * BigInt(assertMinor(quantityHundredths)),
    BigInt(100),
  );
}

/** Convert foreign minor units to BRL centavos with a rate in millionths. */
export function convert(amount: number, rateMicros: number): number {
  return divideRounded(
    BigInt(assertMinor(amount)) * BigInt(assertMinor(rateMicros)),
    BigInt(RATE_SCALE),
  );
}

/** A percentage given in basis points (6% -> 600) of an amount. */
export function percentOf(amount: number, basisPoints: number): number {
  return divideRounded(
    BigInt(assertMinor(amount)) * BigInt(assertMinor(basisPoints)),
    BigInt(10_000),
  );
}

/** Ratio as a plain number for progress bars, e.g. 0.8 for 80%. Not money. */
export function ratio(part: number, whole: number): number {
  return whole <= 0 ? 0 : part / whole;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** "$1,234.56", "€1,234.56", "R$1,234.56". Display only. */
export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options: { compact?: boolean } = {},
): string {
  const key = `${currency}:${options.compact ? "c" : ""}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      ...(options.compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    formatters.set(key, formatter);
  }
  // The only float in the money path: integer / 100 is exact enough to print.
  return formatter.format(assertMinor(amount) / 100);
}

/**
 * Parse a decimal typed by a person into an integer scaled by 10^decimals,
 * without going through floating point. Accepts "1,234.5", "1234.50", "  12 ".
 * Returns null when the text is not a number with at most `decimals` places.
 */
export function parseDecimal(input: string, decimals: number): number | null {
  const cleaned = input
    .trim()
    .replace(/[\s,]/g, "")
    .replace(/^(R\$|\$|€)/, "");
  const match = /^(-)?(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > decimals) return null;
  const digits = whole + fraction.padEnd(decimals, "0");
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return sign && value !== 0 ? -value : value;
}

/** "1,234.56" -> 123456 */
export function parseMoney(input: string): number | null {
  return parseDecimal(input, 2);
}

/** Integer scaled by 10^decimals back to a plain string for form inputs: 123456 -> "1234.56". */
export function toDecimalString(value: number, decimals: number): string {
  assertMinor(value);
  const negative = value < 0;
  const digits = String(Math.abs(value)).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  const text = decimals > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${text}` : text;
}

/** For form inputs: 123456 -> "1234.56". */
export function toMoneyInput(amount: number): string {
  return toDecimalString(amount, 2);
}

/** Quantity in hundredths for display: 150 -> "1.5", 200 -> "2". */
export function formatQuantity(quantityHundredths: number): string {
  return toDecimalString(quantityHundredths, 2).replace(/\.?0+$/, "") || "0";
}

/** Rate in millionths for display: 5732400 -> "5.7324". */
export function formatRate(rateMicros: number): string {
  return toDecimalString(rateMicros, 6).replace(/0{1,2}$/, "");
}
