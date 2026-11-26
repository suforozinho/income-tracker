"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { saveInvoice } from "@/app/(app)/invoices/actions";
import { addDays, isCalendarDate } from "@/lib/dates";
import { lineTotal } from "@/lib/invoice-status";
import { formatMoney, parseDecimal, parseMoney, sum } from "@/lib/money";
import type { ClientDTO, Currency } from "@/lib/types";
import { applyServerErrors } from "@/lib/use-server-errors";
import {
  CURRENCIES,
  invoiceSchema,
  MAX_ITEMS,
  type InvoiceFormValues,
  type InvoiceInput,
} from "@/lib/validation";
import { Field, fieldAria, FormError } from "./Field";
import { btn, input } from "./ui";

type FormControl = Control<InvoiceFormValues, unknown, InvoiceInput>;

const emptyItem = { description: "", quantity: "1", unitPrice: "" };

/** Same helpers as the server and the PDF, so the live total always matches. */
function liveLineTotal(item: { quantity?: string; unitPrice?: string } | undefined): number | null {
  const q = parseDecimal(item?.quantity ?? "", 2);
  const p = parseMoney(item?.unitPrice ?? "");
  if (q === null || p === null || q < 0 || p < 0) return null;
  return lineTotal({ quantityHundredths: q, unitPrice: p });
}

export function InvoiceForm({
  invoiceId,
  clients,
  defaultValues,
}: {
  invoiceId: string | null;
  clients: ClientDTO[];
  defaultValues: InvoiceFormValues;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [dueTouched, setDueTouched] = useState(invoiceId !== null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<InvoiceFormValues, unknown, InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function suggestDueDate(clientId: string, issueDate: string) {
    const client = clients.find((c) => c.id === clientId);
    if (!dueTouched && client && isCalendarDate(issueDate)) {
      setValue("dueDate", addDays(issueDate, client.paymentTermsDays));
    }
  }

  const onSubmit = handleSubmit(() => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveInvoice(invoiceId, getValues());
      setFormError(applyServerErrors(result, setError));
    });
  });

  const clientField = register("clientId", {
    onChange: (e) => {
      const client = clients.find((c) => c.id === e.target.value);
      if (client) setValue("currency", client.defaultCurrency);
      suggestDueDate(e.target.value, getValues("issueDate"));
    },
  });
  const issueField = register("issueDate", {
    onChange: (e) => suggestDueDate(getValues("clientId"), e.target.value),
  });
  const dueField = register("dueDate", { onChange: () => setDueTouched(true) });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormError message={formError} />

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Client and dates</legend>
        <Field
          id="clientId"
          label="Client"
          error={errors.clientId?.message}
          className="sm:col-span-2"
        >
          <select
            {...clientField}
            {...fieldAria("clientId", errors.clientId?.message)}
            className={input}
          >
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="currency"
          label="Currency"
          error={errors.currency?.message}
          className="sm:col-span-2"
        >
          <select
            {...register("currency")}
            {...fieldAria("currency", errors.currency?.message)}
            className={input}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field
          id="issueDate"
          label="Issue date"
          error={errors.issueDate?.message}
          className="sm:col-span-2"
        >
          <input
            type="date"
            {...issueField}
            {...fieldAria("issueDate", errors.issueDate?.message)}
            className={input}
          />
        </Field>
        <Field
          id="dueDate"
          label="Due date"
          error={errors.dueDate?.message}
          className="sm:col-span-2"
        >
          <input
            type="date"
            {...dueField}
            {...fieldAria("dueDate", errors.dueDate?.message)}
            className={input}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-base font-semibold">Items</legend>
        {errors.items?.root?.message || errors.items?.message ? (
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {errors.items?.root?.message ?? errors.items?.message}
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const e = errors.items?.[index];
            return (
              <li
                key={field.id}
                className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_7rem_9rem_8rem_auto] sm:items-start dark:border-slate-800 dark:bg-slate-900"
              >
                <Field
                  id={`items.${index}.description`}
                  label={`Item ${index + 1} description`}
                  error={e?.description?.message}
                  className="col-span-2 sm:col-span-1"
                >
                  <input
                    {...register(`items.${index}.description`)}
                    {...fieldAria(`items.${index}.description`, e?.description?.message)}
                    className={input}
                  />
                </Field>
                <Field id={`items.${index}.quantity`} label="Quantity" error={e?.quantity?.message}>
                  <input
                    {...register(`items.${index}.quantity`)}
                    {...fieldAria(`items.${index}.quantity`, e?.quantity?.message)}
                    inputMode="decimal"
                    className={`${input} tabular text-right`}
                  />
                </Field>
                <Field
                  id={`items.${index}.unitPrice`}
                  label="Unit price"
                  error={e?.unitPrice?.message}
                >
                  <input
                    {...register(`items.${index}.unitPrice`)}
                    {...fieldAria(`items.${index}.unitPrice`, e?.unitPrice?.message)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={`${input} tabular text-right`}
                  />
                </Field>
                <LineTotal control={control} index={index} />
                <div className="flex items-end sm:pt-6">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className={btn.ghost}
                    aria-label={`Remove item ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => append(emptyItem)}
            disabled={fields.length >= MAX_ITEMS}
            className={btn.secondary}
          >
            Add item
          </button>
          <InvoiceTotal control={control} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Notes</legend>
        <Field
          id="notes"
          label="Notes on the invoice (optional)"
          hint="Printed on the PDF, e.g. a project reference."
          error={errors.notes?.message}
        >
          <textarea
            {...register("notes")}
            {...fieldAria("notes", errors.notes?.message, true)}
            rows={3}
            className={input}
          />
        </Field>
        <Field
          id="taxTreatmentNote"
          label="Tax treatment note (private)"
          hint="What your accountant told you about this invoice. Not printed."
          error={errors.taxTreatmentNote?.message}
        >
          <textarea
            {...register("taxTreatmentNote")}
            {...fieldAria("taxTreatmentNote", errors.taxTreatmentNote?.message, true)}
            rows={3}
            className={input}
          />
        </Field>
        <Field
          id="nfseNumber"
          label="NFS-e number (optional)"
          hint="From your city's system, once issued."
          error={errors.nfseNumber?.message}
        >
          <input
            {...register("nfseNumber")}
            {...fieldAria("nfseNumber", errors.nfseNumber?.message, true)}
            className={input}
          />
        </Field>
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : "Save draft"}
        </button>
        <Link href={invoiceId ? `/invoices/${invoiceId}` : "/invoices"} className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function LineTotal({ control, index }: { control: FormControl; index: number }) {
  const item = useWatch({ control, name: `items.${index}` });
  const currency = useWatch({ control, name: "currency" }) as Currency;
  const total = liveLineTotal(item);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Amount</span>
      <output className="tabular py-2 text-right text-sm" aria-label={`Item ${index + 1} amount`}>
        {total === null ? "—" : formatMoney(total, currency)}
      </output>
    </div>
  );
}

function InvoiceTotal({ control }: { control: FormControl }) {
  const items = useWatch({ control, name: "items" });
  const currency = useWatch({ control, name: "currency" }) as Currency;
  const lines = items.map(liveLineTotal);
  const complete = lines.every((l) => l !== null);
  return (
    <p className="text-lg font-semibold" aria-live="polite">
      Total{" "}
      <output data-testid="invoice-total" className="tabular">
        {complete ? formatMoney(sum(lines as number[]), currency) : "—"}
      </output>
    </p>
  );
}
