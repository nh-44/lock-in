const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { date, attendance, weight, height, pr } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO workouts (date, attendance, weight, height, pr) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [date, attendance, weight, height, pr]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM workouts ORDER BY date DESC');
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
