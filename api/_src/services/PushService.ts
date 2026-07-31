import webpush from "web-push";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { IDevice } from "../models/Device.js";

// Initialize Expo SDK client
const expo = new Expo();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@markbel.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.warn("[VAPID Setup Warning]:", err);
  }
}

export class PushService {
  /**
   * Send a notification to a specific device
   */
  static async sendNotification(device: IDevice, payload: { title: string; body: string; url?: string }): Promise<boolean> {
    if (!device.pushToken) {
      return false;
    }

    try {
      if (device.platform === "web") {
        return await this.sendWebPush(device, payload);
      } else if (device.platform === "mobile") {
        return await this.sendExpoPush(device, payload);
      } else {
        // Desktop or unknown platforms may not support remote push natively via our backend yet
        console.log(`[PushService] Unsupported platform for remote push: ${device.platform}`);
        return false;
      }
    } catch (err) {
      console.error(`[PushService] Failed to send push to device ${device.id}:`, err);
      return false;
    }
  }

  private static async sendWebPush(device: IDevice, payload: { title: string; body: string; url?: string }): Promise<boolean> {
    try {
      const pushSubscription = JSON.parse(device.pushToken!);
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );
      return true;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // The subscription has expired or is no longer valid
        console.warn(`[PushService] Web push subscription expired for device ${device.id}`);
        // Optionally: Trigger an event or callback to clear the token from the DB
        // We throw so the caller knows it failed permanently if they want to handle it
        throw new Error("EXPIRED_SUBSCRIPTION");
      }
      throw err;
    }
  }

  private static async sendExpoPush(device: IDevice, payload: { title: string; body: string; url?: string }): Promise<boolean> {
    if (!device.pushToken || !Expo.isExpoPushToken(device.pushToken)) {
      console.error(`[PushService] Push token ${device.pushToken} is not a valid Expo push token`);
      return false;
    }

    const messages: ExpoPushMessage[] = [
      {
        to: device.pushToken,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: { url: payload.url },
      },
    ];

    try {
      const chunks = expo.chunkPushNotifications(messages as any);
      const tickets = [];
      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      // Check for errors in tickets (e.g. DeviceNotRegistered)
      let hasError = false;
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          console.error(`[PushService] Expo push error: ${ticket.message}`);
          if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
             throw new Error("EXPIRED_SUBSCRIPTION");
          }
          hasError = true;
        }
      }

      return !hasError;
    } catch (err) {
      throw err;
    }
  }
}
