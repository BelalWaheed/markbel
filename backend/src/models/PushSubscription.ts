import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IPushSubscription {
  id: string
  userId: string
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  deviceLabel?: string
  createdAt: string
}

export interface IPushSubscriptionDocument extends IPushSubscription, Document {}

const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    deviceLabel: { type: String, default: '' },
    createdAt: { type: String, required: true }
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

PushSubscriptionSchema.index({ userId: 1, endpoint: 1 })

const PushSubscription: Model<IPushSubscriptionDocument> =
  mongoose.models.PushSubscription || mongoose.model<IPushSubscriptionDocument>('PushSubscription', PushSubscriptionSchema)

export default PushSubscription
