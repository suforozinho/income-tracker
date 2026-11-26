import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Sign in through "Try the demo"; lands on a dashboard filled with fake data. */
export async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

/** Fail with a readable list of WCAG A/AA problems on the current page. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** "R$76,565.54" -> 7656554 */
export function centsFrom(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}
