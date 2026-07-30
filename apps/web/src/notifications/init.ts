import { NotificationEngine, NotificationEventBus } from '@markbel/notifications';
import { WebNotificationRepository } from './WebNotificationRepository';
import { WebNotificationAdapter } from './WebNotificationAdapter';
import { db } from '../db/db';
import { syncManager, SyncState } from '../db/SyncManager';

export const notificationEventBus = new NotificationEventBus();
export const webNotificationRepository = new WebNotificationRepository();
export const webNotificationAdapter = new WebNotificationAdapter();

// Generate a pseudo device ID for the web browser session (in a real app, this would be persisted in appConfig)
const deviceId = 'web-browser-device'; 

export const notificationEngine = new NotificationEngine(
  deviceId,
  notificationEventBus,
  webNotificationRepository,
  webNotificationAdapter,
  async () => {
    const bookmarks = await db.bookmarks.toArray();
    return bookmarks.map(b => ({
      id: b.id,
      title: b.title,
      remindAt: b.remindAt,
      version: b.version
    }));
  }
);

export async function initializeNotifications() {
  // 1. Startup Recovery: Load all local bookmarks to reconcile missed notifications
  try {
    const bookmarks = await db.bookmarks.toArray();
    
    // Convert local bookmarks to the minimal format required by startupRecovery
    const activeBookmarks = bookmarks.map(b => ({
      id: b.id,
      title: b.title,
      remindAt: b.remindAt,
      version: b.version
    }));

    await notificationEngine.startupRecovery(activeBookmarks);
  } catch (err) {
    console.error('[Web Notifications] Startup recovery failed:', err);
  }

  // 2. Wire SyncManager to EventBus
  syncManager.subscribe((state) => {
    // When sync finishes and returns to 'idle' from 'syncing'/'pulling', we could infer completion
    // For simplicity, we can emit SyncCompleted here if state is 'idle'
    if (state === SyncState.Idle) {
      notificationEventBus.publish({ type: 'SyncCompleted', payload: { success: true } });
    }
  });
}
