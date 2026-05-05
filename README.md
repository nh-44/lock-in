# Enhanced Functional Workout Program

This is a personal workout website that displays a daily workout schedule, allows you to track your progress, and is ready to be deployed on Vercel.

## Deployment

Follow these steps to deploy the website:

### 1. Create a Git Repository

- Create a new repository on GitHub, GitLab, or Bitbucket.
- Initialize a Git repository in your local project folder, commit the files, and push them to the remote repository.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

### 2. Set up a PostgreSQL Database

- Go to [Supabase](https://supabase.com/) or [Neon](https://neon.tech/) and create a new project.
- Once the project is created, find the **PostgreSQL connection string** (it might be labeled as `URI`). You will need this for the next step.

### 3. Deploy to Vercel

- Go to [Vercel](https://vercel.com/) and sign up with your Git provider account.
- Click on "Add New..." and select "Project".
- Import the Git repository you created.
- Vercel will automatically detect the project settings.
- Go to the "Environment Variables" section in the project settings.
- Add a new environment variable:
  - **Name:** `POSTGRES_URL`
  - **Value:** Paste the connection string you got from your database provider.
- Add another environment variable:
  - **Name:** `GOOGLE_CLIENT_ID`
  - **Value:** Your Google Sign-In OAuth client ID. This should match the client ID configured in the frontend.
- Click "Deploy".

Vercel will now build and deploy your website. Any future pushes to the `main` branch of your Git repository will automatically trigger a new deployment.

### 4. Set up the Database Table

You need to create the tables used by the app in your database. At minimum, the backend expects `users`, `workout_sessions`, and `workout_exercises` tables.

The original demo schema for the public progress page was:

```sql
CREATE TABLE workouts (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  attendance BOOLEAN,
  weight NUMERIC,
  height NUMERIC,
  pr TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

That table is only part of the UI history tracker; the authenticated workout API now reads from the session tables above.

Your website should now be live and connected to your database.
