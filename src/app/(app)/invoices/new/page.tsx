import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceForm } from "@/components/InvoiceForm";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { btn } from "@/components/ui";
import { addDays, todayInBrazil } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { listClients } from "@/server/clients";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const user = await requireUser();
  const clients = await listClients(user.id);
  const { client: wanted } = await searchParams;

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="New invoice" />
        <EmptyState title="Add a client first">
          <p>Every invoice belongs to a client.</p>
          <Link href="/clients/new" className={`${btn.primary} mt-4`}>
            Add a client
          </Link>
        </EmptyState>
      </>
    );
  }

  const client = clients.find((c) => c.id === wanted) ?? clients[0];
  // "Today" in Brazil, so an invoice made late on the 31st is dated the 31st.
  const today = todayInBrazil();
  return (
    <>
      <PageHeader
        title="New invoice"
        description="Saved as a draft. It gets a number when you mark it as sent."
      />
      <InvoiceForm
        invoiceId={null}
        clients={clients}
        defaultValues={{
          clientId: client.id,
          currency: client.defaultCurrency,
          issueDate: today,
          dueDate: addDays(today, client.paymentTermsDays),
          items: [{ description: "", quantity: "1", unitPrice: "" }],
          notes: "",
          taxTreatmentNote: "",
          nfseNumber: "",
        }}
      />
    </>
  );
}
