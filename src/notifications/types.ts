export type DeepLinkAction = {
  type: 'bookmark';
  bookmarkId: string;
  action: 'open';
};

export type NotificationState = 'Pending' | 'Scheduled' | 'Delivered' | 'Opened' | 'Dismissed' | 'Expired';

export interface NotificationPayload {
  id: string; // Deterministic ID: reminder-${bookmarkId}
  bookmarkId: string;
  title: string;
  body: string;
  triggerAtUtc: string; // Stored in UTC ISO string
  deepLink?: DeepLinkAction;
  state: NotificationState;
}

export interface NotificationPreferences {
  reminderNotifications: boolean;
  digestNotifications: boolean;
  pushNotifications: boolean;
  localNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

// Commands produced by the Scheduler
export type ScheduleNotificationCommand = {
  type: 'ScheduleNotificationCommand';
  payload: NotificationPayload;
};

export type CancelNotificationCommand = {
  type: 'CancelNotificationCommand';
  id: string; // deterministic ID
  bookmarkId: string;
};

export type UpdateNotificationCommand = {
  type: 'UpdateNotificationCommand';
  payload: NotificationPayload;
};

export type DismissNotificationCommand = {
  type: 'DismissNotificationCommand';
  id: string;
};

export type NotificationCommand = 
  | ScheduleNotificationCommand 
  | CancelNotificationCommand 
  | UpdateNotificationCommand 
  | DismissNotificationCommand;

export interface NotificationRepository {
  getScheduledIds(): Promise<string[]>;
  getAllScheduled(): Promise<NotificationPayload[]>;
  save(notification: NotificationPayload): Promise<void>;
  remove(id: string): Promise<void>;
  removeByBookmarkId(bookmarkId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface NotificationPlatformAdapter {
  scheduleLocalNotification(payload: NotificationPayload, triggerAtUtc: string): Promise<void>;
  cancelLocalNotification(id: string): Promise<void>;
  setBadgeCount(count: number): Promise<void>;
}
