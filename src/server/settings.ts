import "server-only";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { SettingsDTO } from "@/lib/types";
import type { SettingsInput } from "@/lib/validation";

const settingsSelect = {
  businessName: true,
  businessDetails: true,
  paymentInstructions: true,
  regimeLabel: true,
  revenueCeilingBRL: true,
  setAsideBasisPoints: true,
} as const;

export async function getSettings(userId: string): Promise<SettingsDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: settingsSelect });
  if (!user) throw notFound("User");
  return user;
}

export async function updateSettings(userId: string, input: SettingsInput): Promise<void> {
  const { revenueCeiling, setAsidePercent, ...text } = input;
  await prisma.user.update({
    where: { id: userId },
    data: { ...text, revenueCeilingBRL: revenueCeiling, setAsideBasisPoints: setAsidePercent },
  });
}
