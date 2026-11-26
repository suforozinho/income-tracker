"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { recordPaymentAction } from "@/app/(app)/invoices/actions";
import { formatDate, isCalendarDate } from "@/lib/dates";
import {
  convert,
  formatMoney,
  formatRate,
  parseDecimal,
  parseMoney,
  subtract,
  toMoneyInput,
} from "@/lib/money";
import type { Currency, RateDTO } from "@/lib/types";
import { applyServerErrors } from "@/lib/use-server-errors";
import { paymentSchema, type PaymentFormValues, type PaymentInput } from "@/lib/validation";
import { Field, fieldAria, FormError } from "./Field";
import { btn, input } from "./ui";

type RateState =
  | { kind: "idle" }
  | { kind: "ok"; key: string; rate: RateDTO }
  | { kind: "error"; key: string; message: string };

export function PaymentForm({
  invoiceId,
  currency,
  balance,
  today,
}: {
  invoiceId: string;
  currency: Currency;
  balance: number;
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [rateState, setRateState] = useState<RateState>({ kind: "idle" });
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<PaymentFormValues, unknown, PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      receivedDate: today,
      amountReceived: toMoneyInput(balance),
      amountBRL: "",
      feesBRL: "",
      rateMode: "ptax",
      manualRate: "",
      settlesInvoice: false,
      note: "",
    },
  });

  const [receivedDate, rateMode, amountText, brlText, manualRate] = useWatch({
    control,
    name: ["receivedDate", "rateMode", "amountReceived", "amountBRL", "manualRate"],
  });

  // Fetch the PTAX reference whenever the date changes.
  const key = `${currency}:${receivedDate}`;
  const validDate = isCalendarDate(receivedDate) && receivedDate <= today;
  useEffect(() => {
    if (!validDate) return;
    const controller = new AbortController();
    fetch(`/api/rates?currency=${currency}&date=${receivedDate}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "The rate service is unavailable");
        setRateState({ kind: "ok", key, rate: body as RateDTO });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setRateState({ kind: "error", key, message: error.message });
        // Fall back to typing the rate, so the payment can still be recorded.
        if (getValues("rateMode") === "ptax") setValue("rateMode", "manual");
      });
    return () => controller.abort();
  }, [key, currency, receivedDate, validDate, getValues, setValue]);

  // Until the answer for this date arrives, the lookup is loading.
  const current =
    rateState.kind !== "idle" && rateState.key === key
      ? rateState
      : validDate
        ? ({ kind: "loading" } as const)
        : null;
  const amount = parseMoney(amountText ?? "");
  const brl = parseMoney(brlText ?? "");
  const rateMicros =
    rateMode === "ptax" && current?.kind === "ok"
      ? current.rate.sellMicros
      : rateMode === "manual"
        ? parseDecimal(manualRate ?? "", 6)
        : null;
  const reference =
    amount && amount > 0 && rateMicros && rateMicros > 0 ? convert(amount, rateMicros) : null;
  const isShort = amount !== null && amount > 0 && amount < balance;

  const onSubmit = handleSubmit(() => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await recordPaymentAction(invoiceId, getValues());
      setFormError(applyServerErrors(result, setError));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-5">
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="receivedDate"
          label="Date the money arrived"
          error={errors.receivedDate?.message}
        >
          <input
            type="date"
            max={today}
            {...register("receivedDate")}
            {...fieldAria("receivedDate", errors.receivedDate?.message)}
            className={input}
          />
        </Field>
        <Field
          id="amountReceived"
          label={`Amount paid by the client (${currency})`}
          error={errors.amountReceived?.message}
        >
          <input
            inputMode="decimal"
            {...register("amountReceived")}
            {...fieldAria("amountReceived", errors.amountReceived?.message)}
            className={`${input} tabular`}
          />
        </Field>
        <Field
          id="amountBRL"
          label="Reais that reached your account (BRL)"
          hint="From your bank statement. This is your income."
          error={errors.amountBRL?.message}
        >
          <input
            inputMode="decimal"
            placeholder="0.00"
            {...register("amountBRL")}
            {...fieldAria("amountBRL", errors.amountBRL?.message, true)}
            className={`${input} tabular`}
          />
        </Field>
        <Field
          id="feesBRL"
          label="Fees charged (BRL, optional)"
          hint="Bank or transfer fees, for your records."
          error={errors.feesBRL?.message}
        >
          <input
            inputMode="decimal"
            placeholder="0.00"
            {...register("feesBRL")}
            {...fieldAria("feesBRL", errors.feesBRL?.message, true)}
            className={`${input} tabular`}
          />
        </Field>
      </div>

      {isShort && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            {...register("settlesInvoice")}
            className="mt-0.5 size-4 accent-emerald-700"
          />
          <span>
            This settles the invoice. The client paid in full, but their bank or an intermediary
            kept {formatMoney(subtract(balance, amount!), currency)}.
          </span>
        </label>
      )}

      <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <legend className="px-1 font-semibold">Reference exchange rate</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="ptax"
              {...register("rateMode")}
              className="accent-emerald-700"
            />
            Banco Central PTAX
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="manual"
              {...register("rateMode")}
              className="accent-emerald-700"
            />
            Enter a rate by hand
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="none"
              {...register("rateMode")}
              className="accent-emerald-700"
            />
            No reference
          </label>
        </div>

        <div aria-live="polite" className="text-sm">
          {!validDate ? (
            <p className="text-slate-600 dark:text-slate-400">Choose a date to look up the rate.</p>
          ) : current?.kind === "loading" ? (
            <p className="text-slate-600 dark:text-slate-400">Looking up the PTAX rate…</p>
          ) : current?.kind === "error" ? (
            <p className="text-amber-900 dark:text-amber-200">
              Couldn&apos;t get the PTAX rate ({current.message}). Enter the rate by hand, or save
              without one.
            </p>
          ) : current?.kind === "ok" ? (
            <p>
              PTAX closing sell rate:{" "}
              <strong className="tabular">{formatRate(current.rate.sellMicros)}</strong> BRL per{" "}
              {currency}, bulletin of {formatDate(current.rate.rateDate)}.
              {current.rate.rateDate !== current.rate.requestedDate && (
                <>
                  {" "}
                  <span className="font-medium text-amber-900 dark:text-amber-200">
                    There is no bulletin on {formatDate(current.rate.requestedDate)} (weekend or
                    holiday), so this is the previous business day&apos;s rate.
                  </span>
                </>
              )}
            </p>
          ) : null}
        </div>

        {rateMode === "manual" && (
          <Field
            id="manualRate"
            label={`Rate (BRL per ${currency})`}
            hint="For example 5.4321"
            error={errors.manualRate?.message}
          >
            <input
              inputMode="decimal"
              {...register("manualRate")}
              {...fieldAria("manualRate", errors.manualRate?.message, true)}
              className={`${input} tabular max-w-40`}
            />
          </Field>
        )}

        {reference !== null && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-600 dark:text-slate-400">At the reference rate</dt>
            <dd className="tabular">{formatMoney(reference, "BRL")}</dd>
            <dt className="text-slate-600 dark:text-slate-400">You received</dt>
            <dd className="tabular">{brl !== null && brl > 0 ? formatMoney(brl, "BRL") : "—"}</dd>
            {brl !== null && brl > 0 && (
              <>
                <dt className="text-slate-600 dark:text-slate-400">Difference (spread and fees)</dt>
                <dd className="tabular font-medium">
                  {formatMoney(subtract(brl, reference), "BRL")} (
                  {((subtract(brl, reference) / reference) * 100).toFixed(2)}%)
                </dd>
              </>
            )}
          </dl>
        )}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          The rate is a reference only. Your income is the reais you typed above.
        </p>
      </fieldset>

      <Field id="note" label="Note (optional)" error={errors.note?.message}>
        <input
          {...register("note")}
          {...fieldAria("note", errors.note?.message)}
          className={input}
        />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : "Record payment"}
        </button>
        <Link href={`/invoices/${invoiceId}`} className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
