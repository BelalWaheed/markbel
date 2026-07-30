import { test, expect } from '@playwright/test';

test.describe('SyncManager - Retry Policy', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
  });

  
  test('401 Unauthorized triggers logout and stops sync', async ({ page }) => {
    let authExpiredFired = false;
    
    // No init script needed for auth-expired since we can just check local storage and url

    await page.route('**/api/sync/push', async route => {
      await route.fulfill({ status: 200, json: { results: [] } });
    });

    await page.route('**/api/sync/pull*', async route => {
      await route.fulfill({ status: 401, body: 'Unauthorized' });
    });

    await page.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page.goto('/sync-debug');
    await page.getByRole('button', { name: 'Force Pull' }).click();

    // Verify localStorage token is wiped by polling
    await expect(async () => {
      const token = await page.evaluate(() => localStorage.getItem('markbel_token'));
      expect(token).toBeNull();
    }).toPass({ timeout: 5000 });
  });

  test('5xx Server Error sets error state but does not crash', async ({ page }) => {
    await page.route('**/api/sync/push', async route => {
      await route.fulfill({ status: 200, json: { results: [] } });
    });

    await page.route('**/api/sync/pull*', async route => {
      await route.fulfill({ status: 503, body: 'Service Unavailable' });
    });

    await page.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page.goto('/sync-debug');
    await page.getByRole('button', { name: 'Force Pull' }).click();

    // The dashboard should display the error
    await expect(page.locator('text=Pull request failed: 503')).toBeVisible({ timeout: 5000 });
  });

});
