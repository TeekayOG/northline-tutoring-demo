// Creates the database (if needed) and runs db/schema.sql.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    const dbName = process.env.DB_NAME;
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);

    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await conn.query(schema);

    console.log(`Database "${dbName}" is ready.`);
    await conn.end();
})().catch((err) => {
    console.error('Setup failed:', err.message);
    process.exit(1);
});
