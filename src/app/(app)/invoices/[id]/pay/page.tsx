import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PaymentForm } from "@/components/PaymentForm";
import { link } from "@/components/ui";
import { orNotFound } from "@/lib/action";
import { todayInBrazil } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getInvoice } from "@/server/invoices";

export const metadata: Metadata = { title: "Record payment" };

export default async function PayInvoicePage({ params }: PageProps<"/invoices/[id]/pay">) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await orNotFound(getInvoice(user.id, id));

  if (invoice.storedStatus !== "SENT") {
    return (
      <>
        <PageHeader title="Record payment" />
        <p role="alert" className="mb-4">
          {invoice.storedStatus === "DRAFT"
            ? "This invoice is still a draft. Mark it as sent before recording a payment."
            : "This invoice is void, so it can't take payments."}
        </p>
        <Link href={`/invoices/${id}`} className={link}>
          Back to the invoice
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Record payment for ${invoice.numberLabel}`}
        description={`${invoice.client.name} · balance due ${formatMoney(invoice.balance, invoice.currency)}`}
      />
      <PaymentForm
        invoiceId={invoice.id}
        currency={invoice.currency}
        balance={invoice.balance}
        today={todayInBrazil()}
      />
    </>
  );
}
