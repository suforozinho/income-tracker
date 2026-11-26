import type { Metadata } from "next";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/PageHeader";
import { orNotFound } from "@/lib/action";
import { requireUser } from "@/lib/session";
import { getClient } from "@/server/clients";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const client = await orNotFound(getClient(user.id, id));
  return (
    <>
      <PageHeader title={`Edit ${client.name}`} />
      <ClientForm
        clientId={client.id}
        defaultValues={{
          name: client.name,
          country: client.country,
          email: client.email,
          address: client.address,
          defaultCurrency: client.defaultCurrency,
          paymentTermsDays: String(client.paymentTermsDays),
        }}
      />
    </>
  );
}
