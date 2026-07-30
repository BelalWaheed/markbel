# Conflict Resolution

Markbel utilizes a Last-Write-Wins (LWW) conflict strategy governed strictly by the Backend Server as the single source of truth.

## Base Versioning

Every entity stored locally keeps track of its logical `version` integer (starting at `0` upon creation).

Whenever a user mutates an entity offline, the local database increments the entity's version, and logs an Outbox record containing the `baseVersion`—which is the version of the entity *before* the modification was made.

```json
{
  "entityId": "bmk_def",
  "operation": "update",
  "baseVersion": 2,
  "payload": { "title": "New Title" }
}
```

## Server Evaluation

When the Backend receives a Push payload, it performs a strict concurrency check:

1. **Match**: If the `baseVersion` in the outbox payload EXACTLY matches the Server's current `version` for that entity, the update is Accepted. The Server increments the entity version to `3`, applies the mutation, and responds with `success`.
2. **Conflict**: If the Server's current `version` is `3`, but the payload's `baseVersion` is `2` (meaning another client modified the entity while this client was offline), the Server REJECTS the push.
   - The Server responds with `status: "rejected"` and `reason: "conflict"`.

## Client Resolution (Server Wins)

When the `SyncManager` processes a `rejected` response due to a conflict, it enforces the "Server Wins" strategy.

1. It immediately discards the local pending Outbox item.
2. The subsequent `Pull Phase` (which always runs immediately after a Push Phase) will pull the latest Server version of that entity down to the client.
3. The local client silently overwrites the conflicting local changes with the authoritative Server state.

*Note: For a simple bookmarking architecture, LWW Server-Wins is heavily preferred over Operational Transformation (OT) or CRDTs for its sheer simplicity and reliability.*
