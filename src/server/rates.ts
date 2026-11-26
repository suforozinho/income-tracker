import "server-only";
import {
  addDays,
  fromDbDate,
  previousWeekday,
  toDbDate,
  todayInBrazil,
  type CalendarDate,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { parseDecimal } from "@/lib/money";
import type { Currency, RateDTO } from "@/lib/types";

/*
 * Banco Central PTAX reference rates.
 *
 * Rule: the sell rate (cotacaoVenda) of the closing bulletin ("Fechamento")
 * for the date. Weekends and holidays have no bulletin, so we use the most
 * recent earlier business day that has one. Bulletins are immutable once
 * published, so every one we fetch is cached in ExchangeRate for all users.
 */

const PTAX_BASE = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";
export const CLOSING_BULLETIN = "Fechamento";
/** Long enough to cover a weekend plus a run of holidays (Carnival, year end). */
const LOOKBACK_DAYS = 10;
const TIMEOUT_MS = 5_000;

export class RateUnavailableError extends HttpError {
  constructor(message: string) {
    super(503, message);
  }
}

export interface PtaxRow {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string; // "2026-11-19 13:04:18.325373"
  tipoBoletim: string;
}

export interface ClosingRate {
  date: CalendarDate;
  buyMicros: number;
  sellMicros: number;
}

/** "11-25-2026": the API wants MM-DD-YYYY. */
export function ptaxDateParam(date: CalendarDate): string {
  const [y, m, d] = date.split("-");
  return `${m}-${d}-${y}`;
}

export function ptaxUrl(currency: Currency, from: CalendarDate, to: CalendarDate): string {
  const params = [
    `@moeda='${currency}'`,
    `@dataInicial='${ptaxDateParam(from)}'`,
    `@dataFinalCotacao='${ptaxDateParam(to)}'`,
    `$filter=${encodeURIComponent(`tipoBoletim eq '${CLOSING_BULLETIN}'`)}`,
    "$format=json",
  ].join("&");
  return `${PTAX_BASE}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?${params}`;
}

/** JSON numbers like 5.7851 become 5785100 without float arithmetic. */
function toMicros(value: number): number {
  const micros = parseDecimal(value.toFixed(6), 6);
  if (micros === null || micros <= 0) throw new RateUnavailableError("Unexpected rate format");
  return micros;
}

/** Keep only closing bulletins, one per date. */
export function parseClosingRates(rows: readonly PtaxRow[]): ClosingRate[] {
  const byDate = new Map<CalendarDate, ClosingRate>();
  for (const row of rows) {
    if (row.tipoBoletim !== CLOSING_BULLETIN) continue;
    const date = row.dataHoraCotacao.slice(0, 10);
    byDate.set(date, {
      date,
      buyMicros: toMicros(row.cotacaoCompra),
      sellMicros: toMicros(row.cotacaoVenda),
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The closing rate for `date`, or for the latest earlier date that has one. */
export function pickRate(rates: readonly ClosingRate[], date: CalendarDate): ClosingRate | null {
  let best: ClosingRate | null = null;
  for (const r of rates) {
    if (r.date <= date && (!best || r.date > best.date)) best = r;
  }
  return best;
}

export async function fetchClosingRates(
  currency: Currency,
  from: CalendarDate,
  to: CalendarDate,
  fetchImpl: typeof fetch = fetch,
): Promise<ClosingRate[]> {
  let response: Response;
  try {
    response = await fetchImpl(ptaxUrl(currency, from, to), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new RateUnavailableError("Couldn't reach the Banco Central rate service");
  }
  if (!response.ok) {
    throw new RateUnavailableError(`The Banco Central rate service answered ${response.status}`);
  }
  try {
    const body = (await response.json()) as { value?: PtaxRow[] };
    return parseClosingRates(body.value ?? []);
  } catch (error) {
    if (error instanceof RateUnavailableError) throw error;
    throw new RateUnavailableError("The Banco Central rate service sent an unexpected answer");
  }
}

function toDTO(currency: Currency, requestedDate: CalendarDate, rate: ClosingRate): RateDTO {
  return {
    currency,
    requestedDate,
    rateDate: rate.date,
    buyMicros: rate.buyMicros,
    sellMicros: rate.sellMicros,
    bulletin: CLOSING_BULLETIN,
  };
}

async function findCached(currency: Currency, date: CalendarDate): Promise<ClosingRate | null> {
  const row = await prisma.exchangeRate.findUnique({
    where: { date_currency: { date: toDbDate(date), currency } },
  });
  return row
    ? { date: fromDbDate(row.date), buyMicros: row.buyMicros, sellMicros: row.sellMicros }
    : null;
}

/**
 * PTAX reference rate for a date. Cache first; the API only when needed.
 * Throws RateUnavailableError when the API is down; callers then offer manual entry.
 */
export async function getPtaxRate(
  currency: Currency,
  date: CalendarDate,
  options: { fetchImpl?: typeof fetch; today?: CalendarDate } = {},
): Promise<RateDTO> {
  const today = options.today ?? todayInBrazil();
  if (date > today) throw new HttpError(400, "There is no rate for a future date yet");

  // A weekend never has a bulletin, so a cached Friday is the right answer for
  // Saturday and Sunday. (A holiday Friday is never cached, so that falls through.)
  const cached = await findCached(currency, previousWeekday(date));
  if (cached) return toDTO(currency, date, cached);

  const rates = await fetchClosingRates(
    currency,
    addDays(date, -LOOKBACK_DAYS),
    date,
    options.fetchImpl,
  );
  if (rates.length > 0) {
    await prisma.exchangeRate.createMany({
      data: rates.map((r) => ({
        date: toDbDate(r.date),
        currency,
        buyMicros: r.buyMicros,
        sellMicros: r.sellMicros,
        bulletin: CLOSING_BULLETIN,
      })),
      skipDuplicates: true,
    });
  }
  const picked = pickRate(rates, date);
  if (!picked) throw new RateUnavailableError("No PTAX bulletin was found for that date");
  return toDTO(currency, date, picked);
}
