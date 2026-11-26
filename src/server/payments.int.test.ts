import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { getDashboard } from "@/server/dashboard";
import { createInvoice, getInvoice, markSent, voidInvoice } from "@/server/invoices";
import { recordPayment } from "@/server/payments";
import { getPtaxRate, RateUnavailableError, type PtaxRow } from "@/server/rates";
import type { PaymentInput } from "@/lib/validation";
import { createUserWithClient, createUserWithInvoice, invoiceInput } from "../../test/factories";

const today = "2026-11-25";

const payment = (overrides: Partial<PaymentInput> = {}): PaymentInput => ({
  receivedDate: "2026-11-19",
  amountReceived: 106_250,
  amountBRL: 605_000,
  feesBRL: 3_500,
  rateMode: "none",
  manualRateMicros: null,
  settlesInvoice: false,
  note: "",
  ...overrides,
});

/** Real closing bulletins around Friday Nov 20, 2026, a national holiday. */
const ROWS: PtaxRow[] = [
  {
    cotacaoCompra: 5.7845,
    cotacaoVenda: 5.7851,
    dataHoraCotacao: "2026-11-17 13:07:26.01516",
    tipoBoletim: "Fechamento",
  },
  {
    cotacaoCompra: 5.8096,
    cotacaoVenda: 5.8102,
    dataHoraCotacao: "2026-11-18 13:08:44.271245",
    tipoBoletim: "Fechamento",
  },
  {
    cotacaoCompra: 5.8,
    cotacaoVenda: 5.81,
    dataHoraCotacao: "2026-11-19 12:00:00.000",
    tipoBoletim: "Intermediário",
  },
  {
    cotacaoCompra: 5.8883,
    cotacaoVenda: 5.8889,
    dataHoraCotacao: "2026-11-19 13:04:18.325373",
    tipoBoletim: "Fechamento",
  },
];

function fakeFetch(rows: PtaxRow[] = ROWS) {
  return vi.fn(async () => Response.json({ value: rows })) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;
}

describe("recording payments", () => {
  it("can't be done on a draft", async () => {
    const { user, invoice } = await createUserWithInvoice("Ann");
    await expect(recordPayment(user.id, invoice.id, payment(), { today })).rejects.toSatisfy(
      (e) => e instanceof HttpError && e.status === 409 && /sent/.test(e.message),
    );
    expect(await prisma.payment.count()).toBe(0);
  });

  it("can't be done on a void invoice", async () => {
    const { user, invoice } = await createUserWithInvoice("Ann");
    await markSent(user.id, invoice.id);
    await voidInvoice(user.id, invoice.id);
    await expect(recordPayment(user.id, invoice.id, payment(), { today })).rejects.toThrow(
      "void invoice",
    );
    expect(await prisma.payment.count()).toBe(0);
  });

  it("can't be dated in the future", async () => {
    const { user, invoice } = await createUserWithInvoice("Ann");
    await markSent(user.id, invoice.id);
    await expect(
      recordPayment(user.id, invoice.id, payment({ receivedDate: "2026-11-26" }), { today }),
    ).rejects.toThrow("future");
  });

  it("stores the typed reais untouched and marks the invoice paid", async () => {
    const { user, invoice } = await createUserWithInvoice("Ann");
    await markSent(user.id, invoice.id);
    await recordPayment(user.id, invoice.id, payment(), { today });
    const inv = await getInvoice(user.id, invoice.id, today);
    expect(inv.status).toBe("paid");
    expect(inv.payments[0]).toMatchObject({ amountBRL: 605_000, feesBRL: 3_500, rateMicros: null });
  });

  it("records a manual rate when the user types one", async () => {
    const { user, invoice } = await createUserWithInvoice("Ann");
    await markSent(user.id, invoice.id);
    await recordPayment(
      user.id,
      invoice.id,
      payment({ rateMode: "manual", manualRateMicros: 5_700_000 }),
      { today },
    );
    const [p] = (await getInvoice(user.id, invoice.id)).payments;
    expect(p).toMatchObject({
      rateMicros: 5_700_000,
      rateSource: "MANUAL",
      rateDate: "2026-11-19",
    });
  });

  it("looks up the PTAX rate on the server and keeps it as a reference", async () => {
    const { user, invoice } = await createUserWithInvoice("Ann");
    await markSent(user.id, invoice.id);
    const fetchImpl = fakeFetch();
    await recordPayment(
      user.id,
      invoice.id,
      payment({ receivedDate: "2026-11-21", rateMode: "ptax" }),
      { today, getRate: (c, d, o) => getPtaxRate(c, d, { ...o, fetchImpl }) },
    );
    const [p] = (await getInvoice(user.id, invoice.id)).payments;
    expect(p).toMatchObject({
      rateMicros: 5_888_900,
      rateDate: "2026-11-19",
      rateSource: "PTAX",
      rateBulletin: "Fechamento",
      amountBRL: 605_000,
    });
  });

  it("updates the dashboard month and year-to-date total straight away", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, id);
    const before = await getDashboard(user.id, 2026, today);
    await recordPayment(user.id, id, payment({ receivedDate: "2026-11-02" }), { today });
    const after = await getDashboard(user.id, 2026, today);
    expect(after.totalBRL - before.totalBRL).toBe(605_000);
    expect(after.monthly[10]).toMatchObject({
      month: "2026-11",
      amountBRL: 605_000,
      feesBRL: 3_500,
    });
    expect(after.byClient).toEqual([
      { clientId: client.id, name: client.name, amountBRL: 605_000 },
    ]);
  });

  it("counts a payment received on Dec 31 in that year, not the next", async () => {
    const { user, client } = await createUserWithClient("Ann");
    const { id } = await createInvoice(user.id, invoiceInput(client.id));
    await markSent(user.id, id);
    await recordPayment(user.id, id, payment({ receivedDate: "2026-12-31" }), {
      today: "2027-01-01",
    });
    expect((await getDashboard(user.id, 2026, "2027-01-01")).monthly[11].amountBRL).toBe(605_000);
    expect((await getDashboard(user.id, 2027, "2027-01-01")).totalBRL).toBe(0);
  });
});

describe("PTAX rates", () => {
  it("uses the previous business day on a weekend, and says which day", async () => {
    const fetchImpl = fakeFetch();
    // Saturday Nov 21; Friday Nov 20 is a holiday, so Thursday's bulletin applies.
    const rate = await getPtaxRate("USD", "2026-11-21", { fetchImpl, today });
    expect(rate).toMatchObject({
      requestedDate: "2026-11-21",
      rateDate: "2026-11-19",
      sellMicros: 5_888_900,
      buyMicros: 5_888_300,
      bulletin: "Fechamento",
    });
  });

  it("asks the API with the MM-DD-YYYY dates and the closing-bulletin filter", async () => {
    const fetchImpl = fakeFetch();
    await getPtaxRate("EUR", "2026-11-19", { fetchImpl, today });
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain("@moeda='EUR'");
    expect(url).toContain("@dataInicial='11-09-2026'");
    expect(url).toContain("@dataFinalCotacao='11-19-2026'");
    expect(decodeURIComponent(url)).toContain("tipoBoletim eq 'Fechamento'");
  });

  it("caches bulletins so the next lookup does not call the API", async () => {
    const fetchImpl = fakeFetch();
    await getPtaxRate("USD", "2026-11-19", { fetchImpl, today });
    expect(await prisma.exchangeRate.count()).toBe(3);
    const again = await getPtaxRate("USD", "2026-11-18", { fetchImpl, today });
    expect(again.sellMicros).toBe(5_810_200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("answers a Sunday from a cached Friday", async () => {
    const fetchImpl = fakeFetch([
      {
        cotacaoCompra: 5.7,
        cotacaoVenda: 5.71,
        dataHoraCotacao: "2026-11-13 13:00:00.0",
        tipoBoletim: "Fechamento",
      },
    ]);
    await getPtaxRate("USD", "2026-11-13", { fetchImpl, today });
    const sunday = await getPtaxRate("USD", "2026-11-15", { fetchImpl, today });
    expect(sunday).toMatchObject({ rateDate: "2026-11-13", requestedDate: "2026-11-15" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports the API being down so the user can type a rate", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      getPtaxRate("USD", "2026-11-19", { fetchImpl: down, today }),
    ).rejects.toBeInstanceOf(RateUnavailableError);
    const error = vi.fn(
      async () => new Response("oops", { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(getPtaxRate("USD", "2026-11-19", { fetchImpl: error, today })).rejects.toThrow(
      "500",
    );
  });

  it("refuses future dates", async () => {
    await expect(
      getPtaxRate("USD", "2026-11-30", { fetchImpl: fakeFetch(), today }),
    ).rejects.toThrow("future");
  });
});
