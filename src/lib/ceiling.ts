/*
 * The revenue ceiling is a number the user sets. The presets are the 2026
 * limits reported by accounting sites; they are not checked against an
 * official source, and the app never decides which one applies.
 */

export const CEILING_PRESETS = [
  { label: "MEI", amountBRL: 8_100_000 },
  { label: "Simples Nacional", amountBRL: 480_000_000 },
] as const;

export type CeilingLevel = "ok" | "warning" | "exceeded";

/** "warning" from 80% of the ceiling, "exceeded" from 100%. Integer comparison, no floats. */
export function ceilingLevel(total: number, ceiling: number): CeilingLevel {
  if (ceiling <= 0) return "ok";
  if (total >= ceiling) return "exceeded";
  if (total * 10 >= ceiling * 8) return "warning";
  return "ok";
}
