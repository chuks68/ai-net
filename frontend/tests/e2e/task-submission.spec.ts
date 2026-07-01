import { test, expect } from '@playwright/test';

test.describe('Task Submission', () => {
  test('fills and submits task form, then asserts redirect and DAG nodes', async ({ page }) => {
    // Navigate to task submission page
    await page.goto('/tasks/new');

    // Fill the form fields
    await page.fill('#prompt', 'Build a decentralized agent network testing suite.');
    await page.fill('#maxBudgetXLM', '2.5');
    
    // Select agent preferences
    await page.check('#pref-research');
    await page.check('#pref-coding');
    await page.check('#pref-report');

    // Submit the form
    await page.click('#btn-submit-task');

    // Assert redirect to /tasks/:id (our mock endpoint returns mock-task-e2e-123)
    await page.waitForURL('**/tasks/mock-task-e2e-123');
    expect(page.url()).toContain('/tasks/mock-task-e2e-123');

    // Assert that the DAG preview renders and contains >= 3 nodes
    const dagNodes = page.locator('#dag-preview .dag-node');
    await expect(dagNodes).toHaveCount(3);

    // Assert specific node contents/labels
    await expect(page.locator('#node-research')).toBeVisible();
    await expect(page.locator('#node-coding')).toBeVisible();
    await expect(page.locator('#node-report')).toBeVisible();
  });
});
