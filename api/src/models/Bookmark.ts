import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IBookmark {
  id: string
  userId: string
  title: string
  url: string
  description?: string
  image?: string
  group: string
  isRead?: boolean
  readAt?: string
  isPinned?: boolean
  remindAt?: string
  isArchived?: boolean
  archiveGroup?: string
  ticktickTaskId?: string
  ticktickProjectId?: string
  createdAt: string
  updatedAt: string
  version: number
  deletedAt?: string | null
}

export interface IBookmarkDocument extends IBookmark, Document {}

const BookmarkSchema = new Schema<IBookmarkDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    group: { type: String, required: true, default: 'Unsorted' },
    isRead: { type: Boolean, default: false },
    readAt: { type: String, default: '' },
    isPinned: { type: Boolean, default: false },
    remindAt: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    archiveGroup: { type: String, default: '' },
    ticktickTaskId: { type: String, default: '' },
    ticktickProjectId: { type: String, default: '' },
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

BookmarkSchema.index({ userId: 1, group: 1, createdAt: 1 })
BookmarkSchema.index({ userId: 1, isArchived: 1, isRead: 1 })

const Bookmark: Model<IBookmarkDocument> =
  mongoose.models.Bookmark || mongoose.model<IBookmarkDocument>('Bookmark', BookmarkSchema)

export default Bookmark
