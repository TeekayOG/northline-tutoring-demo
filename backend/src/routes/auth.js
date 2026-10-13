const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { credentials, login, validateBody } = require('../validation');

const router = express.Router();
const SALT_ROUNDS = 10;

// Public self-registration. Always creates a STUDENT account:
// the role is never taken from the request, so nobody can sign up as admin.
router.post('/register', validateBody(credentials), async (req, res) => {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        const [result] = await db.query(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, hashed, 'student']
        );
        res.status(201).json({ message: 'Account created', userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }
        throw err;
    }
});

router.post('/login', validateBody(login), async (req, res) => {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT id, email, password, role FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // Same message for "no such email" and "wrong password",
    // so attackers can't tell which emails are registered.
    const valid = user && (await bcrypt.compare(password, user.password));
    if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

module.exports = router;
