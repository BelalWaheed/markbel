import mongoose from 'mongoose'

let cachedConnection: Promise<typeof mongoose> | null = null

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside your .env file.')
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  if (!cachedConnection) {
    console.log('[Mongoose] Connecting to database...')
    cachedConnection = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10
    }).catch((err) => {
      cachedConnection = null
      throw err
    })
  }

  await cachedConnection
  return mongoose.connection
}
