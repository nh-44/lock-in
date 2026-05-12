const { getPool } = require('./db');
const { resolveGoogleIdentity } = require('./auth');

module.exports = async (req, res) => {
  const pool = getPool();

  try {
    const { google_id } = await resolveGoogleIdentity(req, { allowUnverifiedFallback: true });
    const userResult = await pool.query('SELECT id FROM users WHERE google_id = $1', [google_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT * FROM inbody_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 10',
        [userId]
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { date, body_fat, skeletal_muscle, trunk_fat, whr, bmr, recovery_status } = req.body || {};

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Date must be YYYY-MM-DD format' });
      }

      const result = await pool.query(
        `INSERT INTO inbody_logs (user_id, date, body_fat, skeletal_muscle, trunk_fat, whr, bmr, recovery_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, date) DO UPDATE SET
           body_fat = COALESCE(EXCLUDED.body_fat, inbody_logs.body_fat),
           skeletal_muscle = COALESCE(EXCLUDED.skeletal_muscle, inbody_logs.skeletal_muscle),
           trunk_fat = COALESCE(EXCLUDED.trunk_fat, inbody_logs.trunk_fat),
           whr = COALESCE(EXCLUDED.whr, inbody_logs.whr),
           bmr = COALESCE(EXCLUDED.bmr, inbody_logs.bmr),
           recovery_status = COALESCE(EXCLUDED.recovery_status, inbody_logs.recovery_status)
         RETURNING *`,
        [userId, date || new Date().toISOString().split('T')[0],
         body_fat ?? null, skeletal_muscle ?? null, trunk_fat ?? null,
         whr ?? null, bmr ?? null, recovery_status ?? null]
      );

      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Log id is required' });
      }
      await pool.query('DELETE FROM inbody_logs WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Error in /api/inbody:', error);
    const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
};
