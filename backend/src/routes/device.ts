import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import Device from '../models/Device.js'

const router = Router()

// GET /api/devices
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const devices = await Device.find({ userId: req.userId }).lean()
    res.json(devices)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
})

// POST /api/devices/register
router.post('/register', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { deviceId, platform, appVersion } = req.body
    if (!deviceId || !platform) {
      return res.status(400).json({ error: 'deviceId and platform are required' })
    }

    const now = new Date().toISOString()
    let device = await Device.findOne({ id: deviceId, userId: req.userId })

    if (device) {
      device.lastSeenAt = now
      device.appVersion = appVersion || device.appVersion
      device.updatedAt = now
      await device.save()
    } else {
      device = new Device({
        id: deviceId,
        userId: req.userId,
        platform,
        appVersion: appVersion || '1.0.0',
        pushToken: null,
        isEnabled: true,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now
      })
      await device.save()
    }

    res.json(device.toJSON())
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
})

// PUT /api/devices/:id/token
router.put('/:id/token', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { pushToken } = req.body
    const device = await Device.findOne({ id: req.params.id, userId: req.userId })
    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    device.pushToken = pushToken || null
    device.updatedAt = new Date().toISOString()
    await device.save()

    res.json(device.toJSON())
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
})

// PUT /api/devices/:id/status
router.put('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { isEnabled } = req.body
    const device = await Device.findOne({ id: req.params.id, userId: req.userId })
    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    device.isEnabled = Boolean(isEnabled)
    device.updatedAt = new Date().toISOString()
    await device.save()

    res.json(device.toJSON())
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
})

export default router
