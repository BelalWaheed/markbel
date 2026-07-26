import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IUser {
  id: string
  name: string
  email: string
  password?: string
  avatar?: string
  ticktickAccessToken?: string
  ticktickRefreshToken?: string
  ticktickTokenExpiresAt?: number
  ticktickDefaultProjectId?: string
  createdAt: string
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    ticktickAccessToken: { type: String, default: '' },
    ticktickRefreshToken: { type: String, default: '' },
    ticktickTokenExpiresAt: { type: Number, default: 0 },
    ticktickDefaultProjectId: { type: String, default: '' },
    createdAt: { type: String, required: true }
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        const cleanRet = ret as Partial<Record<string, any>>
        delete cleanRet._id
        delete cleanRet.__v
        delete cleanRet.password
        delete cleanRet.ticktickAccessToken
        delete cleanRet.ticktickRefreshToken
        return cleanRet
      }
    }
  }
)

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema)

export default User
