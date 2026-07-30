# Notification Architecture (Phase 2 Roadmap)

To maintain the purity and testability of the `@markbel/sync` package, Notifications are architected as an independent observer system rather than being deeply embedded in the `SyncManager` orchestrator.

## The Observer Pattern

The `SyncManager` exposes an event emitter system (`syncManager.subscribe`). During a Pull Phase, when new `RemoteChange` records are applied locally, the SyncEngine fires structured events about the entities changed.

```
Sync Event -> Notification Service -> Platform Notification Adapter -> OS
```

## Architecture

1. **Notification Service (Domain Logic)**
   - Resides outside `@markbel/sync` (e.g., in `packages/notifications` or at the application layer).
   - Responsible for deduping logic, reading user notification preferences (e.g., "Mute this tag"), and timezone formatting.
   - Listens to Sync Events.

2. **Platform Notification Adapter**
   - Implements a generic `NotificationAdapter` interface (e.g., `showLocalNotification(title, body, payload)`).
   - **Web**: Implements Web Push API and `ServiceWorkerRegistration.showNotification()`.
   - **Mobile**: Implements Expo Notifications (`expo-notifications`).
   - **Desktop**: Implements Electron's native `Notification` module.

By completely separating these concerns, the Core Sync Engine guarantees that failures in the Notification permission flows or OS APIs will never interrupt or crash data synchronization.
