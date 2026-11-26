import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";

/*
 * The one way server code learns who is signed in. Every page, server action
 * and route handler calls one of these, then passes the id to the functions in
 * src/server, which filter every query by it.
 */

export interface SessionUser {
  id: string;
  name: string | null;
  image: string | null;
}

/**
 * `connection()` keeps the read out of any prerender: Auth.js may re-encrypt
 * the session token, which needs randomness Next.js does not allow while
 * prerendering.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  await connection();
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  return { id: user.id, name: user.name ?? null, image: user.image ?? null };
}

/** For pages and server actions: send signed-out visitors to the landing page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/");
  return user;
}
