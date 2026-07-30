import { NotificationEngine, NotificationEventBus } from '@markbel/notifications';
import { ExpoNotificationRepository } from './ExpoNotificationRepository';
import { ExpoNotificationAdapter } from './ExpoNotificationAdapter';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { syncManager, SyncState } from '../db/SyncManager';

export const notificationEventBus = new NotificationEventBus();
export const expoNotificationRepository = new ExpoNotificationRepository();
export const expoNotificationAdapter = new ExpoNotificationAdapter();

const deviceId = 'mobile-expo-device'; 

const db = SQLite.openDatabaseSync('markbel.db');

export const notificationEngine = new NotificationEngine(
  deviceId,
  notificationEventBus,
  expoNotificationRepository,
  expoNotificationAdapter,
  async () => {
    const rows = await db.getAllAsync<{ id: string, title: string, remindAt: string, version: number }>('SELECT id, title, remindAt, version FROM bookmarks');
    return rows;
  }
);

export async function initializeNotifications() {
  try {
    const rows = await db.getAllAsync<{ id: string, title: string, remindAt: string, version: number }>('SELECT id, title, remindAt, version FROM bookmarks');
    await notificationEngine.startupRecovery(rows);
  } catch (err) {
    console.error('[Expo Notifications] Startup recovery failed:', err);
  }

  // Wire SyncManager to EventBus
  syncManager.subscribe((state) => {
    if (state === SyncState.Idle) {
      notificationEventBus.publish({ type: 'SyncCompleted', payload: { success: true } });
    }
  });

  // Request Push Permissions and Register Token
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus === 'granted') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'markbel'; 
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      await syncManager.updatePushToken(tokenResponse.data);
      console.log('[Expo Notifications] Registered push token');
    } else {
      console.warn('[Expo Notifications] Push permissions denied');
    }
  } catch (err) {
    console.error('[Expo Notifications] Failed to get push token:', err);
  }
}
