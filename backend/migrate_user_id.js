const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('--- Database Migration: User Data Isolation ---');

    // 1. Add user_id to workflows
    console.log('Adding user_id to workflows table...');
    await pool.query(`
      ALTER TABLE workflows 
      ADD COLUMN user_id VARCHAR(36) AFTER id
    `);
    console.log('✅ Added user_id to workflows');

    // 2. Add user_id to executions
    console.log('Adding user_id to executions table...');
    await pool.query(`
      ALTER TABLE executions 
      ADD COLUMN user_id VARCHAR(36) AFTER id
    `);
    console.log('✅ Added user_id to executions');

    // 3. Optional: Assign existing data to the first user found (if any)
    const [users] = await pool.query('SELECT id FROM users LIMIT 1');
    if (users.length > 0) {
      const firstUserId = users[0].id;
      console.log(`Assigning existing records to user: ${firstUserId}`);
      await pool.query('UPDATE workflows SET user_id = ? WHERE user_id IS NULL', [firstUserId]);
      await pool.query('UPDATE executions SET user_id = ? WHERE user_id IS NULL', [firstUserId]);
      console.log('✅ Existing records assigned');
    } else {
      console.log('⚠️ No users found. Existing records left with NULL user_id (will be hidden to new users).');
    }

    console.log('\n--- Migration Completed Successfully ---');
    await pool.end();
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('ℹ️ Columns already exist. Skipping.');
      process.exit(0);
    }
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
