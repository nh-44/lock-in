const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    // Endpoint to find or create a user
    try {
      const { email, name, google_id, picture } = req.body;

      if (!email || !google_id) {
        return res.status(400).json({ error: 'Email and Google ID are required' });
      }

      // Check if user exists
      let user = await pool.query('SELECT * FROM users WHERE google_id = $1', [google_id]);

      if (user.rows.length === 0) {
        // Create user if they don't exist
        const newUser = await pool.query(
          'INSERT INTO users (email, name, google_id, picture) VALUES ($1, $2, $3, $4) RETURNING *',
          [email, name, google_id, picture]
        );
        user = newUser;
        console.log('New user created:', user.rows[0]);
      } else {
        console.log('User found:', user.rows[0]);
      }

      res.status(200).json(user.rows[0]);
    } catch (error) {
      console.error('Error in /api/user:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
