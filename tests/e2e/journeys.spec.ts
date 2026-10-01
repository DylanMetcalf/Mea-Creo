import { expect, type Page, test } from "@playwright/test";

const FOUNDER = { email: "dylan@demo.meacreo.test", password: "MeaCreoDemo2026!" };
const CLIENT_A = { email: "thandi@demo.meacreo.test", password: "ClientDemo2026!" };
const CLIENT_B = { email: "pieter@demo.meacreo.test", password: "ClientDemo2026!" };

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[name="email"]', who.email);
  await page.fill('input[name="password"]', who.password);
  await Promise.all([
    page.waitForURL(/\/(workspace|portal)/, { timeout: 90_000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe.configure({ timeout: 180_000 });

test("founder sees the Command Centre and core workspace areas", async ({ page }) => {
  await signIn(page, FOUNDER);
  await expect(page).toHaveURL(/\/workspace/);
  for (const path of [
    "/workspace/clients",
    "/workspace/leads",
    "/workspace/approvals",
    "/workspace/billing",
    "/workspace/runs",
    "/workspace/settings?tab=integrations",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("text=Something went wrong")).toHaveCount(0);
  }
});

test("a client only reaches their own portal", async ({ page }) => {
  await signIn(page, CLIENT_B);
  await expect(page).toHaveURL(/\/portal/);
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/portal/);
});

test("clients cannot open another organisation's approvals", async ({ browser }) => {
  const a = await browser.newPage();
  await signIn(a, CLIENT_A);
  await a.goto("/portal/approvals");
  const href = await a.locator('a[href^="/portal/approvals/"]').first().getAttribute("href");
  test.skip(!href, "No approvals in the demo data");
  const b = await browser.newPage();
  await signIn(b, CLIENT_B);
  const res = await b.goto(href!);
  expect(res?.status()).toBe(404);
});

test("contact form creates an enquiry", async ({ page }) => {
  await page.goto("/contact");
  await page.fill('input[name="name"]', "E2E Person");
  await page.fill('input[name="email"]', "e2e@example.com");
  await page.fill('input[name="company"]', "E2E Testing Co");
  await page.fill('textarea[name="message"]', "Testing the contact form end to end.");
  await page.check('input[name="consent"]');
  await page.click('button:has-text("Send message")');
  await expect(page.getByText("Dylan will reply")).toBeVisible({ timeout: 60_000 });
});

test("unknown proposal links are not found", async ({ page }) => {
  const res = await page.goto("/proposal/notARealToken12345");
  expect(res?.status()).toBe(404);
});

test("old Wix URLs redirect permanently", async ({ request }) => {
  const res = await request.get("/book-online", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toContain("/book");
});
