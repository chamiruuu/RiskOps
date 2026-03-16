import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("logic health admin smoke", () => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin smoke test",
  );

  test("open logic health, run checks, clear log", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Work Email").fill(adminEmail);
    await page.getByLabel("Password").fill(adminPassword);
    await page.getByRole("button", { name: /Sign In/i }).click();

    await page.getByRole("button", { name: "Info Center" }).click();
    await page.getByRole("button", { name: /Logic Health/i }).click();

    await page.getByRole("button", { name: /Run Quick Checks/i }).click();

    await expect(page.getByText(/Quick Check/i).first()).toBeVisible();
    await expect(page.getByText(/PR-|SH-|RT-|PV-|HO-|DT-/).first()).toBeVisible();

    await page.getByRole("button", { name: /Clear Log/i }).click();
    await expect(page.getByText(/No matching logic alerts/i)).toBeVisible();
  });
});
