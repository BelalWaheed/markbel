import jwt from 'jsonwebtoken';
export function authMiddleware(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev';
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
}
