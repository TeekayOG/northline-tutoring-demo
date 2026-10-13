require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
    console.error('JWT_SECRET is missing or still the placeholder. Set it in .env (see .env.example).');
    process.exit(1);
}

const app = require('./src/app');
const db = require('./src/db');

const PORT = process.env.PORT || 5000;

db.query('SELECT 1')
    .then(() => console.log('Connected to the database'))
    .catch((err) => console.error('Database connection failed:', err.message));

app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
