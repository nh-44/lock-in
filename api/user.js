const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyGoogleToken(token) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  if (!res.ok) throw new Error('Token verification failed');
  const payload = await res.json();
  if (payload.error) throw new Error(payload.error_description || 'Invalid token');
  return {
    google_id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'ID token is required' });
      }

      // Verify token with Google and extract user info
      const { google_id, email, name, picture } = await verifyGoogleToken(token);

      // Upsert user in DB
      let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [google_id]);

      if (result.rows.length === 0) {
        result = await pool.query(
          'INSERT INTO users (email, name, google_id, picture) VALUES ($1, $2, $3, $4) RETURNING *',
          [email, name, google_id, picture]
        );
        console.log('New user created:', result.rows[0]);
      } else {
        console.log('User found:', result.rows[0]);
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error in /api/user:', error);
      const status = error.message.includes('Token') ? 401 : 500;
      res.status(status).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
