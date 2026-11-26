import type { Metadata } from "next";
import Link from "next/link";
import { MonthlyIncomeChart } from "@/components/MonthlyIncomeChart";
import { PageHeader } from "@/components/PageHeader";
import { btn, card, link, muted } from "@/components/ui";
import { formatDate, formatMonth, monthKey, yearOf, todayInBrazil } from "@/lib/dates";
import { formatMoney, ratio, toDecimalString } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getDashboard, type DashboardData, type Reminder } from "@/server/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const today = todayInBrazil();
  const { year: yearParam } = await searchParams;
  const parsed = Number(Array.isArray(yearParam) ? yearParam[0] : yearParam);
  const year = Number.isInteger(parsed) && parsed > 2000 && parsed < 2100 ? parsed : yearOf(today);
  const data = await getDashboard(user.id, year, today);

  const thisMonth = data.monthly.find((m) => m.month === monthKey(today));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Income counted by the day the money arrived, in reais received. Today in Brazil: ${formatDate(today)}.`}
        actions={
          <>
            <YearPicker years={data.availableYears} current={year} />
            <Link href="/invoices/new" className={btn.primary}>
              New invoice
            </Link>
          </>
        }
      />

      <div className="grid gap-4">
        <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={data.isCurrentYear ? `Income in ${year} so far` : `Income in ${year}`}
            value={formatMoney(data.totalBRL, "BRL")}
            note={`${data.paymentCount} payment${data.paymentCount === 1 ? "" : "s"} · fees ${formatMoney(data.feesBRL, "BRL")}`}
            testId="ytd-total"
          />
          {data.isCurrentYear && (
            <Stat
              label={`Income in ${formatMonth(monthKey(today))}`}
              value={formatMoney(thisMonth?.amountBRL ?? 0, "BRL")}
            />
          )}
          <Stat
            label={`Set-aside estimate (${toDecimalString(data.setAside.basisPoints, 2).replace(/\.?0+$/, "")}%)`}
            value={formatMoney(data.setAside.amountBRL, "BRL")}
            note="Not tax advice. Your percentage times your income."
          />
          <Stat
            label="Owed to you"
            value={
              data.outstanding.length === 0
                ? "Nothing"
                : data.outstanding.map((o) => formatMoney(o.amount, o.currency)).join(" + ")
            }
            note={
              data.outstanding.length
                ? `${data.outstanding.reduce((n, o) => n + o.count, 0)} open invoice(s)`
                : undefined
            }
          />
        </section>

        <Ceiling data={data} />

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section aria-labelledby="monthly-heading" className={card}>
            <h2 id="monthly-heading" className="font-semibold">
              Income per month, {year} (BRL)
            </h2>
            <p className={`mb-3 text-sm ${muted}`}>Reais that reached your bank account.</p>
            {data.paymentCount === 0 ? (
              <p className={`py-16 text-center text-sm ${muted}`}>
                No payments recorded in {year} yet.
              </p>
            ) : (
              <MonthlyIncomeChart data={data.monthly} />
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-700 dark:text-slate-300">
                Show as a table
              </summary>
              <table className="mt-2 w-full max-w-sm">
                <caption className="sr-only">Income per month, {year}</caption>
                <thead>
                  <tr className={`text-left ${muted}`}>
                    <th scope="col" className="py-1 font-medium">
                      Month
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Received
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Fees
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={m.month}>
                      <th scope="row" className="py-0.5 text-left font-normal">
                        {formatMonth(m.month, true)}
                      </th>
                      <td className="tabular py-0.5 text-right">
                        {formatMoney(m.amountBRL, "BRL")}
                      </td>
                      <td className="tabular py-0.5 text-right">{formatMoney(m.feesBRL, "BRL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <Reminders reminders={data.reminders} />
        </div>

        <ByClient data={data} />
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  note,
  testId,
}: {
  label: string;
  value: string;
  note?: string;
  testId?: string;
}) {
  return (
    <div className={card}>
      <p className={`text-sm ${muted}`}>{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight" data-testid={testId}>
        {value}
      </p>
      {note && <p className={`mt-1 text-xs ${muted}`}>{note}</p>}
    </div>
  );
}

function YearPicker({ years, current }: { years: number[]; current: number }) {
  if (years.length < 2) return null;
  return (
    <nav
      aria-label="Year"
      className="flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
    >
      {years.map((y) => (
        <Link
          key={y}
          href={`/dashboard?year=${y}`}
          aria-current={y === current ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            y === current
              ? "bg-emerald-700 text-white"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}

const levelStyles = {
  ok: { bar: "bg-emerald-600", box: "", icon: null, text: "" },
  warning: {
    bar: "bg-amber-500",
    box: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    icon: "⚠",
    text: "You have passed 80% of your revenue ceiling.",
  },
  exceeded: {
    bar: "bg-red-600",
    box: "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
    icon: "⛔",
    text: "You have reached your revenue ceiling.",
  },
};

function Ceiling({ data }: { data: DashboardData }) {
  const { ceiling, totalBRL, year } = data;
  const style = levelStyles[ceiling.level];
  const percent = Math.round(ratio(totalBRL, ceiling.amountBRL) * 1000) / 10;
  return (
    <section aria-labelledby="ceiling-heading" className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ceiling-heading" className="font-semibold">
          Revenue ceiling, {year}
        </h2>
        <p className="tabular text-sm">
          <strong>{formatMoney(totalBRL, "BRL")}</strong> of {formatMoney(ceiling.amountBRL, "BRL")}{" "}
          <span className={muted}>({percent}%)</span>
        </p>
      </div>
      <div
        role="meter"
        aria-label="Income against your revenue ceiling"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        aria-valuetext={`${percent}% of your ceiling`}
        className="relative mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div
          className={`h-full rounded-full ${style.bar}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
        <div className="absolute inset-y-0 left-[80%] w-0.5 bg-slate-500" title="80%" />
      </div>
      <div className={`mt-1 flex justify-between text-xs ${muted}`}>
        <span>
          {ceiling.level === "exceeded"
            ? "Over by " + formatMoney(totalBRL - ceiling.amountBRL, "BRL")
            : `${formatMoney(ceiling.remainingBRL, "BRL")} left`}
        </span>
        <span>Warning at 80%</span>
      </div>
      {ceiling.level !== "ok" && (
        <p
          role="alert"
          data-testid="ceiling-alert"
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${style.box}`}
        >
          <span aria-hidden="true">{style.icon}</span>
          <span>
            <strong>{style.text}</strong> This is the limit you set in{" "}
            <Link href="/settings" className="underline">
              settings
            </Link>
            . Talk to your accountant about what it means for your regime.
          </span>
        </p>
      )}
    </section>
  );
}

const reminderStyle: Record<Reminder["kind"], { label: string; className: string }> = {
  overdue: {
    label: "Overdue",
    className:
      "bg-red-50 text-red-900 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-800",
  },
  due_soon: {
    label: "Due soon",
    className:
      "bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  },
  tax: {
    label: "Tax",
    className:
      "bg-sky-50 text-sky-900 ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  },
};

function when(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 0) return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${-days} days ago`;
}

function Reminders({ reminders }: { reminders: Reminder[] }) {
  return (
    <section aria-labelledby="reminders-heading" className={card}>
      <h2 id="reminders-heading" className="mb-3 font-semibold">
        Reminders
      </h2>
      <ul className="flex flex-col gap-3">
        {reminders.map((r) => (
          <li key={`${r.kind}-${r.invoiceId ?? r.date}`} className="flex flex-col gap-0.5 text-sm">
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${reminderStyle[r.kind].className}`}
              >
                {reminderStyle[r.kind].label}
              </span>
              {r.invoiceId ? (
                <Link href={`/invoices/${r.invoiceId}`} className={link}>
                  {r.label}
                </Link>
              ) : (
                <span className="font-medium">{r.label}</span>
              )}
            </span>
            <span className={muted}>
              {r.kind === "tax" ? "Due " : r.kind === "overdue" ? "Was due " : "Due "}
              {formatDate(r.date)} ({when(r.days)})
              {r.amount !== undefined && r.currency && <> · {formatMoney(r.amount, r.currency)}</>}
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-3 text-xs ${muted}`}>
        The tax date is the 20th, moved to Monday when it falls on a weekend. Holidays are not taken
        into account.
      </p>
    </section>
  );
}

function ByClient({ data }: { data: DashboardData }) {
  const max = data.byClient[0]?.amountBRL ?? 0;
  return (
    <section aria-labelledby="clients-heading" className={card}>
      <h2 id="clients-heading" className="mb-3 font-semibold">
        Income by client, {data.year} (BRL)
      </h2>
      {data.byClient.length === 0 ? (
        <p className={`text-sm ${muted}`}>No payments in {data.year}.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.byClient.map((c) => (
            <li
              key={c.clientId}
              className="grid gap-1 text-sm sm:grid-cols-[14rem_1fr_11rem] sm:items-center sm:gap-3"
            >
              <span className="truncate font-medium">{c.name}</span>
              <span className="h-3 rounded-r bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                <span
                  className="block h-full rounded-r-[4px] bg-[#059669]"
                  style={{ width: `${Math.max(1, ratio(c.amountBRL, max) * 100)}%` }}
                />
              </span>
              <span className="tabular sm:text-right">
                {formatMoney(c.amountBRL, "BRL")}{" "}
                <span className={muted}>
                  ({Math.round(ratio(c.amountBRL, data.totalBRL) * 100)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
