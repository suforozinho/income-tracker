import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { InvoiceDetailDTO, SettingsDTO } from "@/lib/types";
import { InvoicePdf } from "./InvoicePdf";

export async function renderInvoicePdf(
  invoice: InvoiceDetailDTO,
  business: SettingsDTO,
): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf invoice={invoice} business={business} />);
}

/** "invoice-INV-0007-acme-gmbh.pdf" */
export function pdfFilename(invoice: InvoiceDetailDTO): string {
  const client = invoice.client.name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  return `invoice-${invoice.number === null ? "draft" : invoice.numberLabel}-${client || "client"}.pdf`;
}
