import type { Metadata } from "next";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="New client" />
      <ClientForm
        clientId={null}
        defaultValues={{
          name: "",
          country: "",
          email: "",
          address: "",
          defaultCurrency: "USD",
          paymentTermsDays: "30",
        }}
      />
    </>
  );
}
