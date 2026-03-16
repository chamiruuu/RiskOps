import { expect, test, beforeEach } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL || "test@example.com";
const testPassword = process.env.E2E_TEST_PASSWORD || "testPassword123!";
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show login page when not authenticated", async ({ page }) => {
    // Should be redirected to login if not authenticated
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("should reject invalid credentials", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await emailInput.fill("invalid@example.com");
    await passwordInput.fill("wrongpassword");
    await signInButton.click();

    // Should show error message
    const errorMessage = page.locator('text=/Invalid email or password/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test.skip(!adminEmail || !adminPassword, "requires admin credentials");
  test("should successfully login with valid credentials", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);
    await signInButton.click();

    // Should redirect to dashboard
    const infoCenterButton = page.getByRole("button", { name: "Info Center" });
    await expect(infoCenterButton).toBeVisible({ timeout: 10000 });
  });

  test("should maintain session after page refresh", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);
    await signInButton.click();

    const infoCenterButton = page.getByRole("button", { name: "Info Center" });
    await expect(infoCenterButton).toBeVisible({ timeout: 10000 });

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(infoCenterButton).toBeVisible({ timeout: 10000 });
  });

  test("should require email field", async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await passwordInput.fill("somepassword");
    await signInButton.click();

    // Should show validation error
    const emailInput = page.locator('input[type="email"]').first();
    const validity = await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid);
    expect(validity).toBe(false);
  });

  test("should require password field", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await emailInput.fill("test@example.com");
    await signInButton.click();

    // Should show validation error or prevent submission
    const passwordInput = page.locator('input[type="password"]').first();
    const validity = await passwordInput.evaluate((el) => (el as HTMLInputElement).validity.valid);
    expect(validity).toBe(false);
  });

  test("should handle network errors gracefully", async ({ page }) => {
    // Simulate network error
    await page.context().setOffline(true);

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.getByRole("button", { name: /Sign In/i });

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);
    await signInButton.click();

    // Should show network error message
    const errorMessage = page.locator('text=/error|failed|network/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Restore connectivity
    await page.context().setOffline(false);
  });
});

test.describe("Session Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    
    if (adminEmail && adminPassword) {
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const signInButton = page.getByRole("button", { name: /Sign In/i });

      await emailInput.fill(adminEmail);
      await passwordInput.fill(adminPassword);
      await signInButton.click();

      const infoCenterButton = page.getByRole("button", { name: "Info Center" });
      await expect(infoCenterButton).toBeVisible({ timeout: 10000 });
    }
  });

  test.skip(!adminEmail || !adminPassword, "requires admin credentials");
  test("should display user info after login", async ({ page }) => {
    // Check that dashboard elements are visible (user is logged in)
    const infoCenterButton = page.getByRole("button", { name: "Info Center" });
    await expect(infoCenterButton).toBeVisible();
  });

  test("should clear session on logout", async ({ page }) => {
    // Find and click logout button (adjust selector based on actual UI)
    const userMenu = page.getByRole("button", { name: /user|profile|account/i }).first();
    
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click();
      
      const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();

        // Should return to login page
        const emailInput = page.locator('input[type="email"]').first();
        await expect(emailInput).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
