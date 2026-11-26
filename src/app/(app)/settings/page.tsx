import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/components/SettingsForm";
import { toDecimalString, toMoneyInput } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const s = await getSettings(user.id);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm
        defaultValues={{
          businessName: s.businessName,
          businessDetails: s.businessDetails,
          paymentInstructions: s.paymentInstructions,
          regimeLabel: s.regimeLabel,
          revenueCeiling: toMoneyInput(s.revenueCeilingBRL),
          setAsidePercent: toDecimalString(s.setAsideBasisPoints, 2).replace(/\.?0+$/, ""),
        }}
      />
    </>
  );
}
