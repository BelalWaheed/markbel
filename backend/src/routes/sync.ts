import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import Bookmark from '../models/Bookmark.js'
import SyncChange from '../models/SyncChange.js'

const router = Router()

// Push changes from client
router.post('/push', authMiddleware, async (req: AuthRequest, res) => {
  const { deviceId, requestId, changes } = req.body
  const userId = req.userId!

  if (!deviceId || !changes || !Array.isArray(changes)) {
    return res.status(400).json({ error: 'Invalid push request payload' })
  }

  const results = []

  for (const change of changes) {
    const { changeId, entityType, entityId, operation, baseVersion, payload } = change
    
    // Check for idempotency: has this changeId already been applied?
    const existingSync = await SyncChange.findOne({ clientChangeId: changeId })
    if (existingSync) {
      results.push({
        changeId,
        entityId,
        status: 'duplicate',
        version: existingSync.entityVersion
      })
      continue
    }

    if (entityType !== 'bookmark') {
      results.push({
        changeId,
        entityId,
        status: 'rejected',
        reason: 'Unsupported entity type'
      })
      continue
    }

    try {
      let bookmark = await Bookmark.findOne({ id: entityId, userId })
      const currentVersion = bookmark ? bookmark.version : 0
      
      // If client's baseVersion doesn't match our current version, it's a conflict
      // EXCEPT when creating a brand new bookmark (bookmark doesn't exist, baseVersion is 0)
      if (operation === 'create' && currentVersion > 0) {
        // trying to create something that exists
        results.push({
          changeId,
          entityId,
          status: 'conflict',
          clientBaseVersion: baseVersion,
          serverVersion: currentVersion,
          serverRecord: bookmark
        })
        continue
      }
      
      if (operation !== 'create' && currentVersion !== baseVersion) {
        results.push({
          changeId,
          entityId,
          status: 'conflict',
          clientBaseVersion: baseVersion,
          serverVersion: currentVersion,
          serverRecord: bookmark
        })
        continue
      }

      // Apply changes
      const newVersion = currentVersion + 1
      const now = new Date().toISOString()
      
      if (operation === 'create') {
        bookmark = new Bookmark({
          ...payload,
          id: entityId,
          userId,
          version: newVersion,
          createdAt: payload.createdAt || now,
          updatedAt: payload.updatedAt || now
        })
        await bookmark.save()
      } else if (operation === 'update' && bookmark) {
        Object.assign(bookmark, payload)
        bookmark.version = newVersion
        bookmark.updatedAt = payload.updatedAt || now
        await bookmark.save()
      } else if (operation === 'delete' && bookmark) {
        bookmark.deletedAt = now
        bookmark.version = newVersion
        await bookmark.save()
      }

      // Record in SyncChange log
      const syncChange = new SyncChange({
        userId,
        entityType,
        entityId,
        operation,
        entityVersion: newVersion,
        clientChangeId: changeId,
        record: bookmark?.toJSON() || null,
        changedAt: now
      })
      await syncChange.save()

      results.push({
        changeId,
        entityId,
        status: 'applied',
        version: newVersion
      })

    } catch (e: any) {
      console.error(`Sync error for ${changeId}:`, e)
      results.push({
        changeId,
        entityId,
        status: 'rejected',
        reason: e.message
      })
    }
  }

  res.json({ results })
})

// Pull changes from server
router.get('/pull', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!
  const cursor = parseInt(req.query.cursor as string) || 0
  const limit = parseInt(req.query.limit as string) || 100
  const entityType = req.query.entity as string

  const query: any = {
    userId,
    sequence: { $gt: cursor }
  }
  
  if (entityType) {
    query.entityType = entityType
  }

  const changes = await SyncChange.find(query)
    .sort({ sequence: 1 })
    .limit(limit)

  const nextCursor = changes.length > 0 ? changes[changes.length - 1].sequence : cursor
  const hasMore = changes.length === limit

  const formattedChanges = changes.map(c => ({
    sequence: c.sequence,
    entityType: c.entityType,
    entityId: c.entityId,
    operation: c.operation,
    version: c.entityVersion,
    record: c.record,
    deletedAt: c.operation === 'delete' ? (c.record?.deletedAt || c.changedAt) : null
  }))

  res.json({
    changes: formattedChanges,
    nextCursor,
    hasMore
  })
})

export default router
