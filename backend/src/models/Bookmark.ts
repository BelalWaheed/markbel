import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IBookmark {
  id: string
  userId: string
  title: string
  url: string
  description?: string
  image?: string
  group: string
  createdAt: string
  updatedAt: string
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
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true }
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

const Bookmark: Model<IBookmarkDocument> =
  mongoose.models.Bookmark || mongoose.model<IBookmarkDocument>('Bookmark', BookmarkSchema)

export default Bookmark
