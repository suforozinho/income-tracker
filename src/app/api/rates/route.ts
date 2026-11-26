import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { getSessionUser } from "@/lib/session";
import { currencySchema } from "@/lib/validation";
import { getPtaxRate } from "@/server/rates";

const query = z.object({
  currency: currencySchema,
  date: z.string().refine(isCalendarDate, "Enter a valid date"),
});

/**
 * GET /api/rates?currency=USD&date=2026-11-21
 * The PTAX reference for the payment form. Signed-in users only, so the
 * endpoint can't be used as a free proxy to the Banco Central API.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const params = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!params.success) {
    return Response.json({ error: params.error.issues[0]?.message }, { status: 400 });
  }
  try {
    return Response.json(await getPtaxRate(params.data.currency, params.data.date));
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
