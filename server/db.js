import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connect to the scheduling app's database (READ-ONLY)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'scheduling_db',
  user: process.env.DB_USER || 'icanacademy',
  password: process.env.DB_PASSWORD || ''
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to scheduling database (read-only)');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

export default pool;
