const { getPool } = require('./db');
const { resolveGoogleIdentity } = require('./auth');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { google_id, email, name, picture } = await resolveGoogleIdentity(req);
      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const existingUser = await client.query(
          'SELECT id FROM users WHERE google_id = $1 LIMIT 1 FOR UPDATE',
          [google_id]
        );

        let result;

        if (existingUser.rows.length > 0) {
          result = await client.query(
            `UPDATE users
             SET email = $1, name = $2, picture = $3
             WHERE id = $4
             RETURNING *`,
            [email, name, picture, existingUser.rows[0].id]
          );
        } else {
          result = await client.query(
            'INSERT INTO users (email, name, google_id, picture) VALUES ($1, $2, $3, $4) RETURNING *',
            [email, name, google_id, picture]
          );
        }

        await client.query('COMMIT');
        res.status(200).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error in /api/user:', error);
      const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
      res.status(status).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
