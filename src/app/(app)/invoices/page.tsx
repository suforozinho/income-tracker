import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { btn, input, link } from "@/components/ui";
import { formatDate, todayInBrazil, yearOf } from "@/lib/dates";
import { STATUS_LABELS, type DisplayStatus } from "@/lib/invoice-status";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { listClients } from "@/server/clients";
import { listInvoices } from "@/server/invoices";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES = Object.keys(STATUS_LABELS) as DisplayStatus[];

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === one(sp.status));
  const clientId = one(sp.client) || undefined;
  const yearParam = Number(one(sp.year));
  const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : undefined;

  const today = todayInBrazil();
  const [invoices, clients] = await Promise.all([
    listInvoices(user.id, { status, clientId, year }, today),
    listClients(user.id, { includeArchived: true }),
  ]);
  const filtered = Boolean(status || clientId || year);
  const thisYear = yearOf(today);
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          clients.some((c) => !c.archived) ? (
            <Link href="/invoices/new" className={btn.primary}>
              New invoice
            </Link>
          ) : undefined
        }
      />

      <form
        method="get"
        aria-label="Filter invoices"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={status ?? ""} className={input}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Client
          <select name="client" defaultValue={clientId ?? ""} className={input}>
            <option value="">All</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Issued in
          <select name="year" defaultValue={year ?? ""} className={input}>
            <option value="">Any year</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={btn.secondary}>
          Apply
        </button>
        {filtered && (
          <Link href="/invoices" className={`${link} self-center text-sm`}>
            Clear filters
          </Link>
        )}
      </form>

      {invoices.length === 0 ? (
        filtered ? (
          <EmptyState title="No invoices match these filters" />
        ) : clients.length === 0 ? (
          <EmptyState title="No invoices yet">
            <p>Start by adding a client, then create your first invoice.</p>
            <Link href="/clients/new" className={`${btn.primary} mt-4`}>
              Add a client
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="No invoices yet">
            <Link href="/invoices/new" className={`${btn.primary} mt-2`}>
              Create your first invoice
            </Link>
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">Invoices</caption>
            <thead className="border-b border-slate-200 text-left text-xs text-slate-600 uppercase dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Number
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Client
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Issued
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Due
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/invoices/${inv.id}`} className={link}>
                      {inv.numberLabel}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{inv.client.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                    {formatMoney(inv.total, inv.currency)}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                    {inv.balance > 0 ? formatMoney(inv.balance, inv.currency) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
