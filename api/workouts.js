const { getPool } = require('./db');
const { resolveGoogleIdentity } = require('./auth');

async function getUserId(pool, googleId) {
    if (!googleId) {
        return null;
    }
    const userResult = await pool.query('SELECT id FROM users WHERE google_id = $1', [googleId]);
    return userResult.rows[0]?.id || null;
}

function isValidDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidMonth(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

module.exports = async (req, res) => {
    const pool = getPool();

  if (req.method === 'POST') {
    try {
            const { date, exercises = [], completion_pct, rest_day } = req.body || {};

            if (!isValidDate(date)) {
                return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required.' });
            }

            if (!Array.isArray(exercises)) {
                return res.status(400).json({ error: 'Exercises must be an array.' });
            }

            const { google_id } = await resolveGoogleIdentity(req, { allowUnverifiedFallback: true });
            const userId = await getUserId(pool, google_id);
            if (!userId) {
                return res.status(404).json({ error: 'User not found.' });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pct = completion_pct != null ? completion_pct : 100;
                const isRestDay = rest_day === true || rest_day === 'true';
                const sessionResult = await client.query(
                    `INSERT INTO workout_sessions (user_id, date, completion_pct, rest_day)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, date) DO UPDATE SET completion_pct = EXCLUDED.completion_pct, rest_day = EXCLUDED.rest_day
                     RETURNING id`,
                    [userId, date, pct, isRestDay]
                );
                const sessionId = sessionResult.rows[0].id;

                await client.query('DELETE FROM workout_exercises WHERE session_id = $1', [sessionId]);

                for (const exercise of exercises) {
                    if (!exercise || !exercise.name) {
                        continue;
                    }
                    await client.query(
                        'INSERT INTO workout_exercises (session_id, exercise_name, sets, reps, weight) VALUES ($1, $2, $3, $4, $5)',
                        [sessionId, exercise.name, exercise.sets ?? null, exercise.reps ?? null, exercise.weight ?? null]
                    );
                }

                await client.query('COMMIT');
                res.status(201).json({ success: true, sessionId, exercisesInserted: exercises.length, isUpdate: exercises.length === 0 ? false : true });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
    } catch (error) {
            console.error('Error in POST /api/workouts:', error);
            const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
            res.status(status).json({ error: 'Unable to save workout session', details: error.message });
    }
  } else if (req.method === 'GET') {
    try {
            const { date, month } = req.query;
            const { google_id } = await resolveGoogleIdentity(req, { allowUnverifiedFallback: true });
            const userId = await getUserId(pool, google_id);

            if (!userId) {
                return res.status(404).json({ error: 'User not found.' });
            }

            if (date) {
                if (!isValidDate(date)) {
                    return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required.' });
                }

                const result = await pool.query(
                    `SELECT s.date, s.rest_day, e.exercise_name, e.sets, e.reps, e.weight
                     FROM workout_sessions s
                     LEFT JOIN workout_exercises e ON s.id = e.session_id
                     WHERE s.user_id = $1 AND s.date = $2
                     ORDER BY e.id`,
                    [userId, date]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Workout not found.' });
                }

                return res.status(200).json({
                    date,
                    exercises: result.rows
                        .filter((row) => row.exercise_name)
                        .map((row) => ({
                            exercise_name: row.exercise_name,
                            sets: row.sets,
                            reps: row.reps,
                            weight: row.weight,
                        })),
                });
            }

            if (isValidMonth(month)) {
                const [year, monthNumber] = month.split('-').map(Number);
                const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
                const nextMonth = new Date(Date.UTC(year, monthNumber, 1));

                const result = await pool.query(
                    `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, completion_pct, rest_day
                     FROM workout_sessions
                     WHERE user_id = $1 AND date >= $2 AND date < $3
                     ORDER BY date DESC`,
                    [userId, monthStart, nextMonth]
                );

                return res.status(200).json(result.rows);
            }

            const result = await pool.query(
                `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, completion_pct, rest_day
                 FROM workout_sessions
                 WHERE user_id = $1
                 ORDER BY date DESC`,
                [userId]
            );

            res.status(200).json(result.rows);
    } catch (error) {
            console.error('Error in GET /api/workouts:', error);
            const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
            res.status(status).json({ error: 'Internal Server Error', details: error.message });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { date, exercises = [] } = req.body || {};

      if (!isValidDate(date)) {
        return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required.' });
      }

      const { google_id } = await resolveGoogleIdentity(req, { allowUnverifiedFallback: true });
      const userId = await getUserId(pool, google_id);
      if (!userId) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const sessionResult = await client.query(
          'SELECT id FROM workout_sessions WHERE user_id = $1 AND date = $2 FOR UPDATE',
          [userId, date]
        );

        if (sessionResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Workout session not found for that date.' });
        }

        const sessionId = sessionResult.rows[0].id;

        await client.query('DELETE FROM workout_exercises WHERE session_id = $1', [sessionId]);

        for (const exercise of exercises) {
          if (!exercise || !exercise.name) continue;
          await client.query(
            'INSERT INTO workout_exercises (session_id, exercise_name, sets, reps, weight) VALUES ($1, $2, $3, $4, $5)',
            [sessionId, exercise.name, exercise.sets ?? null, exercise.reps ?? null, exercise.weight ?? null]
          );
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, sessionId, exercisesUpdated: exercises.length });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error in PATCH /api/workouts:', error);
      const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
      res.status(status).json({ error: 'Unable to update workout session', details: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { date } = req.body || {};

      if (!isValidDate(date)) {
        return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required.' });
      }

      const { google_id } = await resolveGoogleIdentity(req, { allowUnverifiedFallback: true });
      const userId = await getUserId(pool, google_id);
      if (!userId) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const result = await pool.query(
        'DELETE FROM workout_sessions WHERE user_id = $1 AND date = $2 RETURNING id',
        [userId, date]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Workout session not found for that date.' });
      }

      res.status(200).json({ success: true, deletedSessionId: result.rows[0].id });
    } catch (error) {
      console.error('Error in DELETE /api/workouts:', error);
      const status = error.message.includes('token') || error.message.includes('Authentication') ? 401 : 500;
      res.status(status).json({ error: 'Unable to delete workout session', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
