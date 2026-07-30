import { test, expect } from '@playwright/test';

test.describe('SyncManager - Leader Election', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
  });

  
  test('Exactly one tab owns the synchronization lock', async ({ browser }) => {
    // Open 5 independent tabs in the same context to share IndexedDB and Locks
    const context = await browser.newContext();
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
    
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);

    // Inject token to bypass authentication
    await Promise.all(pages.map(page => 
      page.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'))
    ));

    // Navigate all pages to sync debug page
    await Promise.all(pages.map(page => page.goto('/sync-debug')));

    // Wait for at least one page to become leader
    await Promise.any(
      pages.map(page => page.waitForSelector('strong:has-text("LEADER")', { state: 'visible', timeout: 10000 }))
    );

    // Read the leader status from all pages
    const statuses = await Promise.all(
      pages.map(async page => {
        return await page.locator('strong', { hasText: 'LEADER' }).isVisible();
      })
    );

    const leaderCount = statuses.filter(isLeader => isLeader).length;
    expect(leaderCount).toBe(1);

    const followerCount = await Promise.all(
      pages.map(async page => page.locator('strong', { hasText: 'FOLLOWER' }).isVisible())
    ).then(res => res.filter(isFollower => isFollower).length);

    expect(followerCount).toBe(4);
  });

  test('Closing leader promotes another tab', async ({ browser }) => {
    const context = await browser.newContext();
    await context.route('**/api/users/me', route => route.fulfill({ status: 200, json: { id: '1', name: 'Test', email: 'test@test.com' } }));
    
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));
    await page2.addInitScript(() => localStorage.setItem('markbel_token', 'test-token'));

    await page1.goto('/sync-debug');
    await page2.goto('/sync-debug');

    await page1.waitForTimeout(1000); // Wait for lock

    const isPage1Leader = await page1.locator('strong', { hasText: 'LEADER' }).isVisible();
    const isPage2Leader = await page2.locator('strong', { hasText: 'LEADER' }).isVisible();

    let leaderPage, followerPage;
    if (isPage1Leader) {
      leaderPage = page1;
      followerPage = page2;
    } else {
      leaderPage = page2;
      followerPage = page1;
    }

    // Close the leader
    await leaderPage.close();

    // The follower should instantly (within a second) become the leader
    await followerPage.waitForTimeout(1000);
    await expect(followerPage.locator('strong', { hasText: 'LEADER' })).toBeVisible({ timeout: 5000 });
  });
});
