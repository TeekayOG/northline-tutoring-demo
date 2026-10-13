const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { adminCreateUser, validateBody } = require('../validation');

const router = express.Router();

// Everything in this file is admin-only.
router.use(verifyToken, requireRole('admin'));

router.get('/', async (req, res) => {
    const [rows] = await db.query('SELECT id, email, role, created_at FROM users ORDER BY id');
    res.json({ users: rows });
});

// Admins can create tutor and admin accounts.
router.post('/', validateBody(adminCreateUser), async (req, res) => {
    const { email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    try {
        const [result] = await db.query(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, hashed, role]
        );
        res.status(201).json({ message: 'User created', userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }
        throw err;
    }
});

module.exports = router;
