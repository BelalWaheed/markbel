import { test, expect } from '@playwright/test';

test.describe('SyncManager - Stress Testing', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
  });

  
  test('Handles 1000 items in Outbox', async ({ page }) => {
    // Increase test timeout for stress test
    test.setTimeout(60000); 
    
    // Mock backend to accept anything instantly to measure only frontend batching speed
    await page.route('**/api/sync/push', async route => {
      const payload = route.request().postDataJSON();
      const results = payload.changes.map((c: any) => ({
        changeId: c.changeId,
        status: 'applied',
        entityId: c.entityId,
        version: 1
      }));
      await route.fulfill({ status: 200, json: { results } });
    });

    await page.route('**/api/sync/pull*', async route => {
      await route.fulfill({ status: 200, json: { changes: [], nextCursor: 0, hasMore: false } });
    });

    await page.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page.goto('/sync-debug');
    await page.getByRole('button', { name: 'Pause Sync' }).click();

    // Inject 1000 items
    await page.evaluate(async () => {
      // @ts-ignore - Playwright resolves the .js extension at runtime via Vite
      const db = (window as any).db || (await import('../src/db/db.js')).db;
      
      const bulkItems = [];
      for (let i = 0; i < 1000; i++) {
        bulkItems.push({
          id: `stress-outbox-${i}`,
          entityType: 'bookmark',
          entityId: `bm-stress-${i}`,
          operation: 'create',
          payload: { title: `Stress ${i}`, url: `https://stress.com/${i}` },
          attempts: 0,
          status: 'pending',
          createdAt: new Date().toISOString(),
          baseVersion: 0
        });
      }
      
      await db.syncOutbox.bulkPut(bulkItems);
    });

    // Wait for the UI to pick up the injected items (polls every 2s)
    await expect(page.locator('.text-3xl.font-bold.text-cyan-400').first()).toHaveText('1000', { timeout: 5000 });

    // Force push 1 batch of 100
    await page.getByRole('button', { name: 'Force Push' }).click();
    
    // Should process 1 batch (100 items limit) and leave 900
    await expect(page.locator('.text-3xl.font-bold.text-cyan-400').first()).toHaveText('900', { timeout: 10000 });
  });

});
