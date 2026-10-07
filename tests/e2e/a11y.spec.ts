import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Automated WCAG 2.2 AA checks (axe-core) on the main pages, in light and dark mode.
 * Automated checks catch roughly a third to a half of accessibility issues (contrast,
 * labels, names, structure); keyboard and screen-reader behaviour still needs people.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FOUNDER = { email: "dylan@demo.meacreo.test", password: "MeaCreoDemo2026!" };
const CLIENT_A = { email: "thandi@demo.meacreo.test", password: "ClientDemo2026!" };

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[name="email"]', who.email);
  await page.fill('input[name="password"]', who.password);
  await Promise.all([
    page.waitForURL(/\/(workspace|portal)/, { timeout: 90_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function audit(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path, { waitUntil: "networkidle" });
    const r = await new AxeBuilder({ page }).withTags(TAGS).exclude("nextjs-portal").analyze();
    const found = r.violations.map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
    expect(found, `${path}\n${found.join("\n")}`).toEqual([]);
  }
}

test.describe.configure({ timeout: 300_000 });
test.skip(({ isMobile }) => isMobile, "Desktop audit covers the same markup");

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "mc_theme", value: theme, url: baseURL! }]);
    });

    test("website", async ({ page }) => {
      await audit(page, [
        "/",
        "/pricing",
        "/about",
        "/services",
        "/visibility-report",
        "/book",
        "/legal/popia",
      ]);
    });

    test("workspace", async ({ page }) => {
      await signIn(page, FOUNDER);
      await audit(page, [
        "/workspace",
        "/workspace/leads",
        "/workspace/outreach",
        "/workspace/clients",
        "/workspace/billing",
        "/workspace/design-system",
      ]);
    });

    test("client portal", async ({ page }) => {
      await signIn(page, CLIENT_A);
      await audit(page, ["/portal", "/portal/approvals", "/portal/billing", "/portal/settings"]);
    });
  });
}
