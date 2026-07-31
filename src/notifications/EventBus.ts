export type NotificationEvent =
  | { type: 'BookmarkCreated'; payload: { id: string; title: string; remindAt?: string; version: number } }
  | { type: 'BookmarkUpdated'; payload: { id: string; title: string; remindAt?: string; version: number } }
  | { type: 'BookmarkDeleted'; payload: { id: string } }
  | { type: 'ReminderScheduled'; payload: { bookmarkId: string; remindAt: string } }
  | { type: 'ReminderCancelled'; payload: { bookmarkId: string } }
  | { type: 'ReminderTriggered'; payload: { bookmarkId: string } }
  | { type: 'SyncCompleted'; payload: { success: boolean } };

export type EventHandler<T extends NotificationEvent = NotificationEvent> = (event: T) => void | Promise<void>;

export class NotificationEventBus {
  private handlers: Set<EventHandler> = new Set();

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(event: NotificationEvent): Promise<void> {
    const promises = Array.from(this.handlers).map((handler) => handler(event));
    await Promise.all(
      promises.map(p => Promise.resolve(p).catch(err => {
        console.error(`[NotificationEventBus] Error handling event ${event.type}:`, err);
      }))
    );
  }
}
