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

    const infoCenterButton = page.getByRole("button", { name: "Info Center" });
    const alreadyOnDashboard = await infoCenterButton.isVisible().catch(() => false);

    if (!alreadyOnDashboard) {
      await page.locator('input[type="email"]').first().fill(adminEmail);
      await page.locator('input[type="password"]').first().fill(adminPassword);
      await page.getByRole("button", { name: /Sign In/i }).click();
      await expect(infoCenterButton).toBeVisible();
    }

    await infoCenterButton.click();
    
    // Wait for the Logic Health button to appear in the modal
    await expect(page.getByRole("button", { name: /Logic Health/i })).toBeVisible({ timeout: 3000 });
    
    await page.getByRole("button", { name: /Logic Health/i }).click();

    // Give the Logic Health view time to render and potentially scroll the modal upward
    await page.waitForTimeout(800);
    
    // Scroll to the top of the modal content to ensure we can see the buttons and entries
    await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0');
      if (modal) {
        const scrollableArea = modal.querySelector('.overflow-y-auto');
        if (scrollableArea) {
          scrollableArea.scrollTop = 0;
        }
      }
    });

    await page.getByRole("button", { name: /Run Quick Checks/i }).click();

    // Wait for quick check entries to appear in DOM with a generous timeout
    await page.waitForFunction(
      () => {
        const pageText = document.documentElement.innerText;
        return pageText.includes('Quick Check');
      },
      { timeout: 5000 },
    );

    // Try to scroll any hidden Quick Check entries into view
    await page.evaluate(() => {
      // Find all containers that might need scrolling
      const containers = document.querySelectorAll('[class*="overflow"], [class*="max-h"]');
      containers.forEach((container) => {
        if (container.scrollHeight > container.clientHeight) {
          container.scrollTop = 0;
        }
      });
    });

    // Check that entries exist and try to make them visible
    const quickCheckElement = page.getByText(/Quick Check/i).first();
    try {
      await quickCheckElement.scrollIntoViewIfNeeded();
    } catch {
      // scrollIntoViewIfNeeded might not be available, that's ok
    }

    // Simply verify that the elements exist in the DOM
    const quickCheckCount = await page.locator('text=/Quick Check/').count();
    expect(quickCheckCount).toBeGreaterThan(0);

    const codeCount = await page.locator('text=/[A-Z]{2}-\\d{3}/').count();
    expect(codeCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: /Clear Log/i }).click();
    await expect(page.getByText(/No matching logic alerts/i)).toBeVisible();
  });
});
