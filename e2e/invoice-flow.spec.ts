import { expect, test } from "@playwright/test";
import { centsFrom, expectAccessible, openDemo } from "./helpers";

test("create a client and an invoice, download the PDF, record a payment, see the dashboard change", async ({
  page,
}) => {
  await openDemo(page);
  const ytdBefore = centsFrom(await page.getByTestId("ytd-total").innerText());
  expect(ytdBefore).toBeGreaterThan(0);

  // A new client.
  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByRole("link", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("Playwright Testing Co.");
  await page.getByLabel("Country").fill("Portugal");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByLabel("Payment terms (days)").fill("10");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("link", { name: "Playwright Testing Co." })).toBeVisible();

  // An invoice with three items and a live total.
  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await page.getByRole("link", { name: "New invoice" }).click();
  await page.getByLabel("Client").selectOption({ label: "Playwright Testing Co." });
  await expect(page.getByLabel("Currency")).toHaveValue("EUR");

  const items = [
    ["Discovery workshop", "1", "500.00"],
    ["Development", "12.5", "45.50"],
    ["Hosting", "3", "19.99"],
  ];
  for (const [i, [description, quantity, price]] of items.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel(`Item ${i + 1} description`).fill(description);
    await page.locator(`[id="items.${i}.quantity"]`).fill(quantity);
    await page.locator(`[id="items.${i}.unitPrice"]`).fill(price);
  }
  // 500.00 + 568.75 + 59.97
  await expect(page.getByTestId("invoice-total")).toHaveText("€1,128.72");
  await page.getByRole("button", { name: "Save draft" }).click();

  await expect(page.getByRole("heading", { name: /Draft/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /^Total/ })).toContainText("€1,128.72");
  await expectAccessible(page);

  // Send it: it gets the next number.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("heading", { name: /INV-\d{4}/ })).toBeVisible();

  // The PDF downloads and is a real PDF.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^invoice-INV-\d{4}-playwright-testing-co\.pdf$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");

  // Record a payment with the rate API blocked: the form falls back to a manual rate.
  await page.route("**/api/rates**", (route) =>
    route.fulfill({ status: 503, json: { error: "Banco Central is unreachable" } }),
  );
  await page.getByRole("link", { name: "Record payment" }).click();
  await expect(page.getByText(/Couldn't get the PTAX rate/)).toBeVisible();
  await expect(page.getByLabel("Enter a rate by hand")).toBeChecked();
  await page.getByLabel("Rate (BRL per EUR)").fill("6.1000");
  await page.getByLabel("Reais that reached your account (BRL)").fill("6,800.00");
  await page.getByLabel("Fees charged (BRL, optional)").fill("25.00");
  await expect(page.getByText("At the reference rate")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Record payment" }).click();

  await expect(page.getByRole("heading", { name: /INV-\d{4}/ })).toContainText("Paid");
  await expect(page.getByText("Rate entered by hand 6.1000")).toBeVisible();

  // The dashboard total moved by exactly the reais typed.
  await page.getByRole("link", { name: "Dashboard" }).click();
  const ytdAfter = centsFrom(await page.getByTestId("ytd-total").innerText());
  expect(ytdAfter - ytdBefore).toBe(680_000);
  // The demo starts above 80% of its ceiling; this payment takes it past 100%.
  await expect(page.getByTestId("ceiling-alert")).toContainText("reached your revenue ceiling");
});

test("a weekend payment date uses the previous business day's PTAX rate and says so", async ({
  page,
}) => {
  await openDemo(page);
  await page.route("**/api/rates**", (route) =>
    route.fulfill({
      json: {
        currency: "USD",
        requestedDate: "2026-11-21",
        rateDate: "2026-11-19",
        sellMicros: 5_888_900,
        buyMicros: 5_888_300,
        bulletin: "Fechamento",
      },
    }),
  );
  await page.goto("/invoices?status=sent");
  await page.getByRole("row").nth(1).getByRole("link").click();
  await page.getByRole("link", { name: "Record payment" }).click();
  await page.getByLabel("Date the money arrived").fill("2026-11-21");
  await expect(page.getByText(/There is no bulletin on Nov 21, 2026/)).toBeVisible();
  await expect(page.getByText(/bulletin of Nov 19, 2026/)).toBeVisible();
});

test("main pages have no accessibility violations", async ({ page }) => {
  await openDemo(page);
  await expectAccessible(page);
  for (const path of ["/invoices", "/clients", "/settings", "/invoices/new", "/clients/new"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});

test("the landing page works without signing in and pages need a session", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  await expect(page.getByText("Not tax advice.")).toBeVisible();
  await expectAccessible(page);

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/");
  const pdf = await page.request.get("/invoices/anything/pdf");
  expect(pdf.status()).toBe(401);
  const rates = await page.request.get("/api/rates?currency=USD&date=2026-11-20");
  expect(rates.status()).toBe(401);
});
