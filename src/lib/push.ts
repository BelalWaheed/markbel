import { api } from "./api.js";

/**
 * Base64 url-safe to Uint8Array converter (required by PushManager)
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request notification permission and subscribe to PushManager.
 * Returns the stringified PushSubscription if successful, or null if denied/failed.
 */
export async function enableWebPush(): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Web Push] Not supported in this browser.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Web Push] Permission denied by user.");
      return null;
    }

    const swRegistration = await navigator.serviceWorker.ready;

    // Fetch VAPID key from backend
    const res = await api.get<{ publicKey: string }>("/notifications/vapid-key");
    const vapidPublicKey = res.publicKey;

    if (!vapidPublicKey) {
      console.warn("[Web Push] Missing VAPID public key from backend.");
      return null;
    }

    // Subscribe
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    return JSON.stringify(subscription);
  } catch (err) {
    console.error("[Web Push] Failed to subscribe:", err);
    return null;
  }
}
