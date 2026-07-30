# SyncManager Orchestration

The `SyncManager` class in `@markbel/sync` is the core background orchestrator of Markbel's offline-first architecture. It runs in an isolated JS context without direct dependencies on DOM, local storage implementations, or specific HTTP libraries.

## Orchestration Loop

When `SyncManager.startPeriodicSync()` is invoked, it begins an orchestration loop governed by:
1. **Lifecycle Constraints**: Only runs if the App is in the `foreground` and `online`.
2. **Leader Election**: Only the Elected Leader executes the loop.
3. **Adaptive Intervals**:
   - High activity: Polling frequency increases.
   - Low activity: Polling slows down to conserve battery and bandwidth (up to 300s).

## Execution Sequence

A full sync iteration executes strictly sequentially to prevent race conditions:

1. **Check Pre-conditions**: Abort if offline, backgrounded, or unauthenticated.
2. **Push Phase**: 
   - Retrieve pending Outbox items from `SyncStorage`.
   - Send to Server via `ApiClient`.
   - Process Server Results. Mark items as `success`, `rejected`, or `failed`.
   - Compact Outbox (Delete `success` items).
3. **Pull Phase**:
   - Retrieve the last known `cursor` from `SyncStorage`.
   - Query Server for remote changes.
   - Persist remote changes locally via `SyncStorage.applyRemoteChanges()`.
   - Save the new `cursor`.
4. **Notify**: Broadcast new `SyncState.Idle` to subscribers (UI).

## Error Handling & Retry Policies

- **5xx Server Errors**: Treated as transient. Triggers an exponential backoff sequence and retries the sync later.
- **4xx Client Errors**: 
  - `401 Unauthorized`: Immediately aborts sync, clears cached tokens, and triggers the `onAuthExpired` lifecycle hook.
  - `409 Conflict`: Automatically processed by Conflict Resolution logic (Server Wins).

## Cancellation (AbortSignal)

If the environment transitions to `offline` or `background` mid-sync, the `SyncManager` aborts all ongoing HTTP requests using `AbortController`, ensuring resources are freed instantly.
