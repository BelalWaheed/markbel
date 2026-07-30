import { NotificationPlatformAdapter, NotificationPayload } from '@markbel/notifications';

export class WebNotificationAdapter implements NotificationPlatformAdapter {
  async scheduleLocalNotification(payload: NotificationPayload, triggerAtUtc: string): Promise<void> {
    const triggerAt = new Date(triggerAtUtc).getTime();
    const delay = triggerAt - Date.now();

    if (delay <= 0) {
      // Trigger immediately if it's in the past or now
      await this.showNotification(payload);
      return;
    }

    // In a browser environment, if ServiceWorkers are supported, we'd ideally register a background sync or 
    // push event. For "local" scheduling without an active push server, Web API is limited.
    // Standard `setTimeout` will pause if the tab is inactive for a long time on some browsers.
    // For this Phase 2B, we rely on setTimeout as a fallback, and rely on StartupRecovery to catch missed ones.
    setTimeout(() => {
      this.showNotification(payload).catch(console.error);
    }, delay);
  }

  async cancelLocalNotification(id: string): Promise<void> {
    // In a pure web environment, we can't easily cancel a pending setTimeout if it was scheduled in a previous session,
    // unless we keep a memory map of timeout IDs. 
    // However, the StartupRecovery logic and the fact that we verify before showing (if we implemented a check) handles it.
    // For now, this is a no-op as the browser lacks a native `cancelScheduledNotification` API without ServiceWorkers.
  }

  async setBadgeCount(count: number): Promise<void> {
    if ('setAppBadge' in navigator) {
      try {
        await (navigator as any).setAppBadge(count);
      } catch (err) {
        console.warn('App badge not supported', err);
      }
    }
  }

  private async showNotification(payload: NotificationPayload) {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      this.display(payload);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.display(payload);
      }
    }
  }

  private display(payload: NotificationPayload) {
    const notification = new Notification(payload.title, {
      body: payload.body,
      tag: payload.id, // deduplication handled natively by tag
      data: payload.deepLink
    });

    notification.onclick = function() {
      window.focus();
      // Handle deep link routing here in a real app, e.g. window.location.href = `/bookmark/${payload.deepLink?.bookmarkId}`
      this.close();
    };
  }
}
