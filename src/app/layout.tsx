import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TaxNote } from "@/components/TaxNote";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Income Tracker", template: "%s · Income Tracker" },
  description:
    "Invoices in USD and EUR, payments in reais, and a revenue-ceiling warning, for Brazilian contractors with foreign clients.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="mt-auto border-t border-slate-200 px-4 py-4 dark:border-slate-800">
          <TaxNote />
        </footer>
      </body>
    </html>
  );
}
