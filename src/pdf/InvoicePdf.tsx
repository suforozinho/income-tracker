import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatQuantity } from "@/lib/money";
import type { InvoiceDetailDTO, SettingsDTO } from "@/lib/types";

/*
 * The English invoice sent to the client. Amounts come from the same DTO and
 * money helpers as the web page, so the PDF total always matches the app.
 * The font is embedded (Geist, SIL OFL) so accents and € look the same in
 * every viewer.
 */

const fontDir = path.join(process.cwd(), "src/pdf/fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(fontDir, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Geist-SemiBold.ttf"), fontWeight: 600 },
  ],
});
// Never split words with hyphens; long descriptions wrap at spaces instead.
Font.registerHyphenationCallback((word) => [word]);

const ink = "#0f172a";
const soft = "#475569";
const line = "#e2e8f0";
const accent = "#047857";

const s = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 9.5,
    color: ink,
    paddingTop: 44,
    paddingBottom: 64,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  business: { maxWidth: 260 },
  businessName: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 22, fontWeight: 600, color: accent, lineHeight: 1.2 },
  number: { fontSize: 11, marginTop: 4 },
  soft: { color: soft },
  columns: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  label: {
    fontSize: 7.5,
    color: soft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  billTo: { maxWidth: 260 },
  strong: { fontWeight: 600 },
  meta: { width: 190 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: ink,
    paddingBottom: 4,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: line,
    paddingVertical: 5,
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 50, textAlign: "right" },
  cPrice: { width: 85, textAlign: "right" },
  cAmount: { width: 90, textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 225 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: ink,
    marginTop: 4,
    paddingTop: 5,
    fontSize: 12,
    fontWeight: 600,
  },
  block: { marginTop: 22 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 7.5, color: soft },
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 96,
    fontWeight: 600,
    color: "#cbd5e1",
    opacity: 0.35,
    transform: "rotate(-30deg)",
  },
});

export function InvoicePdf({
  invoice,
  business,
}: {
  invoice: InvoiceDetailDTO;
  business: SettingsDTO;
}) {
  const money = (amount: number) => formatMoney(amount, invoice.currency);
  const stamp =
    invoice.storedStatus === "DRAFT" ? "DRAFT" : invoice.storedStatus === "VOID" ? "VOID" : null;
  const showPaid = invoice.storedStatus === "SENT" && invoice.paid > 0;

  return (
    <Document
      title={`Invoice ${invoice.numberLabel}`}
      author={business.businessName || undefined}
      subject={`Invoice ${invoice.numberLabel} for ${invoice.client.name}`}
      language="en"
    >
      <Page size="A4" style={s.page}>
        {stamp && (
          <Text style={s.watermark} fixed>
            {stamp}
          </Text>
        )}

        <View style={s.header}>
          <View style={s.business}>
            {business.businessName ? (
              <Text style={s.businessName}>{business.businessName}</Text>
            ) : null}
            {business.businessDetails ? (
              <Text style={s.soft}>{business.businessDetails}</Text>
            ) : null}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>INVOICE</Text>
            <Text style={s.number}>
              {invoice.number === null ? "Draft (no number yet)" : invoice.numberLabel}
            </Text>
          </View>
        </View>

        <View style={s.columns}>
          <View style={s.billTo}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.strong}>{invoice.client.name}</Text>
            {invoice.client.address ? <Text>{invoice.client.address}</Text> : null}
            <Text>{invoice.client.country}</Text>
            {invoice.client.email ? <Text style={s.soft}>{invoice.client.email}</Text> : null}
          </View>
          <View style={s.meta}>
            <MetaRow
              label="Invoice number"
              value={invoice.number === null ? "Draft" : invoice.numberLabel}
            />
            <MetaRow label="Issue date" value={formatDate(invoice.issueDate)} />
            <MetaRow label="Due date" value={formatDate(invoice.dueDate)} strong />
            <MetaRow label="Currency" value={invoice.currency} />
          </View>
        </View>

        <View style={s.tableHead} fixed>
          <Text style={[s.cDesc, s.label, { marginBottom: 0 }]}>Description</Text>
          <Text style={[s.cQty, s.label, { marginBottom: 0 }]}>Qty</Text>
          <Text style={[s.cPrice, s.label, { marginBottom: 0 }]}>Unit price</Text>
          <Text style={[s.cAmount, s.label, { marginBottom: 0 }]}>Amount</Text>
        </View>
        {invoice.items.map((item) => (
          <View key={item.id} style={s.row} wrap={false}>
            <Text style={s.cDesc}>{item.description}</Text>
            <Text style={s.cQty}>{formatQuantity(item.quantityHundredths)}</Text>
            <Text style={s.cPrice}>{money(item.unitPrice)}</Text>
            <Text style={s.cAmount}>{money(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {showPaid && (
            <>
              <View style={s.totalRow}>
                <Text style={s.soft}>Subtotal</Text>
                <Text>{money(invoice.total)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.soft}>Paid</Text>
                <Text>-{money(invoice.paid)}</Text>
              </View>
            </>
          )}
          <View style={s.grandTotal}>
            <Text>{showPaid ? "Balance due" : "Total due"}</Text>
            <Text>{money(showPaid ? invoice.balance : invoice.total)}</Text>
          </View>
        </View>

        {business.paymentInstructions ? (
          <View style={s.block} wrap={false}>
            <Text style={s.label}>Payment instructions</Text>
            <Text>{business.paymentInstructions}</Text>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={s.block} wrap={false}>
            <Text style={s.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Repeated on every page. A "Page X of Y" counter (react-pdf render prop)
            did not render in this layout, so it is left out; see the README. */}
        <Text style={s.footer} fixed>
          {invoice.numberLabel} · {invoice.client.name}
        </Text>
      </Page>
    </Document>
  );
}

function MetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.soft}>{label}</Text>
      <Text style={strong ? s.strong : undefined}>{value}</Text>
    </View>
  );
}
