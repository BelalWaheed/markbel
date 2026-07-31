import { NotificationEventBus } from './EventBus';
import { NotificationScheduler } from './NotificationScheduler';
import { NotificationRepository, NotificationPlatformAdapter, NotificationCommand } from './types';

export class NotificationEngine {
  private scheduler: NotificationScheduler;

  constructor(
    deviceId: string,
    private eventBus: NotificationEventBus,
    private repository: NotificationRepository,
    private adapter: NotificationPlatformAdapter,
    private getLocalBookmarksForRecovery: () => Promise<{ id: string; title: string; remindAt?: string; version: number }[]>
  ) {
    this.scheduler = new NotificationScheduler();
    this.eventBus.subscribe(async (event) => {
      if (event.type === 'SyncCompleted') {
        const bookmarks = await this.getLocalBookmarksForRecovery();
        await this.startupRecovery(bookmarks);
      } else {
        const commands = this.scheduler.processEvent(event);
        await this.executeCommands(commands);
      }
    });
  }

  private async executeCommands(commands: NotificationCommand[]) {
    for (const cmd of commands) {
      try {
        if (cmd.type === 'ScheduleNotificationCommand') {
          await this.adapter.scheduleLocalNotification(cmd.payload, cmd.payload.triggerAtUtc);
          await this.repository.save(cmd.payload);
        } else if (cmd.type === 'CancelNotificationCommand') {
          // If a specific ID is provided, cancel that. 
          // Note: Since reminders can have different versions, it's safer to cancel all by bookmarkId if it's a delete/update without reminder.
          if (cmd.id) {
            await this.adapter.cancelLocalNotification(cmd.id);
            await this.repository.remove(cmd.id);
          }
          if (cmd.bookmarkId) {
            // A more thorough cleanup just in case previous versions were left behind
            await this.repository.removeByBookmarkId(cmd.bookmarkId);
          }
        }
      } catch (err) {
        console.error(`[NotificationEngine] Error executing command ${cmd.type}:`, err);
      }
    }
  }

  public async startupRecovery(currentBookmarks: { id: string; title: string; remindAt?: string; version: number }[]) {
    // 1. Get all scheduled notifications from repo
    const scheduled = await this.repository.getAllScheduled();
    const activeBookmarkMap = new Map(currentBookmarks.map(b => [b.id, b]));

    // 2. Identify orphaned notifications (bookmark deleted or remindAt removed/changed)
    for (const notif of scheduled) {
      const bookmark = activeBookmarkMap.get(notif.bookmarkId);
      if (!bookmark || !bookmark.remindAt) {
        // Bookmark deleted or reminder removed -> Cancel
        await this.executeCommands([{ type: 'CancelNotificationCommand', id: notif.id, bookmarkId: notif.bookmarkId }]);
      } else {
        // Bookmark exists. Is this the right version/time?
        const expectedId = this.scheduler.generateId(bookmark.id);
        if (expectedId !== notif.id) {
          // Time/ID mismatch -> Cancel old, the loop below will schedule the new one
          await this.executeCommands([{ type: 'CancelNotificationCommand', id: notif.id, bookmarkId: notif.bookmarkId }]);
        }
      }
    }

    // 3. Ensure all valid bookmarks with remindAt are scheduled
    for (const bookmark of currentBookmarks) {
      if (bookmark.remindAt) {
        const expectedId = this.scheduler.generateId(bookmark.id);
        const alreadyScheduled = scheduled.some(s => s.id === expectedId);
        if (!alreadyScheduled) {
          // Fire a simulated event through the scheduler
          const commands = this.scheduler.processEvent({
            type: 'BookmarkUpdated',
            payload: { id: bookmark.id, title: bookmark.title, remindAt: bookmark.remindAt, version: bookmark.version }
          });
          await this.executeCommands(commands);
        }
      }
    }
  }
}
