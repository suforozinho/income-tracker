import { HttpError } from "@/lib/errors";
import { getSessionUser } from "@/lib/session";
import { pdfFilename, renderInvoicePdf } from "@/pdf/render";
import { getInvoice } from "@/server/invoices";
import { getSettings } from "@/server/settings";

/**
 * GET /invoices/:id/pdf
 * Checks the session, then loads the invoice filtered by that user. Another
 * user's invoice id gets the same 404 as one that does not exist.
 */
export async function GET(_req: Request, ctx: RouteContext<"/invoices/[id]/pdf">) {
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { id } = await ctx.params;
  try {
    const [invoice, business] = await Promise.all([getInvoice(user.id, id), getSettings(user.id)]);
    const pdf = await renderInvoicePdf(invoice, business);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename(invoice)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return new Response(error.message, { status: error.status });
    throw error;
  }
}
