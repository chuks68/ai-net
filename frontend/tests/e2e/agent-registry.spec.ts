import { test, expect } from '@playwright/test';

test.describe('Agent Registry Browser', () => {
  test('navigates to /agents and asserts registry table renders rows', async ({ page }) => {
    // Navigate to /agents
    await page.goto('/agents');

    // Wait for the table to render
    await page.waitForSelector('#agent-table');

    // Assert rows are visible
    const rows = page.locator('#agent-table tbody tr.agent-row');
    await expect(rows).toHaveCount(3);

    // Assert contents of rows
    await expect(page.locator('[data-testid="agent-row-agent-1"]')).toContainText('Research Specialist');
    await expect(page.locator('[data-testid="agent-row-agent-2"]')).toContainText('Smart Contract Dev');
    await expect(page.locator('[data-testid="agent-row-agent-3"]')).toContainText('QA Audit Agent');
  });
});
