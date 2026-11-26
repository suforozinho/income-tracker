import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/session";
import { isGuestUser } from "@/server/guest";

/** Everything in this group needs a signed-in user. Pages still check again for their own data. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isGuest = await isGuestUser(user.id);
  return (
    <>
      <AppHeader user={user} isGuest={isGuest} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
