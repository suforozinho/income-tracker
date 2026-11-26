import Link from "next/link";
import { link } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-slate-600 dark:text-slate-400">
        That page does not exist, or it belongs to another account.
      </p>
      <Link href="/dashboard" className={link}>
        Back to the dashboard
      </Link>
    </div>
  );
}
