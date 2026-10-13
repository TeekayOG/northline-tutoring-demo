// Fills the database with FAKE demo data. Wipes existing users and sessions first.
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/db');

const DEMO_PASSWORD = 'DemoPass123!';

const users = [
    { email: 'admin@demo.test', role: 'admin' },
    { email: 'tutor@demo.test', role: 'tutor' },
    { email: 'tutor2@demo.test', role: 'tutor' },
    { email: 'student1@demo.test', role: 'student' },
    { email: 'student2@demo.test', role: 'student' },
    { email: 'student3@demo.test', role: 'student' }
];

// Dates relative to today, so the dashboard always has past and upcoming sessions.
function daysFromNow(days, hour) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
}

(async () => {
    await db.query('DELETE FROM sessions');
    await db.query('DELETE FROM users');

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const ids = {};
    for (const u of users) {
        const [r] = await db.query('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [u.email, hash, u.role]);
        ids[u.email] = r.insertId;
    }

    const tutor = ids['tutor@demo.test'];
    const tutor2 = ids['tutor2@demo.test'];
    const [s1, s2, s3] = ['student1', 'student2', 'student3'].map((s) => ids[`${s}@demo.test`]);

    const sessions = [
        // Past sessions already marked
        [tutor, s1, daysFromNow(-12, 16), 60, 'completed', null],
        [tutor, s2, daysFromNow(-10, 17), 90, 'completed', null],
        [tutor, s3, daysFromNow(-8, 15), 60, 'no-show', null],
        [tutor2, s2, daysFromNow(-6, 18), 60, 'completed', null],
        // Past sessions still waiting for feedback
        [tutor, s1, daysFromNow(-3, 16), 60, 'upcoming', null],
        [tutor, s3, daysFromNow(-1, 17), 45, 'upcoming', null],
        // Upcoming sessions
        [tutor, s2, daysFromNow(1, 16), 60, 'upcoming', null],
        [tutor, s1, daysFromNow(3, 17), 90, 'upcoming', null],
        [tutor, s3, daysFromNow(6, 15), 60, 'upcoming', null],
        [tutor2, s1, daysFromNow(4, 18), 60, 'upcoming', null],
        // Blocked time (no student)
        [tutor, null, daysFromNow(5, 0), 1440, 'blocked', 'Exam week'],
    ];

    for (const s of sessions) {
        await db.query(
            'INSERT INTO sessions (tutor_id, student_id, session_date, duration, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
            s
        );
    }

    console.log(`Seeded ${users.length} users and ${sessions.length} sessions.`);
    console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
    await db.end();
})().catch(async (err) => {
    console.error('Seeding failed:', err.message);
    await db.end();
    process.exit(1);
});
