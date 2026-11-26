import "server-only";
import { notFound as nextNotFound } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import type { ZodType } from "zod";
import type { ActionResult } from "./action-result";
import { HttpError } from "./errors";
import { fieldErrors } from "./validation";

/**
 * Validate raw form values with the same schema the browser used, run the
 * mutation, and turn expected errors into a result the form can show.
 * The browser's own validation is a convenience; this is the check that counts.
 */
export async function runAction<T>(
  schema: ZodType<T>,
  raw: unknown,
  mutate: (input: T) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  return attempt(() => mutate(parsed.data));
}

/** Run a mutation and convert HttpErrors into a failed result. Redirects pass through. */
export async function attempt(mutate: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await mutate()) ?? { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** For pages: a 404 from the data layer becomes Next's not-found page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) nextNotFound();
    throw error;
  }
}
