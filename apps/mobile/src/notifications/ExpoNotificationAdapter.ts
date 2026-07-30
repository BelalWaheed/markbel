import { NotificationPlatformAdapter, NotificationPayload } from '@markbel/notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure expo-notifications global handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class ExpoNotificationAdapter implements NotificationPlatformAdapter {
  constructor() {
    this.requestPermissions();
  }

  private async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  async scheduleLocalNotification(payload: NotificationPayload, triggerAtUtc: string): Promise<void> {
    const triggerAt = new Date(triggerAtUtc).getTime();
    
    // Expo allows passing a Date or seconds. For precise Date:
    await Notifications.scheduleNotificationAsync({
      identifier: payload.id, // Enforces deduplication / exact replacement!
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.deepLink as Record<string, any>,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerAt),
      },
    });
  }

  async cancelLocalNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}
