import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IDevice {
  id: string; // The sync deviceId (e.g., browser-uuid)
  userId: string;
  platform: string; // 'web', 'mobile', 'desktop'
  appVersion: string;
  pushToken: string | null;
  isEnabled: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDeviceDocument extends IDevice, Document {}

const DeviceSchema = new Schema<IDeviceDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    platform: { type: String, required: true },
    appVersion: { type: String, required: true },
    pushToken: { type: String, default: null },
    isEnabled: { type: Boolean, default: true },
    lastSeenAt: { type: String, required: true },
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

DeviceSchema.index({ userId: 1, isEnabled: 1 })

const Device: Model<IDeviceDocument> =
  mongoose.models.Device || mongoose.model<IDeviceDocument>('Device', DeviceSchema)

export default Device
