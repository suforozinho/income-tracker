import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvoiceForm } from "@/components/InvoiceForm";
import { PageHeader } from "@/components/PageHeader";
import { orNotFound } from "@/lib/action";
import { formatQuantity, toMoneyInput } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { listClients } from "@/server/clients";
import { getInvoice } from "@/server/invoices";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await orNotFound(getInvoice(user.id, id));
  if (invoice.storedStatus !== "DRAFT") redirect(`/invoices/${id}`);

  const clients = await listClients(user.id);
  // Keep the invoice's client in the list even if it has since been archived.
  if (!clients.some((c) => c.id === invoice.client.id)) clients.push(invoice.client);

  return (
    <>
      <PageHeader title="Edit draft invoice" />
      <InvoiceForm
        invoiceId={invoice.id}
        clients={clients}
        defaultValues={{
          clientId: invoice.client.id,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          items: invoice.items.map((item) => ({
            description: item.description,
            quantity: formatQuantity(item.quantityHundredths),
            unitPrice: toMoneyInput(item.unitPrice),
          })),
          notes: invoice.notes,
          taxTreatmentNote: invoice.taxTreatmentNote,
          nfseNumber: invoice.nfseNumber,
        }}
      />
    </>
  );
}
