# Synchronization Protocol

The `@markbel/sync` protocol is an HTTP-based, cursor-driven synchronization protocol designed for offline-first applications. It synchronizes JSON documents (entities) between isolated clients (Web, Mobile, Desktop) and a central authoritative backend.

## Overview

The protocol consists of two primary flows executed periodically by the `SyncManager`:
1. **Push Flow**: Sends local outbox mutations to the server.
2. **Pull Flow**: Fetches server-side mutations using a monotonically increasing integer cursor.

## The Cursor

The `cursor` is a monotonically increasing integer (often derived from a high-precision database timestamp or sequential ID). 
- **0**: Signifies a full sync (the client has no previous state).
- **>0**: Signifies a delta sync (the client only wants changes that occurred after this cursor).

Clients store the cursor locally (`SyncStorage.saveCursor()`) and send it in the Pull query string. The server responds with a new cursor representing the latest state it returned.

## Pull (Client -> Server)

**Endpoint:** `GET /api/sync/pull?entity={entityType}&cursor={cursor}&limit={limit}`

Clients ask the server for all remote changes applied to a specific `entityType` strictly *after* the provided `cursor`.

### Response Payload

```json
{
  "changes": [
    {
      "changeId": "evt_12345",
      "entityType": "bookmark",
      "entityId": "bmk_abc",
      "operation": "update",
      "version": 4,
      "payload": {
        "title": "New Title",
        "url": "https://example.com"
      },
      "deletedAt": null
    }
  ],
  "nextCursor": 1729384501
}
```

- `changeId`: Unique ID of the event log row.
- `version`: The new logical version of the entity (incremented on every update/delete).
- `payload`: Omitted if `operation` is `delete`.

## Push (Client -> Server)

**Endpoint:** `POST /api/sync/push`

Clients send their pending mutations from their local outbox.

### Request Payload

```json
{
  "entityType": "bookmark",
  "changes": [
    {
      "id": "outbox_1",
      "entityId": "bmk_def",
      "operation": "create",
      "baseVersion": 0,
      "payload": {
        "title": "Local Bookmark",
        "url": "https://markbel.com"
      }
    }
  ]
}
```

- `baseVersion`: The entity version the client *believes* it is modifying. 0 for creates. Crucial for conflict resolution.

### Response Payload

```json
{
  "results": [
    {
      "id": "outbox_1",
      "status": "success",
      "version": 1
    }
  ]
}
```

- `status`: Can be `success`, `rejected` (conflict), or `failed` (validation error).
- `reason`: Provided if rejected/failed.
