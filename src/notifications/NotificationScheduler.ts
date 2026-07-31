import { NotificationEvent } from './EventBus';
import { NotificationCommand, NotificationPayload } from './types';

export class NotificationScheduler {
  constructor() {}

  public processEvent(event: NotificationEvent): NotificationCommand[] {
    const commands: NotificationCommand[] = [];

    switch (event.type) {
      case 'BookmarkCreated':
      case 'BookmarkUpdated':
        if (event.payload.remindAt) {
          // Timezone handling: store the original string or UTC timestamp
          const triggerDate = new Date(event.payload.remindAt);
          
          if (triggerDate.getTime() > Date.now()) {
            const payload: NotificationPayload = {
              id: this.generateId(event.payload.id),
              bookmarkId: event.payload.id,
              title: 'Bookmark Reminder',
              body: event.payload.title,
              triggerAtUtc: triggerDate.toISOString(),
              deepLink: {
                type: 'bookmark',
                bookmarkId: event.payload.id,
                action: 'open'
              },
              state: 'Pending'
            };
            commands.push({ type: 'ScheduleNotificationCommand', payload });
          } else {
            commands.push({ type: 'CancelNotificationCommand', id: this.generateId(event.payload.id), bookmarkId: event.payload.id });
          }
        } else {
          // If updated without a remindAt, ensure any existing is cancelled
          commands.push({ type: 'CancelNotificationCommand', id: this.generateId(event.payload.id), bookmarkId: event.payload.id });
        }
        break;

      case 'BookmarkDeleted':
        commands.push({ type: 'CancelNotificationCommand', id: this.generateId(event.payload.id), bookmarkId: event.payload.id });
        break;
    }

    return commands;
  }

  public generateId(bookmarkId: string): string {
    return `reminder-${bookmarkId}`;
  }
}
