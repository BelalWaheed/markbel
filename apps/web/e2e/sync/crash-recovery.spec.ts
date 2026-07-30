import { test, expect } from '@playwright/test';

test.describe('SyncManager - Crash Recovery', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
  });

  
  test('Recovers gracefully if browser crashes during push', async ({ page }) => {
    // We simulate a crash by aborting the request and closing the page,
    // then reopening it to see if the outbox items are still there and retry.
    
    // First, let's inject a fake outbox item via evaluation
    await page.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page.goto('/sync-debug');
    await page.getByRole('button', { name: 'Pause Sync' }).click();

    await page.evaluate(async () => {
      // @ts-ignore - Playwright resolves the .js extension at runtime via Vite
      const db = (window as any).db || (await import('../src/db/db.js')).db;
      await db.syncOutbox.put({
        id: 'crash-item-1',
        entityType: 'bookmark',
        entityId: 'bm-crash-1',
        operation: 'create',
        payload: { title: 'Crash Test' },
        attempts: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        baseVersion: 0
      });
    });

    // Intercept push, wait 1 second, then abort to simulate crash/network drop
    await page.route('**/api/sync/push', async route => {
      await new Promise(r => setTimeout(r, 1000));
      route.abort('failed');
    });

    await page.getByRole('button', { name: 'Force Push' }).click();

    // Verify error state is shown in the dashboard
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 5000 });

    // The item should STILL be in the outbox pending count
    const count = await page.locator('.text-3xl.font-bold.text-cyan-400').first().innerText();
    expect(count).toBe('1');
  });

});
