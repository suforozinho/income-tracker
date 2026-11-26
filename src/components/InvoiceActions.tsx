"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteInvoiceAction,
  deletePaymentAction,
  duplicateInvoiceAction,
  sendInvoice,
  voidInvoiceAction,
} from "@/app/(app)/invoices/actions";
import type { ActionResult } from "@/lib/action-result";
import { FormError } from "./Field";
import { btn } from "./ui";

interface Props {
  invoiceId: string;
  storedStatus: "DRAFT" | "SENT" | "VOID";
  canPay: boolean;
  hasPayments: boolean;
}

export function InvoiceActions({ invoiceId, storedStatus, canPay, hasPayments }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function run(action: () => Promise<ActionResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {storedStatus === "DRAFT" && (
          <>
            <button
              type="button"
              className={btn.primary}
              disabled={pending}
              onClick={() =>
                run(
                  () => sendInvoice(invoiceId),
                  "Mark this invoice as sent? It gets the next invoice number and can no longer be edited.",
                )
              }
            >
              Mark as sent
            </button>
            <Link href={`/invoices/${invoiceId}/edit`} className={btn.secondary}>
              Edit
            </Link>
          </>
        )}
        {canPay && (
          <Link href={`/invoices/${invoiceId}/pay`} className={btn.primary}>
            Record payment
          </Link>
        )}
        <a href={`/invoices/${invoiceId}/pdf`} className={btn.secondary} download>
          Download PDF
        </a>
        <button
          type="button"
          className={btn.secondary}
          disabled={pending}
          onClick={() => run(() => duplicateInvoiceAction(invoiceId))}
        >
          Duplicate
        </button>
        {storedStatus === "SENT" && !hasPayments && (
          <button
            type="button"
            className={btn.danger}
            disabled={pending}
            onClick={() =>
              run(
                () => voidInvoiceAction(invoiceId),
                "Void this invoice? It keeps its number but no longer counts as owed.",
              )
            }
          >
            Void
          </button>
        )}
        {storedStatus === "DRAFT" && (
          <button
            type="button"
            className={btn.danger}
            disabled={pending}
            onClick={() => run(() => deleteInvoiceAction(invoiceId), "Delete this draft?")}
          >
            Delete
          </button>
        )}
      </div>
      <FormError message={error} />
    </div>
  );
}

export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={btn.ghost}
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this payment?")) return;
        startTransition(async () => {
          const result = await deletePaymentAction(paymentId);
          if (!result.ok) window.alert(result.error);
        });
      }}
    >
      Delete
    </button>
  );
}
