"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt, runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/session";
import { invoiceDetailsSchema, invoiceSchema, paymentSchema } from "@/lib/validation";
import {
  createInvoice,
  deleteDraft,
  duplicateInvoice,
  markSent,
  updateDraft,
  updateInvoiceDetails,
  voidInvoice,
} from "@/server/invoices";
import { deletePayment, recordPayment } from "@/server/payments";

/*
 * Every action: who is signed in, validate on the server, call a data function
 * that filters by that user, then refresh the pages that show the change.
 */

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveInvoice(invoiceId: string | null, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(invoiceSchema, raw, async (input) => {
    let id = invoiceId;
    if (id) await updateDraft(user.id, id, input);
    else id = (await createInvoice(user.id, input)).id;
    refresh();
    redirect(`/invoices/${id}`);
  });
}

export async function saveInvoiceDetails(invoiceId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(invoiceDetailsSchema, raw, async (input) => {
    await updateInvoiceDetails(user.id, invoiceId, input);
    refresh();
  });
}

export async function sendInvoice(invoiceId: string): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await markSent(user.id, invoiceId);
    refresh();
  });
}

export async function voidInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await voidInvoice(user.id, invoiceId);
    refresh();
  });
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await deleteDraft(user.id, invoiceId);
    refresh();
    redirect("/invoices");
  });
}

export async function duplicateInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    const { id } = await duplicateInvoice(user.id, invoiceId);
    refresh();
    redirect(`/invoices/${id}/edit`);
  });
}

export async function recordPaymentAction(invoiceId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(paymentSchema, raw, async (input) => {
    await recordPayment(user.id, invoiceId, input);
    refresh();
    redirect(`/invoices/${invoiceId}`);
  });
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await deletePayment(user.id, paymentId);
    refresh();
  });
}
