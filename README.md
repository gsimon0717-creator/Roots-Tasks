# Roots-Tasks

Roots is Star Stream Labs' internal task/project management app (organizations → divisions → teams → projects → tasks/subtasks), backed by Express + PostgreSQL and deployed on Google Cloud Run.

Note: this repo was originally scaffolded in Google AI Studio, but no longer uses Gemini or any AI Studio tooling — the app is a plain Express/PostgreSQL/React stack.

## Run Locally

**Prerequisites:** Node.js, a PostgreSQL database

1. Install dependencies:
   `npm install`
2. Set `DATABASE_URL` in `.env` to your Postgres connection string, e.g.:
   `postgresql://USER:PASSWORD@localhost:5432/roots_tasks`
3. Run the app:
   `npm run dev`

## Build & Deploy

- `npm run build` builds the frontend (Vite).
- `npm start` runs the production server (`tsx server.ts`).
- Deploys to Cloud Run automatically via a Cloud Build trigger on pushes to `main`. See the `Dockerfile` for the build steps.
