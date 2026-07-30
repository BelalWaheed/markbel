import { test, expect } from '@playwright/test';

test.describe('SyncManager - Integrity Validation', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
  });

  
  test('Two tabs display identical bookmark states', async ({ browser }) => {
    const context = await browser.newContext();
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
    
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Mock API to return a predefined bookmark
    const mockBookmark = {
      id: 'mock-123',
      title: 'Integrity Test',
      url: 'https://integrity.com',
      version: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      isPinned: true
    };

    await context.route('**/api/sync/pull*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          changes: [
            {
              operation: 'create',
              version: 5,
              record: mockBookmark
            }
          ],
          nextCursor: 1,
          hasMore: false
        }
      });
    });

    await page1.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page2.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));

    await page1.goto('/');
    await page2.goto('/');
    await page1.waitForTimeout(1000); // Wait for sync to finish
    await page1.reload();
    await page2.reload();

    // Both tabs should see the bookmark since they share the same Dexie DB
    await expect(page1.locator('text=Integrity Test')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('text=Integrity Test')).toBeVisible({ timeout: 10000 });

    // Validate absolute equality of the DB record
    const record1 = await page1.evaluate(async () => {
      // @ts-ignore - Playwright resolves the .js extension at runtime via Vite
      const db = (window as any).db || (await import('../src/db/db.js')).db;
      return await db.bookmarks.get('mock-123');
    });

    const record2 = await page2.evaluate(async () => {
      // @ts-ignore - Playwright resolves the .js extension at runtime via Vite
      const db = (window as any).db || (await import('../src/db/db.js')).db;
      return await db.bookmarks.get('mock-123');
    });

    expect(record1).toEqual(record2);
    expect(record1.version).toBe(5);
    expect(record1.isPinned).toBe(true);
  });

});
