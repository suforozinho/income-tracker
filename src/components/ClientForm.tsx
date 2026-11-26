"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { saveClient } from "@/app/(app)/clients/actions";
import { applyServerErrors } from "@/lib/use-server-errors";
import {
  clientSchema,
  CURRENCIES,
  type ClientFormValues,
  type ClientInput,
} from "@/lib/validation";
import { Field, fieldAria, FormError } from "./Field";
import { btn, input } from "./ui";

export function ClientForm({
  clientId,
  defaultValues,
}: {
  clientId: string | null;
  defaultValues: ClientFormValues;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<ClientFormValues, unknown, ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(() => {
    setFormError(undefined);
    startTransition(async () => {
      // Send the raw strings: the server parses them again with the same schema.
      const result = await saveClient(clientId, getValues());
      setFormError(applyServerErrors(result, setError));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name?.message}>
          <input
            {...register("name")}
            {...fieldAria("name", errors.name?.message)}
            className={input}
            autoComplete="organization"
          />
        </Field>
        <Field id="country" label="Country" error={errors.country?.message}>
          <input
            {...register("country")}
            {...fieldAria("country", errors.country?.message)}
            className={input}
            autoComplete="country-name"
          />
        </Field>
        <Field id="email" label="Billing email (optional)" error={errors.email?.message}>
          <input
            {...register("email")}
            {...fieldAria("email", errors.email?.message)}
            type="email"
            className={input}
          />
        </Field>
        <Field id="defaultCurrency" label="Currency" error={errors.defaultCurrency?.message}>
          <select
            {...register("defaultCurrency")}
            {...fieldAria("defaultCurrency", errors.defaultCurrency?.message)}
            className={input}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field
          id="paymentTermsDays"
          label="Payment terms (days)"
          error={errors.paymentTermsDays?.message}
          hint="Used to suggest the due date on new invoices."
        >
          <input
            {...register("paymentTermsDays")}
            {...fieldAria("paymentTermsDays", errors.paymentTermsDays?.message, true)}
            inputMode="numeric"
            className={input}
          />
        </Field>
      </div>
      <Field
        id="address"
        label="Address (optional)"
        error={errors.address?.message}
        hint="Printed on the invoice."
      >
        <textarea
          {...register("address")}
          {...fieldAria("address", errors.address?.message, true)}
          rows={3}
          className={input}
        />
      </Field>
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : clientId ? "Save changes" : "Add client"}
        </button>
        <Link href="/clients" className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
