const jwt = require('jsonwebtoken');

// Checks the "Authorization: Bearer <token>" header and attaches the user to req.
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Only lets through users whose role is in the allowed list.
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
};

module.exports = { verifyToken, requireRole };
