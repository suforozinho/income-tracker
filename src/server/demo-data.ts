import type { Prisma } from "@/generated/prisma/client";
import { addDays, toDbDate, type CalendarDate } from "@/lib/dates";
import { convert, percentOf } from "@/lib/money";

/*
 * Fake data for the demo and for local development. Every name, number and
 * bank detail here is invented. Dates are relative to `today`, so the
 * dashboard always looks lived-in.
 */

type Db = Prisma.TransactionClient;

/** Small deterministic PRNG so the demo looks the same every time. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_SETTINGS = {
  businessName: "Demo Dev Studio LTDA",
  businessDetails:
    "Rua Exemplo, 123 · São Paulo, SP · Brazil\nCNPJ 00.000.000/0001-00 (example)\nbilling@example.com",
  paymentInstructions:
    "International wire transfer\nBank: Example Bank S.A.\nIBAN: BR00 0000 0000 0000 0000 0000 000X 0\nSWIFT/BIC: EXAMPLEXXX\n(Demo details, not a real account.)",
  regimeLabel: "MEI",
  revenueCeilingBRL: 8_100_000,
  setAsideBasisPoints: 600,
};

const CLIENTS = [
  {
    key: "bluefin",
    name: "Bluefin Analytics Inc.",
    country: "United States",
    email: "ap@bluefin.example",
    address: "100 Example Ave, Suite 4\nAustin, TX 78701",
    defaultCurrency: "USD",
    paymentTermsDays: 15,
  },
  {
    key: "kestrel",
    name: "Kestrel Software GmbH",
    country: "Germany",
    email: "rechnung@kestrel.example",
    address: "Musterstraße 12\n10115 Berlin",
    defaultCurrency: "EUR",
    paymentTermsDays: 30,
  },
  {
    key: "harbor",
    name: "Harbor & Pine LLC",
    country: "United States",
    email: "finance@harborpine.example",
    address: "22 Sample Street\nPortland, OR 97201",
    defaultCurrency: "USD",
    paymentTermsDays: 30,
  },
  {
    key: "lumen",
    name: "Lumen Studio B.V.",
    country: "Netherlands",
    email: "admin@lumen.example",
    address: "Voorbeeldweg 8\n1011 AB Amsterdam",
    defaultCurrency: "EUR",
    paymentTermsDays: 14,
  },
] as const;

type ClientKey = (typeof CLIENTS)[number]["key"];
type Item = { description: string; quantityHundredths: number; unitPrice: number };

interface PlannedInvoice {
  client: ClientKey;
  monthsAgo: number;
  day: number;
  items: Item[];
  kind?: "paid" | "open" | "overdue" | "draft" | "void" | "short";
}

function plan(): PlannedInvoice[] {
  const out: PlannedInvoice[] = [];
  // A monthly retainer, every month for a year.
  for (let m = 12; m >= 0; m--) {
    out.push({
      client: "bluefin",
      monthsAgo: m,
      day: 2,
      items: [
        {
          description: "Frontend development retainer",
          quantityHundredths: 100,
          unitPrice: 75_000,
        },
      ],
      kind: m === 0 ? "open" : "paid",
    });
  }
  // Hourly work every other month.
  for (let m = 11; m >= 1; m -= 2) {
    out.push({
      client: "kestrel",
      monthsAgo: m,
      day: 25,
      items: [
        { description: "Feature development", quantityHundredths: 1050, unitPrice: 4_500 },
        { description: "Code review and pairing", quantityHundredths: 250, unitPrice: 4_500 },
      ],
      kind: m === 5 ? "short" : m === 1 ? "open" : "paid",
    });
  }
  // Project work.
  out.push(
    {
      client: "harbor",
      monthsAgo: 9,
      day: 10,
      items: [
        { description: "Landing page build", quantityHundredths: 100, unitPrice: 90_000 },
        { description: "Analytics setup", quantityHundredths: 100, unitPrice: 25_000 },
      ],
    },
    {
      client: "harbor",
      monthsAgo: 6,
      day: 14,
      items: [
        { description: "Checkout redesign, phase 1", quantityHundredths: 100, unitPrice: 120_000 },
      ],
      kind: "void",
    },
    {
      client: "harbor",
      monthsAgo: 5,
      day: 16,
      items: [
        {
          description: "Checkout redesign, phase 1 (reissued)",
          quantityHundredths: 100,
          unitPrice: 110_000,
        },
      ],
    },
    {
      client: "harbor",
      monthsAgo: 2,
      day: 1,
      items: [
        { description: "Performance audit", quantityHundredths: 1200, unitPrice: 9_000 },
        { description: "Accessibility fixes", quantityHundredths: 600, unitPrice: 9_000 },
      ],
      kind: "overdue",
    },
    {
      client: "lumen",
      monthsAgo: 7,
      day: 8,
      items: [
        { description: "Design system components", quantityHundredths: 1400, unitPrice: 5_000 },
      ],
    },
    {
      client: "lumen",
      monthsAgo: 3,
      day: 12,
      items: [
        { description: "Storybook documentation", quantityHundredths: 800, unitPrice: 5_000 },
      ],
    },
    {
      client: "lumen",
      monthsAgo: 0,
      day: 1,
      items: [
        {
          description: "Design system components, round 2",
          quantityHundredths: 1000,
          unitPrice: 5_000,
        },
        { description: "Hosting (pass-through)", quantityHundredths: 100, unitPrice: 2_000 },
      ],
      kind: "draft",
    },
  );
  return out;
}

function monthDate(today: CalendarDate, monthsAgo: number, day: number): CalendarDate {
  const [y, m] = today.split("-").map(Number);
  const index = y * 12 + (m - 1) - monthsAgo;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Plausible, invented rates in millionths. Not PTAX values. */
function fakeRate(currency: "USD" | "EUR", rand: () => number): number {
  const base = currency === "USD" ? 5_450_000 : 6_050_000;
  return base + Math.round((rand() - 0.5) * 500_000);
}

export async function createDemoData(db: Db, userId: string, today: CalendarDate): Promise<void> {
  const rand = mulberry32(20261125);

  await db.user.update({ where: { id: userId }, data: DEMO_SETTINGS });

  const clientIds = new Map<ClientKey, { id: string; currency: "USD" | "EUR"; terms: number }>();
  for (const c of CLIENTS) {
    const { key, ...data } = c;
    const created = await db.client.create({ data: { ...data, userId } });
    clientIds.set(key, { id: created.id, currency: c.defaultCurrency, terms: c.paymentTermsDays });
  }

  const planned = plan()
    .map((p) => {
      // Open invoices are dated so they fall due a few days from today, which
      // keeps the "due soon" reminder populated whatever day the demo starts.
      const terms = clientIds.get(p.client)!.terms;
      const issueDate =
        p.kind === "open"
          ? addDays(today, -(terms - (p.client === "bluefin" ? 3 : 6)))
          : monthDate(today, p.monthsAgo, p.day);
      return { ...p, issueDate };
    })
    .filter((p) => p.issueDate <= today)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  let number = 0;
  for (const p of planned) {
    const client = clientIds.get(p.client)!;
    const dueDate = addDays(p.issueDate, client.terms);
    const kind = p.kind ?? "paid";
    const isDraft = kind === "draft";
    if (!isDraft) number += 1;
    const total = p.items.reduce((t, i) => t + (i.unitPrice * i.quantityHundredths) / 100, 0);

    const payments: Prisma.PaymentCreateWithoutInvoiceInput[] = [];
    const paidOn = addDays(dueDate, -Math.floor(rand() * 6));
    if ((kind === "paid" || kind === "short") && paidOn <= today) {
      const amountReceived = kind === "short" ? total - 1_500 : total;
      const rateMicros = fakeRate(client.currency, rand);
      // The bank's spread: about 1.5% below the reference rate, plus a flat fee.
      const gross = convert(amountReceived, rateMicros);
      const feesBRL = 1_500 + Math.floor(rand() * 2_000);
      payments.push({
        user: { connect: { id: userId } },
        receivedDate: toDbDate(paidOn),
        amountReceived,
        amountBRL: percentOf(gross, 9_850) - feesBRL,
        feesBRL,
        rateMicros,
        rateDate: toDbDate(paidOn),
        rateSource: "MANUAL",
        settlesInvoice: kind === "short",
        note: kind === "short" ? "Intermediary bank kept €15.00" : "",
      });
    }

    await db.invoice.create({
      data: {
        userId,
        clientId: client.id,
        number: isDraft ? null : number,
        status: isDraft ? "DRAFT" : kind === "void" ? "VOID" : "SENT",
        issueDate: toDbDate(p.issueDate),
        dueDate: toDbDate(dueDate),
        currency: client.currency,
        nfseNumber: isDraft || kind === "void" ? "" : String(2026_000 + number),
        taxTreatmentNote:
          client.currency === "EUR" ? "Export of services (example note from the accountant)" : "",
        items: { create: p.items.map((item, position) => ({ ...item, position })) },
        payments: { create: payments },
      },
    });
  }

  await db.user.update({ where: { id: userId }, data: { lastInvoiceNumber: number } });
}
