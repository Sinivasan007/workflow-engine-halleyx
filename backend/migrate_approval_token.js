/**
 * migrate_approval_token.js
 * Adds approval_token and token_expires_at columns to execution_logs table.
 */

const pool = require('./config/db');

async function migrate() {
  try {
    // Check if columns already exist
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'execution_logs' 
       AND COLUMN_NAME IN ('approval_token', 'token_expires_at')`
    );
    
    const existing = columns.map(c => c.COLUMN_NAME);
    
    if (!existing.includes('approval_token')) {
      console.log('Adding approval_token column...');
      await pool.execute(`ALTER TABLE execution_logs ADD COLUMN approval_token VARCHAR(255) DEFAULT NULL`);
    }
    
    if (!existing.includes('token_expires_at')) {
      console.log('Adding token_expires_at column...');
      await pool.execute(`ALTER TABLE execution_logs ADD COLUMN token_expires_at DATETIME DEFAULT NULL`);
    }
    
    console.log('✅ Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
