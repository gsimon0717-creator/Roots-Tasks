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

See `.env.example` for all supported environment variables.

## In-App AI Assistant

Roots has an optional built-in AI task assistant (the "Ask AI" side panel), backed by `POST /api/agent/chat`. It runs a Claude tool-use loop server-side to create/edit/manage tasks from natural language, and acts strictly with the logged-in user's own permissions (it calls Roots' own API with the caller's credential — see `MANUAL.md` for the full security model). Set `ANTHROPIC_API_KEY` to enable it; optionally `ANTHROPIC_MODEL` and `AGENT_NAME`. Without a key, the panel is disabled and the route returns `501` — nothing else is affected. No extra npm dependency: the Anthropic Messages API is called via `fetch`.

Tests: `npx tsx test-agent.ts` runs the agent-loop unit suite.

## Build & Deploy

- `npm run build` builds the frontend (Vite).
- `npm start` runs the production server (`tsx server.ts`).
- Deploys to Cloud Run automatically via a Cloud Build trigger on pushes to `main`. See the `Dockerfile` for the build steps.
