"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "./action-result";

/** Put the server's field errors back on the form. Returns the form-level message, if any. */
export function applyServerErrors<T extends FieldValues>(
  result: ActionResult,
  setError: UseFormSetError<T>,
): string | undefined {
  if (result.ok) return undefined;
  for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
    if (path !== "_form") setError(path as Path<T>, { type: "server", message });
  }
  return (
    result.error ??
    (result.fieldErrors?._form ||
      (result.fieldErrors ? "Please fix the highlighted fields." : undefined))
  );
}
