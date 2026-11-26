import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/AppHeader";
import { btn, card, muted } from "@/components/ui";
import { isDemoEnabled, isGitHubEnabled } from "@/lib/config";
import { getSessionUser } from "@/lib/session";
import { signInAsGuest, signInWithGitHub } from "./actions";

const features = [
  ["Invoices in USD and EUR", "Line items, due dates and a clean English PDF to send your client."],
  [
    "Payments in reais",
    "Record what actually reached your bank, next to the Banco Central PTAX rate.",
  ],
  [
    "Revenue ceiling",
    "Monthly and yearly income in BRL, with a warning at 80% and 100% of your limit.",
  ],
];

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Logo /> Income Tracker
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Bill foreign clients. See your income in reais.
        </h1>
        <p className={`max-w-xl text-lg ${muted}`}>
          For Brazilian contractors paid in dollars or euros. Create invoices, record each payment
          as it lands, and keep an eye on your yearly revenue ceiling.
        </p>
      </div>

      <Suspense fallback={<div className="h-11" />}>
        <SignInActions searchParams={searchParams} />
      </Suspense>

      <ul className="grid gap-4 sm:grid-cols-3">
        {features.map(([title, text]) => (
          <li key={title} className={card}>
            <h2 className="font-semibold">{title}</h2>
            <p className={`mt-1 text-sm ${muted}`}>{text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

async function SignInActions({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await getSessionUser();
  if (user) {
    return (
      <div>
        <Link href="/dashboard" className={`${btn.primary} px-5 py-2.5 text-base`}>
          Open your dashboard
        </Link>
      </div>
    );
  }

  const { error } = await searchParams;
  const github = isGitHubEnabled();
  const demo = isDemoEnabled();

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Sign-in did not work. Please try again.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {demo && (
          <form action={signInAsGuest}>
            <button type="submit" className={`${btn.primary} px-5 py-2.5 text-base`}>
              Try the demo
            </button>
          </form>
        )}
        {github && (
          <form action={signInWithGitHub}>
            <button
              type="submit"
              className={`${demo ? btn.secondary : btn.primary} px-5 py-2.5 text-base`}
            >
              Sign in with GitHub
            </button>
          </form>
        )}
        {!demo && !github && (
          <p className={`text-sm ${muted}`}>
            No sign-in method is configured. See the README to set up GitHub sign-in.
          </p>
        )}
      </div>
      {demo && (
        <p className={`text-sm ${muted}`}>
          The demo is filled with invented clients and amounts. Your copy is deleted after 24 hours.
        </p>
      )}
    </div>
  );
}
