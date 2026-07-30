import mongoose, { Document, Schema, Model } from 'mongoose'
import Counter from './Counter.js'

export interface ISyncChange {
  sequence: number
  userId: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  entityVersion: number
  clientChangeId: string // Used for idempotency
  record?: any // The full snapshot of the entity at this version, or tombstone
  changedAt: string
}

export interface ISyncChangeDocument extends ISyncChange, Document {}

const SyncChangeSchema = new Schema<ISyncChangeDocument>(
  {
    sequence: { type: Number, unique: true },
    userId: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true },
    operation: { type: String, enum: ['create', 'update', 'delete'], required: true },
    entityVersion: { type: Number, required: true },
    clientChangeId: { type: String, required: true, index: true },
    record: { type: Schema.Types.Mixed },
    changedAt: { type: String, required: true }
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        const cleanRet = ret as Partial<Record<string, any>>
        delete cleanRet._id
        delete cleanRet.__v
        return cleanRet
      }
    }
  }
)

// Pre-save hook to auto-increment the sequence field
SyncChangeSchema.pre('save', async function () {
  if (this.isNew && !this.sequence) {
    const counter = await Counter.findByIdAndUpdate(
      'sync_change_sequence',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    )
    this.sequence = counter!.seq
  }
})

// Index for efficiently querying sync pulls: given a userId, entityType, and a cursor (sequence)
SyncChangeSchema.index({ userId: 1, entityType: 1, sequence: 1 })

const SyncChange: Model<ISyncChangeDocument> =
  mongoose.models.SyncChange || mongoose.model<ISyncChangeDocument>('SyncChange', SyncChangeSchema)

export default SyncChange
