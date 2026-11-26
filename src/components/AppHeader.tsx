import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import type { SessionUser } from "@/lib/session";
import { NavLinks } from "./NavLinks";

export function AppHeader({ user, isGuest }: { user: SessionUser; isGuest: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {isGuest && (
        <p className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-950 dark:bg-amber-900/60 dark:text-amber-100">
          Demo account with invented data. Changes are yours alone and vanish after 24 hours.
        </p>
      )}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"
        >
          <Logo />
          Income Tracker
        </Link>
        <div className="flex items-center gap-3 text-sm sm:order-last">
          {user.image && (
            <Image src={user.image} alt="" width={28} height={28} className="rounded-full" />
          )}
          <span className="hidden text-slate-700 sm:inline dark:text-slate-300">
            {user.name ?? "Signed in"}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
        <NavLinks />
      </div>
    </header>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="2" y="13" width="5" height="8" rx="1.2" className="fill-emerald-300" />
      <rect x="9.5" y="8" width="5" height="13" rx="1.2" className="fill-emerald-500" />
      <rect x="17" y="3" width="5" height="18" rx="1.2" className="fill-emerald-700" />
    </svg>
  );
}
