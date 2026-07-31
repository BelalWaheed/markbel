import { db } from '../db/db';
import { NotificationRepository, NotificationPayload } from '@/notifications';

export class WebNotificationRepository implements NotificationRepository {
  async getScheduledIds(): Promise<string[]> {
    const records = await db.scheduledNotifications.toArray();
    return records.map(r => r.id);
  }

  async getAllScheduled(): Promise<NotificationPayload[]> {
    return await db.scheduledNotifications.toArray();
  }

  async save(notification: NotificationPayload): Promise<void> {
    await db.scheduledNotifications.put(notification);
  }

  async remove(id: string): Promise<void> {
    await db.scheduledNotifications.delete(id);
  }

  async removeByBookmarkId(bookmarkId: string): Promise<void> {
    const records = await db.scheduledNotifications.where('bookmarkId').equals(bookmarkId).toArray();
    const ids = records.map(r => r.id);
    if (ids.length > 0) {
      await db.scheduledNotifications.bulkDelete(ids);
    }
  }

  async clear(): Promise<void> {
    await db.scheduledNotifications.clear();
  }
}
