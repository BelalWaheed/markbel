import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IGroup {
  id: string
  userId: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
  version: number
  deletedAt?: string | null
}

export interface IGroupDocument extends IGroup, Document {}

const GroupSchema = new Schema<IGroupDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: 'cyan' },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    version: { type: Number, required: true, default: 0 },
    deletedAt: { type: String, default: null }
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

GroupSchema.index({ userId: 1, name: 1 })

const Group: Model<IGroupDocument> =
  mongoose.models.Group || mongoose.model<IGroupDocument>('Group', GroupSchema)

export default Group
