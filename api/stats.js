const { getPool } = require('./db');
const { resolveGoogleIdentity } = require('./auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { google_id } = await resolveGoogleIdentity(req, { allowUnverifiedFallback: true });
    if (!google_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pool = getPool();
    const userResult = await pool.query('SELECT id FROM users WHERE google_id = $1', [google_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    // Accept today from frontend to handle timezone differences
    const today = req.query.today || null;

    const streakResult = await pool.query(`
      WITH user_workouts AS (
        SELECT DISTINCT date::date
        FROM workout_sessions
        WHERE user_id = $1
        ORDER BY date::date DESC
      ),
      streak_calc AS (
        SELECT date, date - ROW_NUMBER() OVER (ORDER BY date ASC)::int AS grp
        FROM user_workouts
      )
      SELECT COUNT(*) AS current_streak
      FROM streak_calc
      WHERE grp = (SELECT grp FROM streak_calc ORDER BY date DESC LIMIT 1)
    `, [userId]);
    const currentStreak = parseInt(streakResult.rows[0]?.current_streak || '0');

    const bestStreakResult = await pool.query(`
      WITH user_workouts AS (
        SELECT DISTINCT date::date
        FROM workout_sessions
        WHERE user_id = $1
        ORDER BY date::date DESC
      ),
      groups AS (
        SELECT date, date - ROW_NUMBER() OVER (ORDER BY date ASC)::int AS grp
        FROM user_workouts
      )
      SELECT COUNT(*) AS streak
      FROM groups
      GROUP BY grp
      ORDER BY streak DESC
      LIMIT 1
    `, [userId]);
    const bestStreak = parseInt(bestStreakResult.rows[0]?.streak || '0');

    const refDate = today && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : null;

    const weekResult = await pool.query(`
      SELECT COUNT(*) AS completed
      FROM workout_sessions
      WHERE user_id = $1
        AND date >= date_trunc('week', ${refDate ? `$2::date` : 'CURRENT_DATE'})::date
        AND date <= ${refDate ? `$2::date` : 'CURRENT_DATE'}
    `, refDate ? [userId, refDate] : [userId]);
    const weekCompleted = parseInt(weekResult.rows[0]?.completed || '0');
    const weekExpected = 6;
    const weekAdherence = weekExpected > 0 ? Math.round((weekCompleted / weekExpected) * 100) : 0;

    const totalResult = await pool.query(`
      SELECT COUNT(*) AS total FROM workout_sessions WHERE user_id = $1
    `, [userId]);
    const totalWorkouts = parseInt(totalResult.rows[0]?.total || '0');

    const monthResult = await pool.query(`
      SELECT COUNT(*) AS completed
      FROM workout_sessions
      WHERE user_id = $1
        AND date >= date_trunc('month', ${refDate ? `$2::date` : 'CURRENT_DATE'})::date
        AND date <= ${refDate ? `$2::date` : 'CURRENT_DATE'}
    `, refDate ? [userId, refDate] : [userId]);
    const monthCompleted = parseInt(monthResult.rows[0]?.completed || '0');

    let monthExpected = 27;
    if (refDate) {
      const [y, m] = refDate.split('-').map(Number);
      const dim = new Date(Date.UTC(y, m, 0)).getDate();
      monthExpected = Math.min(Math.ceil(dim * 6 / 7), dim);
    } else {
      const dim = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 0)).getDate();
      monthExpected = Math.min(Math.ceil(dim * 6 / 7), dim);
    }
    const monthAdherence = monthExpected > 0 ? Math.round((monthCompleted / monthExpected) * 100) : 0;

    const adherenceScore = monthAdherence;
    const streakScore = Math.min(currentStreak * 10, 100);
    const totalScore = Math.min(totalWorkouts * 2, 100);
    const lockInScore = Math.round(
      adherenceScore * 0.3 + streakScore * 0.3 + totalScore * 0.4
    );

    const todayResult = await pool.query(
      refDate
        ? 'SELECT id FROM workout_sessions WHERE user_id = $1 AND date = $2'
        : 'SELECT id FROM workout_sessions WHERE user_id = $1 AND date = CURRENT_DATE',
      refDate ? [userId, refDate] : [userId]
    );
    const workedOutToday = todayResult.rows.length > 0;

    res.status(200).json({
      currentStreak,
      bestStreak,
      weekCompleted,
      weekExpected,
      weekAdherence,
      monthCompleted,
      monthExpected,
      monthAdherence,
      totalWorkouts,
      lockInScore,
      workedOutToday
    });
  } catch (error) {
    console.error('Error in /api/stats:', error);
    const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
};
