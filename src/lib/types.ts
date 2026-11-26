import type { CalendarDate } from "./dates";
import type { DisplayStatus, StoredStatus } from "./invoice-status";

export type Currency = "USD" | "EUR";

export interface ClientDTO {
  id: string;
  name: string;
  country: string;
  email: string;
  address: string;
  defaultCurrency: Currency;
  paymentTermsDays: number;
  archived: boolean;
}

export interface InvoiceSummaryDTO {
  id: string;
  number: number | null;
  numberLabel: string;
  client: { id: string; name: string };
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  currency: Currency;
  storedStatus: StoredStatus;
  status: DisplayStatus;
  total: number;
  paid: number;
  balance: number;
}

export interface InvoiceItemDTO {
  id: string;
  description: string;
  quantityHundredths: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PaymentDTO {
  id: string;
  receivedDate: CalendarDate;
  amountReceived: number;
  amountBRL: number;
  feesBRL: number;
  rateMicros: number | null;
  rateDate: CalendarDate | null;
  rateSource: "PTAX" | "MANUAL" | null;
  rateBulletin: string | null;
  settlesInvoice: boolean;
  note: string;
}

export interface InvoiceDetailDTO extends InvoiceSummaryDTO {
  client: ClientDTO;
  items: InvoiceItemDTO[];
  payments: PaymentDTO[];
  notes: string;
  taxTreatmentNote: string;
  nfseNumber: string;
}

export interface SettingsDTO {
  businessName: string;
  businessDetails: string;
  paymentInstructions: string;
  regimeLabel: string;
  revenueCeilingBRL: number;
  setAsideBasisPoints: number;
}

export interface RateDTO {
  currency: Currency;
  requestedDate: CalendarDate;
  /** The bulletin date actually used; earlier than requestedDate on weekends and holidays. */
  rateDate: CalendarDate;
  sellMicros: number;
  buyMicros: number;
  bulletin: string;
}
