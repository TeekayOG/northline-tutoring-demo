const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Student profiles for the tutor dashboard.
// Tutors only see students they have sessions with (and only their own sessions are counted).
// Admins see every student. Students can't use this route at all.
// Only safe fields are returned: never password hashes.
router.get('/', verifyToken, requireRole('admin', 'tutor'), async (req, res) => {
    const { id, role } = req.user;

    let sql;
    let params = [];

    if (role === 'tutor') {
        sql = `
            SELECT u.id, u.email,
                   COUNT(s.id) AS total_sessions,
                   SUM(s.status = 'completed') AS completed_sessions,
                   SUM(s.status = 'upcoming') AS upcoming_sessions,
                   MAX(s.session_date) AS last_session
            FROM sessions s
            JOIN users u ON u.id = s.student_id
            WHERE s.tutor_id = ? AND u.role = 'student'
            GROUP BY u.id, u.email
            ORDER BY u.email`;
        params = [id];
    } else {
        sql = `
            SELECT u.id, u.email,
                   COUNT(s.id) AS total_sessions,
                   SUM(s.status = 'completed') AS completed_sessions,
                   SUM(s.status = 'upcoming') AS upcoming_sessions,
                   MAX(s.session_date) AS last_session
            FROM users u
            LEFT JOIN sessions s ON s.student_id = u.id
            WHERE u.role = 'student'
            GROUP BY u.id, u.email
            ORDER BY u.email`;
    }

    const [rows] = await db.query(sql, params);

    // MySQL returns SUM() as a string, so turn the counts into real numbers
    const students = rows.map((r) => ({
        id: r.id,
        email: r.email,
        total_sessions: Number(r.total_sessions) || 0,
        completed_sessions: Number(r.completed_sessions) || 0,
        upcoming_sessions: Number(r.upcoming_sessions) || 0,
        last_session: r.last_session || null
    }));

    res.json({ total_students: students.length, students });
});

module.exports = router;
