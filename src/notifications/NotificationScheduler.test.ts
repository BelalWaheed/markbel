import { describe, it, expect } from 'vitest';
import { NotificationScheduler } from './NotificationScheduler';
import { ScheduleNotificationCommand, CancelNotificationCommand } from './types';

describe('NotificationScheduler', () => {
  const scheduler = new NotificationScheduler();

  it('should return ScheduleNotificationCommand on BookmarkCreated with future remindAt', () => {
    const futureDate = new Date(Date.now() + 100000).toISOString();
    
    const commands = scheduler.processEvent({
      type: 'BookmarkCreated',
      payload: { id: 'b1', title: 'Test Bookmark', remindAt: futureDate, version: 1 }
    });

    expect(commands).toHaveLength(1);
    const cmd = commands[0] as ScheduleNotificationCommand;
    expect(cmd.type).toBe('ScheduleNotificationCommand');
    expect(cmd.payload.id).toBe('reminder-b1');
    expect(cmd.payload.triggerAtUtc).toBe(futureDate);
  });

  it('should return CancelNotificationCommand on BookmarkCreated with past remindAt', () => {
    const pastDate = new Date(Date.now() - 100000).toISOString();
    
    const commands = scheduler.processEvent({
      type: 'BookmarkCreated',
      payload: { id: 'b2', title: 'Test Bookmark', remindAt: pastDate, version: 2 }
    });

    expect(commands).toHaveLength(1);
    const cmd = commands[0] as CancelNotificationCommand;
    expect(cmd.type).toBe('CancelNotificationCommand');
    expect(cmd.id).toBe('reminder-b2');
  });

  it('should return CancelNotificationCommand when BookmarkUpdated removes remindAt', () => {
    const commands = scheduler.processEvent({
      type: 'BookmarkUpdated',
      payload: { id: 'b3', title: 'Test Bookmark', version: 3 }
    });

    expect(commands).toHaveLength(1);
    const cmd = commands[0] as CancelNotificationCommand;
    expect(cmd.type).toBe('CancelNotificationCommand');
    expect(cmd.id).toBe('reminder-b3');
    expect(cmd.bookmarkId).toBe('b3');
  });

  it('should return CancelNotificationCommand on BookmarkDeleted', () => {
    const commands = scheduler.processEvent({
      type: 'BookmarkDeleted',
      payload: { id: 'b4' }
    });

    expect(commands).toHaveLength(1);
    const cmd = commands[0] as CancelNotificationCommand;
    expect(cmd.type).toBe('CancelNotificationCommand');
    expect(cmd.bookmarkId).toBe('b4');
  });
});
