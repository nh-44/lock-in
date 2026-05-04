const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper to get user_id from google_id
async function getUserId(google_id) {
    if (!google_id) return null;
    const userResult = await pool.query('SELECT id FROM users WHERE google_id = $1', [google_id]);
    if (userResult.rows.length > 0) {
        return userResult.rows[0].id;
    }
    return null;
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { date, exercises, google_id } = req.body;

    if (!google_id) {
        return res.status(401).json({ error: 'Unauthorized: Google ID is required.' });
    }

    try {
        const userId = await getUserId(google_id);
        if (!userId) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Use a transaction to insert the session and its exercises
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const sessionResult = await client.query(
                'INSERT INTO workout_sessions (user_id, date) VALUES ($1, $2) RETURNING id',
                [userId, date]
            );
            const sessionId = sessionResult.rows[0].id;

            if (exercises && exercises.length > 0) {
                for (const exercise of exercises) {
                    await client.query(
                        'INSERT INTO workout_exercises (session_id, exercise_name, sets, reps, weight) VALUES ($1, $2, $3, $4, $5)',
                        [sessionId, exercise.name, exercise.sets, exercise.reps, exercise.weight]
                    );
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ success: true, sessionId });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error in POST /api/workouts:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  } else if (req.method === 'GET') {
    const { google_id, date } = req.query;

    if (!google_id) {
        return res.status(401).json({ error: 'Unauthorized: Google ID is required.' });
    }
    
    try {
        const userId = await getUserId(google_id);
        if (!userId) {
            return res.status(404).json({ error: 'User not found.' });
        }

        let query;
        let params;

        if (date) {
            // Get a specific day's workout
            query = `
                SELECT s.id, s.date, e.exercise_name, e.sets, e.reps, e.weight
                FROM workout_sessions s
                JOIN workout_exercises e ON s.id = e.session_id
                WHERE s.user_id = $1 AND s.date = $2
                ORDER BY e.id;
            `;
            params = [userId, date];
        } else {
            // Get all workout sessions for the user for the calendar view
            query = `
                SELECT DISTINCT date, 'workout' as status 
                FROM workout_sessions
                WHERE user_id = $1
                ORDER BY date DESC;
            `;
            params = [userId];
        }
        
        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in GET /api/workouts:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
