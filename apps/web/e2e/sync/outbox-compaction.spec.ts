import { test, expect } from '@playwright/test';

test.describe('SyncManager - Outbox Compaction', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
  });

  
  test('Create followed by Delete is cancelled out', async ({ page }) => {
    // Intercept push to prevent actual network calls and inspect payload
    let pushedChanges: any[] = [];
    await page.route('**/api/sync/push', async route => {
      const payload = route.request().postDataJSON();
      pushedChanges = payload.changes;
      await route.fulfill({ status: 200, json: { results: [] } });
    });
    
    await page.route('**/api/sync/pull*', async route => {
      await route.fulfill({ status: 200, json: { changes: [], nextCursor: 0, hasMore: false } });
    });

    await page.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page.goto('/sync-debug');
    
    // Pause sync so we can manually queue things
    await page.getByRole('button', { name: 'Pause Sync' }).click();
    
    // Navigate to bookmarks and add a bookmark
    await page.goto('/');
    
    // Add bookmark
    await page.evaluate(async () => {
      // Mock db insertion to bypass UI clicks
      const { bookmarkRepository } = await import('./src/db/SyncRepository.js' as any) || window; 
      // Actually, since we don't have access to JS context easily, we'll just evaluate Dexie logic
      // @ts-ignore - Playwright resolves the .js extension at runtime via Vite
      const db = (window as any).db || (await import('../src/db/db.js')).db;
      
      const id = 'test-item-123';
      await db.syncOutbox.put({
        id: 'outbox-1',
        entityType: 'bookmark',
        entityId: id,
        operation: 'create',
        payload: { title: 'Test 1' },
        attempts: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        baseVersion: 0
      });
      
      await db.syncOutbox.put({
        id: 'outbox-2',
        entityType: 'bookmark',
        entityId: id,
        operation: 'delete',
        payload: {},
        attempts: 0,
        status: 'pending',
        createdAt: new Date(Date.now() + 1000).toISOString(),
        baseVersion: 0
      });
    });

    // Go back to debug and force push
    await page.goto('/sync-debug');
    await page.getByRole('button', { name: 'Force Push' }).click();

    // Verify the intercepted payload contains NOTHING because create + delete cancels out
    expect(pushedChanges.length).toBe(0);
    
    // Verify outbox is empty
    const pendingCountText = await page.locator('.text-3xl.font-bold.text-cyan-400').first().innerText();
    expect(pendingCountText).toBe('0');
  });

});
