import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ICounter {
  _id: string
  seq: number
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
})

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema)

export default Counter
