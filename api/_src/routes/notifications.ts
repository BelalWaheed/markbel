import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import Device from "../models/Device.js";
import Bookmark from "../models/Bookmark.js";
import { PushService } from "../services/PushService.js";

const router = Router();
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "fallback_cron_secret";

// GET /api/notifications/vapid-key
router.get("/vapid-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/notifications/test
// Sends a test push notification to all registered devices for the authenticated user
router.post("/test", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const devices = await Device.find({ userId: req.userId, pushToken: { $exists: true, $ne: "" } }).lean();
    if (devices.length === 0) {
      res.status(400).json({ error: "No push-enabled devices found for your account. Enable push notifications on a client first." });
      return;
    }

    const payload = {
      title: "Markbel Push Test 🔖",
      body: "Instant Push Notification test successful! Notifications are working on this device.",
      url: "/",
    };

    let count = 0;
    for (const device of devices) {
      const success = await PushService.sendNotification(device as any, payload);
      if (success) count++;
    }

    res.json({ success: true, sent: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/notifications/dispatch
// Triggered by cron job to send notifications for due reminders
router.post("/dispatch", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const secretQuery = req.query.secret;
    const isAuthorized =
      (authHeader && authHeader === `Bearer ${CRON_SECRET}`) ||
      secretQuery === CRON_SECRET;

    if (!isAuthorized) {
      res.status(403).json({ error: "Unauthorized cron trigger" });
      return;
    }

    const now = new Date().toISOString();
    
    // Find all devices with a push token
    const devices = await Device.find({ pushToken: { $exists: true, $ne: "" } }).lean();
    let sentCount = 0;

    // Group by user
    const userDevicesMap = new Map<string, any[]>();
    devices.forEach((device) => {
      const list = userDevicesMap.get(device.userId) || [];
      list.push(device);
      userDevicesMap.set(device.userId, list);
    });

    for (const [userId, userDevices] of userDevicesMap.entries()) {
      // Find all due bookmarks for this user
      const dueBookmarks = await Bookmark.find({
        userId,
        isArchived: { $ne: true },
        isRead: { $ne: true },
        remindAt: { $ne: "", $lte: now },
      }).lean();

      if (dueBookmarks.length === 0) continue;

      const payload = {
        title: "Markbel Due Reminders ⏰",
        body: `You have ${dueBookmarks.length} bookmark${dueBookmarks.length > 1 ? "s" : ""} waiting to be read!`,
        url: "/?filter=due",
      };

      for (const device of userDevices) {
        try {
          const success = await PushService.sendNotification(device as any, payload);
          if (success) {
            sentCount++;
          }
        } catch (e: any) {
          if (e.message === "EXPIRED_SUBSCRIPTION") {
            // Remove the invalid push token from the device
            await Device.updateOne({ id: device.id }, { $unset: { pushToken: "" } });
          }
        }
      }
    }

    res.json({ success: true, notificationsSent: sentCount });
  } catch (err: any) {
    console.error("[Cron Dispatch Error]:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

export default router;
