const mysql = require('mysql2/promise');
require('dotenv').config();

const isRemote = process.env.DB_HOST !== 'localhost';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // SSL required for Railway, skip for localhost
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connected to:', process.env.DB_NAME);
    console.log('📡 Host:', process.env.DB_HOST);
    connection.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('🔍 Check: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env');
    process.exit(1);
  }
})();

module.exports = pool;