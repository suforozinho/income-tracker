/** What a server action returns to a form. Success usually redirects instead. */
export type ActionResult =
  { ok: true; id?: string } | { ok: false; error?: string; fieldErrors?: Record<string, string> };
