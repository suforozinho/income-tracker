"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt, runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/session";
import { clientSchema } from "@/lib/validation";
import { createClient, setClientArchived, updateClient } from "@/server/clients";

export async function saveClient(clientId: string | null, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(clientSchema, raw, async (input) => {
    if (clientId) await updateClient(user.id, clientId, input);
    else await createClient(user.id, input);
    revalidatePath("/", "layout");
    redirect("/clients");
  });
}

export async function archiveClient(clientId: string, archived: boolean): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await setClientArchived(user.id, clientId, archived);
    revalidatePath("/", "layout");
  });
}
