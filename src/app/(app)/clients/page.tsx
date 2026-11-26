import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveClientButton } from "@/components/ArchiveClientButton";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { btn, card, link } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { listClients } from "@/server/clients";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await listClients(user.id, { includeArchived: true });

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Link href="/clients/new" className={btn.primary}>
            Add client
          </Link>
        }
      />
      {clients.length === 0 ? (
        <EmptyState title="No clients yet">
          <p>Add the companies you bill. Each one has a currency and payment terms.</p>
          <Link href="/clients/new" className={`${btn.primary} mt-4`}>
            Add your first client
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className={`${card} flex flex-col gap-2 ${c.archived ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    <Link href={`/clients/${c.id}`} className={link}>
                      {c.name}
                    </Link>
                    {c.archived && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        Archived
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {c.country} · {c.defaultCurrency} · {c.paymentTermsDays} days
                  </p>
                </div>
                <ArchiveClientButton clientId={c.id} archived={c.archived} name={c.name} />
              </div>
              <Link href={`/invoices?client=${c.id}`} className={`${link} text-sm`}>
                View invoices
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
