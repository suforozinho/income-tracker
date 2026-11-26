"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/session";
import { settingsSchema } from "@/lib/validation";
import { updateSettings } from "@/server/settings";

export async function saveSettings(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(settingsSchema, raw, async (input) => {
    await updateSettings(user.id, input);
    revalidatePath("/", "layout");
  });
}
