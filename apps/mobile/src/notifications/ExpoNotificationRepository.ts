import { NotificationRepository, NotificationPayload, NotificationState } from '@markbel/notifications';
import * as SQLite from 'expo-sqlite';

export class ExpoNotificationRepository implements NotificationRepository {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync('markbel.db');
  }

  async getScheduledIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>('SELECT id FROM scheduled_notifications');
    return rows.map(r => r.id);
  }

  async getAllScheduled(): Promise<NotificationPayload[]> {
    const rows = await this.db.getAllAsync<any>('SELECT * FROM scheduled_notifications');
    return rows.map(r => ({
      id: r.id,
      bookmarkId: r.bookmarkId,
      title: r.title,
      body: r.body,
      triggerAtUtc: r.triggerAtUtc,
      state: r.state as NotificationState,
      deepLink: { type: 'bookmark', bookmarkId: r.bookmarkId, action: 'open' }
    }));
  }

  async save(notification: NotificationPayload): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO scheduled_notifications (id, bookmarkId, title, body, triggerAtUtc, state)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [notification.id, notification.bookmarkId, notification.title, notification.body, notification.triggerAtUtc, notification.state]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM scheduled_notifications WHERE id = ?', [id]);
  }

  async removeByBookmarkId(bookmarkId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM scheduled_notifications WHERE bookmarkId = ?', [bookmarkId]);
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM scheduled_notifications');
  }
}
