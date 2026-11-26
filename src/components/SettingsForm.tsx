"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { saveSettings } from "@/app/(app)/settings/actions";
import { CEILING_PRESETS } from "@/lib/ceiling";
import { formatMoney, toMoneyInput } from "@/lib/money";
import { applyServerErrors } from "@/lib/use-server-errors";
import { settingsSchema, type SettingsFormValues, type SettingsInput } from "@/lib/validation";
import { Field, fieldAria, FormError } from "./Field";
import { btn, card, input } from "./ui";

export function SettingsForm({ defaultValues }: { defaultValues: SettingsFormValues }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues, unknown, SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(() => {
    setFormError(undefined);
    setSaved(false);
    startTransition(async () => {
      const values = getValues();
      const result = await saveSettings(values);
      setFormError(applyServerErrors(result, setError));
      if (result.ok) {
        reset(values);
        setSaved(true);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6">
      <FormError message={formError} />

      <fieldset className={`${card} flex flex-col gap-4`}>
        <legend className="px-1 font-semibold">Revenue ceiling and set-aside</legend>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          These are your own numbers. The presets are the 2026 limits reported by accounting sites,
          not checked against an official source. Ask your accountant which limit applies to you and
          how export revenue counts toward it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="revenueCeiling"
            label="Yearly revenue ceiling (BRL)"
            error={errors.revenueCeiling?.message}
          >
            <input
              inputMode="decimal"
              {...register("revenueCeiling")}
              {...fieldAria("revenueCeiling", errors.revenueCeiling?.message)}
              className={`${input} tabular`}
            />
          </Field>
          <Field
            id="setAsidePercent"
            label="Set-aside percentage"
            hint="What you put aside from each payment. An estimate, not a tax calculation."
            error={errors.setAsidePercent?.message}
          >
            <input
              inputMode="decimal"
              {...register("setAsidePercent")}
              {...fieldAria("setAsidePercent", errors.setAsidePercent?.message, true)}
              className={`${input} tabular`}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Presets:</span>
          {CEILING_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={btn.secondary}
              onClick={() =>
                setValue("revenueCeiling", toMoneyInput(p.amountBRL), { shouldDirty: true })
              }
            >
              {p.label} ({formatMoney(p.amountBRL, "BRL", { compact: true })})
            </button>
          ))}
        </div>
        <Field
          id="regimeLabel"
          label="Tax regime label (optional)"
          hint='Just a note for yourself, like "MEI". The app never acts on it.'
          error={errors.regimeLabel?.message}
        >
          <input
            {...register("regimeLabel")}
            {...fieldAria("regimeLabel", errors.regimeLabel?.message, true)}
            className={`${input} max-w-xs`}
          />
        </Field>
      </fieldset>

      <fieldset className={`${card} flex flex-col gap-4`}>
        <legend className="px-1 font-semibold">Printed on your invoices</legend>
        <Field id="businessName" label="Business name" error={errors.businessName?.message}>
          <input
            {...register("businessName")}
            {...fieldAria("businessName", errors.businessName?.message)}
            className={input}
          />
        </Field>
        <Field
          id="businessDetails"
          label="Business details"
          hint="Address, tax id (CNPJ), contact email. One per line."
          error={errors.businessDetails?.message}
        >
          <textarea
            rows={4}
            {...register("businessDetails")}
            {...fieldAria("businessDetails", errors.businessDetails?.message, true)}
            className={input}
          />
        </Field>
        <Field
          id="paymentInstructions"
          label="Payment instructions"
          hint="Bank and wire details for your client. Never put real details in a demo or a screenshot."
          error={errors.paymentInstructions?.message}
        >
          <textarea
            rows={5}
            {...register("paymentInstructions")}
            {...fieldAria("paymentInstructions", errors.paymentInstructions?.message, true)}
            className={input}
          />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        <span role="status" className="text-sm text-emerald-800 dark:text-emerald-300">
          {saved ? "Saved." : ""}
        </span>
      </div>
    </form>
  );
}
