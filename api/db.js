const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not configured');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}

module.exports = { getPool };