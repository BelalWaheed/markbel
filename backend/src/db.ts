import mongoose from 'mongoose'

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside your .env file.')
  }

  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection
  }

  console.log('[Mongoose] Connecting to database...')
  return mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    maxPoolSize: 10
  })
}
