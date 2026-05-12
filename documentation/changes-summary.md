# Lock-In Dashboard — Changes Summary

## New Features

### Rest Day Support
- Added `rest_day BOOLEAN` column to `workout_sessions` table
- POST `/api/workouts` accepts `rest_day: true/false`
- GET endpoints return `rest_day` in responses
- "Mark Rest Day" button on each day (Mon-Sat as secondary button, Sun as primary)
- Abuse protection: limits to 1 rest day per week, shows confirmation dialog

### Calendar Color System
- **Green** (`workout`): completion_pct = 100%
- **Yellow** (`partial`): completion_pct 1-99%
- **Blue** (`rest`): rest_day = true
- **Red** (`missed`): past days with no entry
- Legend updated to reflect all four states

### InBody Body Composition Tracking
- New `api/inbody.js` — CRUD for body composition logs
- New `api/stats.js` — lock-in stats, streak, adherence score
- InBody update modal with date, body fat %, skeletal muscle, trunk fat, WHR, BMR, recovery
- Dashboard cards with dynamic badges (High/Normal/Low) and progress bars
- DB seeded with initial values as of 2026-05-05: 25.8% BF, 27.9kg SMM, 27% trunk fat, 0.97 WHR

### Lock-In Dashboard (Schedule Tab)
- Current streak, best streak, weekly completion, lock-in score
- Total workouts, monthly adherence, today's status
- Timezone fix: frontend passes `&today=YYYY-MM-DD` to stats endpoint

### Workout Logging Improvements
- `completion_pct` column tracks partial completions
- Checkbox logic: enables button when ANY box is checked (not all)
- Button text shows count: "Log 3/8 exercises"
- `markDayComplete()` writes to DB (old code only updated DOM, lost on reload)
- PATCH and DELETE endpoints added for editing/deleting sessions
- `ON CONFLICT` upsert prevents duplicate sessions per day

## Code Organization

### New Files
- `api/inbody.js` — InBody CRUD handler
- `api/stats.js` — Stats/streak/adherence handler
- `db/schema.sql` — Migration SQL reference
- `test-server.js` — Local development server
- `documentation/changes-summary.md` — This file

### Modified Files
- `api/workouts.js` — Added rest_day, completion_pct, PATCH, DELETE
- `api/auth.js` — Added `allowUnverifiedFallback` for local testing
- `public/index.html` — Full dashboard UI, calendar colors, rest buttons, InBody modal

## Environment
- `GOOGLE_CLIENT_ID` is hardcoded in source (public OAuth identifier)
- `POSTGRES_URL` must be set as env var in Vercel/Neon
- Local testing: `POSTGRES_URL` env var + Google sign-in bypass via localStorage
