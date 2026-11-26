import type { Metadata } from "next";
import Link from "next/link";
import { DeletePaymentButton, InvoiceActions } from "@/components/InvoiceActions";
import { InvoiceDetailsForm } from "@/components/InvoiceDetailsForm";
import { StatusBadge } from "@/components/StatusBadge";
import { card, link, muted } from "@/components/ui";
import { orNotFound } from "@/lib/action";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatQuantity, formatRate, convert, subtract } from "@/lib/money";
import { requireUser } from "@/lib/session";
import type { PaymentDTO, Currency } from "@/lib/types";
import { getInvoice } from "@/server/invoices";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await orNotFound(getInvoice(user.id, id));
  const canPay = invoice.storedStatus === "SENT" && invoice.balance > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm">
            <Link href="/invoices" className={link}>
              Invoices
            </Link>
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {invoice.numberLabel}
            <StatusBadge status={invoice.status} />
          </h1>
          <p className={`mt-1 text-sm ${muted}`}>
            {invoice.client.name} · issued {formatDate(invoice.issueDate)} · due{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          storedStatus={invoice.storedStatus}
          canPay={canPay}
          hasPayments={invoice.payments.length > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="items-heading" className={`${card} overflow-x-auto`}>
          <h2 id="items-heading" className="mb-3 font-semibold">
            Items
          </h2>
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="text-left text-xs text-slate-600 uppercase dark:text-slate-400">
              <tr>
                <th scope="col" className="py-2 pr-2 font-medium">
                  Description
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Unit price
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-2 whitespace-pre-line">{item.description}</td>
                  <td className="tabular px-2 py-2 text-right">
                    {formatQuantity(item.quantityHundredths)}
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    {formatMoney(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="tabular py-2 pl-2 text-right">
                    {formatMoney(item.lineTotal, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 dark:border-slate-700">
              <Row label="Total" value={formatMoney(invoice.total, invoice.currency)} strong />
              {invoice.storedStatus === "SENT" && (
                <>
                  <Row label="Paid" value={formatMoney(invoice.paid, invoice.currency)} />
                  <Row
                    label="Balance due"
                    value={formatMoney(invoice.balance, invoice.currency)}
                    strong
                  />
                </>
              )}
            </tfoot>
          </table>
          {invoice.notes && (
            <p className={`mt-4 text-sm whitespace-pre-line ${muted}`}>{invoice.notes}</p>
          )}
        </section>

        <section aria-labelledby="details-heading" className={card}>
          <h2 id="details-heading" className="mb-3 font-semibold">
            Details
          </h2>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className={muted}>Client</dt>
            <dd>
              <Link href={`/clients/${invoice.client.id}`} className={link}>
                {invoice.client.name}
              </Link>
            </dd>
            <dt className={muted}>Country</dt>
            <dd>{invoice.client.country}</dd>
            <dt className={muted}>Currency</dt>
            <dd>{invoice.currency}</dd>
          </dl>
          {invoice.storedStatus === "DRAFT" ? (
            <dl className="grid gap-1 text-sm">
              <dt className={muted}>NFS-e number</dt>
              <dd>{invoice.nfseNumber || "—"}</dd>
              <dt className={muted}>Tax treatment note</dt>
              <dd className="whitespace-pre-line">{invoice.taxTreatmentNote || "—"}</dd>
            </dl>
          ) : invoice.storedStatus === "SENT" ? (
            <InvoiceDetailsForm
              invoiceId={invoice.id}
              defaultValues={{
                nfseNumber: invoice.nfseNumber,
                taxTreatmentNote: invoice.taxTreatmentNote,
                notes: invoice.notes,
              }}
            />
          ) : (
            <p className={`text-sm ${muted}`}>This invoice is void. It keeps its number.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="payments-heading" className={card}>
        <h2 id="payments-heading" className="mb-3 font-semibold">
          Payments
        </h2>
        {invoice.payments.length === 0 ? (
          <p className={`text-sm ${muted}`}>
            {invoice.storedStatus === "DRAFT"
              ? "Mark the invoice as sent to record payments."
              : invoice.storedStatus === "VOID"
                ? "Void invoices take no payments."
                : "No payments yet."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoice.payments.map((p) => (
              <PaymentRow key={p.id} payment={p} currency={invoice.currency} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <th
        scope="row"
        colSpan={3}
        className={`py-1.5 pr-2 text-right ${strong ? "font-semibold" : "font-normal"}`}
      >
        {label}
      </th>
      <td className={`tabular py-1.5 pl-2 text-right ${strong ? "font-semibold" : ""}`}>{value}</td>
    </tr>
  );
}

function PaymentRow({ payment: p, currency }: { payment: PaymentDTO; currency: Currency }) {
  const reference = p.rateMicros ? convert(p.amountReceived, p.rateMicros) : null;
  const difference = reference === null ? null : subtract(p.amountBRL, reference);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">
          {formatDate(p.receivedDate)} · {formatMoney(p.amountReceived, currency)} →{" "}
          <span className="tabular">{formatMoney(p.amountBRL, "BRL")}</span> received
        </p>
        <p className={muted}>
          {p.feesBRL > 0 && <>Fees {formatMoney(p.feesBRL, "BRL")} · </>}
          {p.rateMicros && p.rateDate ? (
            <>
              {p.rateSource === "PTAX" ? "PTAX closing sell rate" : "Rate entered by hand"}{" "}
              {formatRate(p.rateMicros)}
              {p.rateDate !== p.receivedDate && (
                <> (no bulletin that day, so the one from {formatDate(p.rateDate)})</>
              )}{" "}
              · reference {formatMoney(reference!, "BRL")} · difference{" "}
              <span className="tabular">
                {difference! > 0 ? "+" : ""}
                {formatMoney(difference!, "BRL")}
              </span>
            </>
          ) : (
            "No reference rate"
          )}
        </p>
        {p.settlesInvoice && <p className={muted}>Marked as settling the invoice in full.</p>}
        {p.note && <p className={muted}>{p.note}</p>}
      </div>
      <DeletePaymentButton paymentId={p.id} />
    </li>
  );
}
