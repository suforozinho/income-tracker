import { STATUS_LABELS, type DisplayStatus } from "@/lib/invoice-status";

const styles: Record<DisplayStatus, string> = {
  draft:
    "bg-slate-100 text-slate-800 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600",
  sent: "bg-sky-50 text-sky-900 ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  partly_paid:
    "bg-violet-50 text-violet-900 ring-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  paid: "bg-emerald-50 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  overdue:
    "bg-red-50 text-red-900 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-800",
  void: "bg-slate-100 text-slate-700 ring-slate-300 line-through dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
