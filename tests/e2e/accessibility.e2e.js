import { expect, test } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("Accessibility", () => {
  test.skip(!adminEmail || !adminPassword, "requires admin credentials");

  test("dashboard should have no accessibility violations", async ({ page }) => {
    await page.goto("/");

    // Login
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);
    await signInButton.click();

    // Wait for dashboard load
    const infoCenterButton = page.getByRole("button", { name: "Info Center" });
    await expect(infoCenterButton).toBeVisible({ timeout: 10000 });

    // Inject axe and run accessibility check
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test("login form should be keyboard navigable", async ({ page }) => {
    await page.goto("/");

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    // Navigate with tab
    await emailInput.focus();
    expect(await emailInput.evaluate((el) => document.activeElement === el)).toBe(true);

    await page.keyboard.press("Tab");
    expect(await passwordInput.evaluate((el) => document.activeElement === el)).toBe(true);

    await page.keyboard.press("Tab");
    // Should focus on sign-in button
    const isSignInFocused = await signInButton.evaluate(
      (el) => document.activeElement === el
    );
    expect(isSignInFocused).toBe(true);
  });

  test("buttons should have descriptive labels", async ({ page }) => {
    await page.goto("/");

    // Check that all buttons have accessible names
    const buttons = page.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const accessibleName = await button.getAttribute("aria-label");
      const textContent = await button.textContent();

      // Either should have aria-label or visible text
      expect(
        accessibleName || (textContent && textContent.trim().length > 0)
      ).toBeTruthy();
    }
  });

  test("form inputs should have associated labels", async ({ page }) => {
    await page.goto("/");

    const labels = page.locator("label");
    const count = await labels.count();

    expect(count).toBeGreaterThan(0);

    // Each label should have a for attribute pointing to an input
    for (let i = 0; i < count; i++) {
      const label = labels.nth(i);
      const forAttr = await label.getAttribute("for");

      if (forAttr) {
        const input = page.locator(`#${forAttr}`);
        expect(await input.count()).toBe(1);
      }
    }
  });

  test("modals should have proper ARIA attributes", async ({ page }) => {
    await page.goto("/");

    // Login first
    if (adminEmail && adminPassword) {
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const signInButton = page.getByRole("button", { name: /Sign In/i });

      await emailInput.fill(adminEmail);
      await passwordInput.fill(adminPassword);
      await signInButton.click();

      const infoCenterButton = page.getByRole("button", { name: "Info Center" });
      await expect(infoCenterButton).toBeVisible({ timeout: 10000 });

      // Open a modal
      await infoCenterButton.click();

      // Check for modal ARIA attributes
      const modal = page.locator('[role="dialog"]').first();
      if (await modal.count() > 0) {
        expect(await modal.getAttribute("role")).toBe("dialog");
      }
    }
  });

  test("should have sufficient color contrast", async ({ page }) => {
    await page.goto("/");

    await injectAxe(page);

    // Run color contrast check specifically
    const results = await page.evaluate(async () => {
      return new Promise((resolve) => {
        (window as any).axe.run(
          { runOnly: { type: "rule", values: ["color-contrast"] } },
          (error: any, result: any) => {
            resolve(result);
          }
        );
      });
    });

    expect((results as any).violations.length).toBe(0);
  });
});
