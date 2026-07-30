import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationEngine } from './NotificationEngine';
import { NotificationEventBus } from './EventBus';
import { NotificationRepository, NotificationPlatformAdapter, NotificationPayload, NotificationState } from './types';

class MockRepository implements NotificationRepository {
  private store: Map<string, NotificationPayload> = new Map();

  async getScheduledIds(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async getAllScheduled(): Promise<NotificationPayload[]> {
    return Array.from(this.store.values());
  }

  async save(notification: NotificationPayload): Promise<void> {
    this.store.set(notification.id, notification);
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id);
  }

  async removeByBookmarkId(bookmarkId: string): Promise<void> {
    const toRemove = Array.from(this.store.values()).filter(n => n.bookmarkId === bookmarkId);
    toRemove.forEach(n => this.store.delete(n.id));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

describe('NotificationEngine', () => {
  let eventBus: NotificationEventBus;
  let repo: MockRepository;
  let adapter: NotificationPlatformAdapter;
  let getLocalBookmarks: any;
  let engine: NotificationEngine;

  beforeEach(() => {
    eventBus = new NotificationEventBus();
    repo = new MockRepository();
    adapter = {
      scheduleLocalNotification: vi.fn(),
      cancelLocalNotification: vi.fn(),
      setBadgeCount: vi.fn()
    };
    getLocalBookmarks = vi.fn().mockResolvedValue([]);
    
    engine = new NotificationEngine('testDevice', eventBus, repo, adapter, getLocalBookmarks);
  });

  it('startupRecovery schedules missing notifications', async () => {
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const activeBookmarks = [
      { id: 'b1', title: 'Test 1', remindAt: futureDate, version: 1 }
    ];

    await engine.startupRecovery(activeBookmarks);

    const scheduled = await repo.getAllScheduled();
    expect(scheduled).toHaveLength(1);
    expect(adapter.scheduleLocalNotification).toHaveBeenCalledTimes(1);
  });

  it('startupRecovery cancels orphaned notifications', async () => {
    // Inject a stale notification in the repo
    await repo.save({
      id: 'reminder-b2',
      bookmarkId: 'b2',
      title: 'Stale',
      body: 'Stale',
      triggerAtUtc: new Date(Date.now() + 10000).toISOString(),
      state: 'Scheduled' as NotificationState
    });

    const activeBookmarks = [
      // Bookmark b2 exists but has no remindAt
      { id: 'b2', title: 'Updated Test 2', version: 2 }
    ];

    await engine.startupRecovery(activeBookmarks);

    const scheduled = await repo.getAllScheduled();
    expect(scheduled).toHaveLength(0); // cancelled and removed from repo
    expect(adapter.cancelLocalNotification).toHaveBeenCalledWith('reminder-b2');
  });

  it('startupRecovery is idempotent', async () => {
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const activeBookmarks = [
      { id: 'b1', title: 'Test 1', remindAt: futureDate, version: 1 }
    ];

    await engine.startupRecovery(activeBookmarks);
    const scheduled1 = await repo.getAllScheduled();
    expect(scheduled1).toHaveLength(1);
    expect(adapter.scheduleLocalNotification).toHaveBeenCalledTimes(1);

    // Call it again with the same bookmarks
    await engine.startupRecovery(activeBookmarks);
    const scheduled2 = await repo.getAllScheduled();
    expect(scheduled2).toHaveLength(1);
    // Shouldn't schedule again
    expect(adapter.scheduleLocalNotification).toHaveBeenCalledTimes(1);
  });
});
