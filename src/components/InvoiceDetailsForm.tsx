"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { saveInvoiceDetails } from "@/app/(app)/invoices/actions";
import { applyServerErrors } from "@/lib/use-server-errors";
import { invoiceDetailsSchema, type InvoiceDetailsInput } from "@/lib/validation";
import { Field, fieldAria, FormError } from "./Field";
import { btn, input } from "./ui";

/** On a sent invoice, only the NFS-e number and the notes can change. */
export function InvoiceDetailsForm({
  invoiceId,
  defaultValues,
}: {
  invoiceId: string;
  defaultValues: InvoiceDetailsInput;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<InvoiceDetailsInput>({ resolver: zodResolver(invoiceDetailsSchema), defaultValues });

  const onSubmit = handleSubmit(() => {
    setFormError(undefined);
    setMessage(undefined);
    startTransition(async () => {
      const values = getValues();
      const result = await saveInvoiceDetails(invoiceId, values);
      setFormError(applyServerErrors(result, setError));
      if (result.ok) {
        reset(values);
        setMessage("Saved.");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormError message={formError} />
      <Field
        id="nfseNumber"
        label="NFS-e number"
        hint="From your city's system."
        error={errors.nfseNumber?.message}
      >
        <input
          {...register("nfseNumber")}
          {...fieldAria("nfseNumber", errors.nfseNumber?.message, true)}
          className={input}
        />
      </Field>
      <Field
        id="taxTreatmentNote"
        label="Tax treatment note (private)"
        error={errors.taxTreatmentNote?.message}
      >
        <textarea
          {...register("taxTreatmentNote")}
          {...fieldAria("taxTreatmentNote", errors.taxTreatmentNote?.message)}
          rows={2}
          className={input}
        />
      </Field>
      <Field id="notes" label="Notes printed on the invoice" error={errors.notes?.message}>
        <textarea
          {...register("notes")}
          {...fieldAria("notes", errors.notes?.message)}
          rows={2}
          className={input}
        />
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !isDirty} className={btn.secondary}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <span role="status" className="text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </span>
      </div>
    </form>
  );
}
