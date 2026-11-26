import { expect, test } from "@playwright/test";
import { expectAccessible, openDemo } from "./helpers";

test("the dashboard and invoice list fit a phone screen", async ({ page }) => {
  await openDemo(page);
  for (const path of ["/dashboard", "/invoices", "/invoices/new"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  await expectAccessible(page);
});
