"use client";

import { btn } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-slate-600 dark:text-slate-400">
        The page could not be loaded. Your data is safe. Try again in a moment.
      </p>
      <button type="button" onClick={reset} className={btn.primary}>
        Try again
      </button>
    </div>
  );
}
