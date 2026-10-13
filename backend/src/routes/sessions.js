const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createSession, updateSession, validateBody } = require('../validation');

const router = express.Router();
router.use(verifyToken);

// Each role only sees what it should:
// admin -> everything, tutor -> their sessions, student -> their sessions.
router.get('/', async (req, res) => {
    const { id, role } = req.user;
    let sql = 'SELECT * FROM sessions';
    let params = [];

    if (role === 'tutor') {
        sql += ' WHERE tutor_id = ?';
        params = [id];
    } else if (role === 'student') {
        sql += ' WHERE student_id = ?';
        params = [id];
    }

    const [rows] = await db.query(sql + ' ORDER BY session_date', params);
    res.json({ total_sessions: rows.length, sessions: rows });
});

router.post('/', requireRole('admin', 'tutor'), validateBody(createSession), async (req, res) => {
    const s = req.body;

    // Tutors can only book for themselves; the tutor_id in the request is ignored.
    const tutorId = req.user.role === 'tutor' ? req.user.id : s.tutor_id;
    if (!tutorId) {
        return res.status(400).json({ error: 'Invalid request data', details: '"tutor_id" is required' });
    }

    const [result] = await db.query(
        `INSERT INTO sessions (tutor_id, student_id, session_date, duration, status, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tutorId, s.student_id ?? null, new Date(s.session_date), s.duration, s.status, s.notes || null]
    );

    res.status(201).json({ message: 'Session created', sessionId: result.insertId });
});

// Loads a session and checks the current user may change it.
// Admins can change any session; tutors only their own.
async function findEditableSession(req, res) {
    const [rows] = await db.query('SELECT id, tutor_id FROM sessions WHERE id = ?', [req.params.id]);
    const session = rows[0];

    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return null;
    }
    if (req.user.role === 'tutor' && session.tutor_id !== req.user.id) {
        // 404 instead of 403 so tutors can't probe for other tutors' session ids.
        res.status(404).json({ error: 'Session not found' });
        return null;
    }
    return session;
}

router.put('/:id', requireRole('admin', 'tutor'), validateBody(updateSession), async (req, res) => {
    const session = await findEditableSession(req, res);
    if (!session) return;

    // Build the SET clause from only the fields that were sent.
    // Column names come from the Joi schema, never from raw user input.
    const fields = Object.keys(req.body);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => req.body[f]);

    await db.query(`UPDATE sessions SET ${setClause} WHERE id = ?`, [...values, session.id]);
    res.json({ message: 'Session updated' });
});

router.delete('/:id', requireRole('admin', 'tutor'), async (req, res) => {
    const session = await findEditableSession(req, res);
    if (!session) return;

    await db.query('DELETE FROM sessions WHERE id = ?', [session.id]);
    res.json({ message: 'Session deleted' });
});

module.exports = router;
