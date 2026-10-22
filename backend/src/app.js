const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const studentRoutes = require('./routes/students');

const app = express();

// Security headers. Cross-origin reads are allowed because the frontend is served from a different address.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Only the frontends listed in CORS_ORIGIN may call this API from a browser.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

// Slow down password guessing and mass sign-ups: 20 attempts per 15 minutes per IP.
// Turned off during automated tests so they stay predictable.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Too many attempts. Please try again in a few minutes.' }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authLimiter, authRoutes);
app.use('/users', userRoutes);
app.use('/sessions', sessionRoutes);
app.use('/students', studentRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors from async routes here automatically.
// Details are logged on the server, never sent to the client.
app.use((err, req, res, next) => {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
