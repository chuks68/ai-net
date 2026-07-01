import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');
  });

  test('fails correctly on invalid secret key input', async ({ page }) => {
    // Fill in an invalid secret key
    await page.fill('#secretKey', 'invalid-secret-key-123');
    // Click connect
    await page.click('#btn-connect');

    // Assert error message is visible and correct
    const errorEl = page.locator('#wallet-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Invalid Stellar secret key');
  });

  test('connects successfully with a valid testnet secret key', async ({ page }) => {
    const validSecret = 'SCEU5HVW73GXX2Y5XWXTXOBRBAHG2KNKKL2WXW2F6OFMRPGZ5EQHUDUE';
    // Fill in valid secret key
    await page.fill('#secretKey', validSecret);
    // Click connect
    await page.click('#btn-connect');

    // Assert connect success message is visible
    const successEl = page.locator('#connect-success');
    await expect(successEl).toBeVisible();
    await expect(successEl).toContainText('Wallet Connected Successfully');

    // Assert public key appears in the top navigation bar
    const navKeyEl = page.locator('#wallet-pubkey-display');
    await expect(navKeyEl).toBeVisible();
    
    const navKeyText = await navKeyEl.innerText();
    // It should be truncated, e.g. G... and not "Not Connected"
    expect(navKeyText).not.toBe('Not Connected');
    expect(navKeyText).toMatch(/^G[A-Z0-9]{3}\.\.\.[A-Z0-9]{3}$/);
  });
});
