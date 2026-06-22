import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev'
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
    req.userId = decoded.id
    next()
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
  }
}
