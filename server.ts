import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import pg from "pg";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection pool
// On Cloud Run: postgresql://USER:PASSWORD@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE
// Local dev:    postgresql://USER:PASSWORD@localhost:5432/roots_tasks
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// SECURITY FIX (2026-07-08): password hashing. Passwords were previously
// stored and compared in plaintext (see the removed history in /auth/login
// and the users table comment above). All new/updated passwords are now
// hashed with bcrypt before they ever reach the database, and a one-time
// migration (see migratePlaintextPasswords, called from startServer) hashes
// any pre-existing plaintext rows in place. BCRYPT_HASH_RE is used to tell
// an already-hashed value apart from plaintext so the migration is
// idempotent (safe to run on every startup) and so hashPassword never
// double-hashes a value that's already a bcrypt hash.
const BCRYPT_HASH_RE = /^\$2[aby]\$/;
function looksHashed(value: string | null | undefined): boolean {
  return typeof value === "string" && BCRYPT_HASH_RE.test(value);
}
async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

// One-time (but idempotent/safe-to-repeat) migration: finds any users row
// whose password column is still plaintext (i.e. doesn't match a bcrypt hash
// prefix) and hashes it in place. Rows that are already hashed are skipped,
// so this is cheap to run on every server startup.
async function migratePlaintextPasswords() {
  const { rows } = await pool.query("SELECT id, password FROM users WHERE password IS NOT NULL");
  const toMigrate = rows.filter((u: any) => !looksHashed(u.password));
  if (!toMigrate.length) {
    console.log("[password migration] no plaintext passwords found, nothing to do");
    return;
  }
  console.log(`[password migration] hashing ${toMigrate.length} plaintext password(s)`);
  for (const u of toMigrate) {
    const hashed = await hashPassword(u.password);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, u.id]);
  }
  console.log(`[password migration] done`);
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS divisions (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- TEMPLATE FEATURE (2026-07-10): Sub-team tier, added between Team and
    -- Project per the settled XVerse operating-architecture doc. Optional by
    -- design -- Greg's decision: every team CAN have sub-teams, none are
    -- required to. A team with no sub-teams works exactly as it does today
    -- (projects attach directly to the team); a team that needs finer
    -- structure (e.g. Revenue -> Business Development / Customer Success)
    -- can add sub-teams without changing how any other team works.
    CREATE TABLE IF NOT EXISTS sub_teams (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      -- SECURITY FIX (2026-07-03): was DEFAULT 'password' — a guessable
      -- literal baked into the schema (and into seed data for every human
      -- user, including Greg's own account). Removed the default; new rows
      -- must supply a real password (see POST /users below, which now
      -- generates a random one if the caller doesn't provide one). This does
      -- NOT fix already-seeded rows still holding the literal 'password' —
      -- those need a live UPDATE, see the rotation note Greg has separately.
      -- Passwords are still stored/compared in plaintext (see /auth/login) —
      -- that's a separate, larger fix (hashing) not included in this pass.
      password TEXT,
      google_id TEXT,
      avatar_url TEXT,
      is_di BOOLEAN DEFAULT FALSE,
      user_type TEXT NOT NULL,
      api_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT 'slate',
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'moderate',
      due_date TEXT,
      key_result TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_projects (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
      PRIMARY KEY (task_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      attachment_name TEXT,
      attachment_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_scopes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope_type TEXT NOT NULL,
      scope_id INTEGER NOT NULL
    );
  `);

  // Phase 5: one DI (agent) user per dashboard agent, with a fixed,
  // deterministic api_key so the agent-dashboard service can reference it
  // directly as an env var without a separate provisioning round trip.
  // Safe to re-run - ON CONFLICT (email) DO NOTHING.
  await pool.query(`
    INSERT INTO users (name, first_name, last_name, email, is_di, user_type, api_key) VALUES
      ('Sandie', 'Sandie', NULL, 'sandie@starstreamlabs.com', TRUE, 'DI Agent', 'roots_di_sandie_2026'),
      ('Cole', 'Cole', NULL, 'cole@starstreamlabs.com', TRUE, 'DI Agent', 'roots_di_cole_2026'),
      ('Audrey', 'Audrey', NULL, 'audrey@starstreamlabs.com', TRUE, 'DI Agent', 'roots_di_audrey_2026'),
      ('Atlas', 'Atlas', NULL, 'atlas@starstreamlabs.com', TRUE, 'DI Agent', 'roots_di_atlas_2026')
    ON CONFLICT (email) DO NOTHING;
  `);

  // SECURITY FIX (2026-07-09): session support for human users, added as an
  // idempotent migration (ADD COLUMN IF NOT EXISTS) so it's safe to run
  // against the existing production database on every startup, same pattern
  // as everything else in this function. DI agent rows are unaffected —
  // they keep authenticating via api_key, never via session_token. This
  // does NOT touch the 4 seed agent keys inserted above; nothing in this
  // pass rotates or reads them differently.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP;
    CREATE UNIQUE INDEX IF NOT EXISTS users_session_token_idx ON users(session_token) WHERE session_token IS NOT NULL;
  `);

  // TEMPLATE FEATURE (2026-07-10): Sub-team tier, idempotent migration same
  // pattern as above. Both nullable -- a project/task with no sub_team_id
  // sits directly under its team, same as before this feature existed.
  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_team_id INTEGER REFERENCES sub_teams(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_team_id INTEGER REFERENCES sub_teams(id) ON DELETE SET NULL;
  `);
}

// SECURITY FIX (emergency, 2026-07-08): GET /users (and every other endpoint
// that returns a user row) was doing `SELECT * FROM users`, which includes
// the plaintext `password` column AND the `api_key` column — meaning ANY
// unauthenticated caller could dump every user's plaintext password, plus
// every DI agent's live api_key (the same keys agent-dashboard uses to
// authenticate as Sandie/Cole/Audrey/Atlas), with a single GET request. This
// strips both fields from every user object before it leaves the server,
// regardless of auth state. The one legitimate exception is immediately
// after a POST /users or a PATCH /users/:id?regenerate_api_key=true call,
// where the caller genuinely needs to see the key it just
// created/regenerated — those two call sites re-attach api_key explicitly,
// once, to their own response only. Also strips session_token for the same
// reason (added 2026-07-09 alongside real session support).
function sanitizeUser(u: any): any {
  if (!u || typeof u !== "object") return u;
  const { password, api_key, session_token, ...rest } = u;
  return rest;
}
function sanitizeUsers(rows: any[]): any[] {
  return rows.map(sanitizeUser);
}

// SECURITY FIX (2026-07-09): authorization (not just authentication) for
// user creation and access-scope management. Before this, any authenticated
// caller -- including a plain "User" tier account, or a DI agent's API key
// -- could call POST /users or POST/DELETE /api/user_scopes directly and
// create accounts or grant itself any scope up to Super Admin, regardless
// of what the frontend UI showed or hid. These mirror the client-side
// user_type checks already in App.tsx (canManageOrganization and friends)
// so both layers agree, but the server-side check is the one that actually
// matters for security since the client can't be trusted.
function isSuperAdminUser(u: any): boolean {
  return typeof u?.user_type === "string" && u.user_type.includes("Super Admin");
}
function isAdminUser(u: any): boolean {
  // "Admin" matches both the "Admin" and "Super Admin" tiers (both contain
  // the substring), same convention the frontend already uses.
  return typeof u?.user_type === "string" && u.user_type.includes("Admin");
}

// SECURITY FIX (2026-07-09, revised): each Roots deployment is a fully
// separate, isolated instance per company -- there is exactly one
// Organization row per instance, not many. That makes "Admin scoped to an
// Organization" meaningless (it would just mean Super Admin, since there's
// only one org to be scoped to). Greg's decision: Admin authority is scoped
// to a Division instead. An Admin has full control within their division
// (including granting/revoking OTHER users' access to that division), but
// -- unlike the earlier design -- cannot create new user accounts at all;
// only Super Admin can do that (see POST /users below). Organization-level
// scope is Super-Admin-exclusive territory now, so resolveDivisionIdForScope
// deliberately returns null for scope_type 'organization': an Admin can
// never manage or grant org-level scope, only Super Admin can.
//
// Resolves which division a given scope belongs to, so a division-scoped
// Admin's authority can be checked against scopes requested at the
// division/team/project level (team/project roll up to one division).
async function resolveDivisionIdForScope(scopeType: string, scopeId: number): Promise<number | null> {
  if (scopeType === "division") return scopeId;
  if (scopeType === "team") {
    const { rows } = await pool.query("SELECT division_id FROM teams WHERE id = $1", [scopeId]);
    return rows[0]?.division_id ?? null;
  }
  // TEMPLATE FEATURE (2026-07-10): sub_team rolls up through its parent team
  // to a division, same as team/project below -- a division-scoped Admin
  // manages sub-teams within their division exactly like they manage teams
  // and projects there.
  if (scopeType === "sub_team") {
    const { rows } = await pool.query(
      "SELECT t.division_id AS division_id FROM sub_teams st JOIN teams t ON st.team_id = t.id WHERE st.id = $1",
      [scopeId]
    );
    return rows[0]?.division_id ?? null;
  }
  if (scopeType === "project") {
    const { rows } = await pool.query(
      "SELECT t.division_id AS division_id FROM projects p JOIN teams t ON p.team_id = t.id WHERE p.id = $1",
      [scopeId]
    );
    return rows[0]?.division_id ?? null;
  }
  // 'organization' (and anything else) intentionally not resolvable to a
  // division -- Admins never get authority over organization-level scope.
  return null;
}

// Super Admins can manage any division. Division-scoped Admins can only
// manage divisions they hold an explicit 'division' user_scopes row for.
// Everyone else (plain Users) can't manage any division.
async function canManageDivisionServer(requester: any, divisionId: number | null): Promise<boolean> {
  if (isSuperAdminUser(requester)) return true;
  if (!isAdminUser(requester) || !divisionId) return false;
  const { rows } = await pool.query(
    "SELECT 1 FROM user_scopes WHERE user_id = $1 AND scope_type = 'division' AND scope_id = $2",
    [requester.id, divisionId]
  );
  return rows.length > 0;
}

// SECURITY FIX (2026-07-09): real session support for human users. Human
// logins previously got nothing back to authenticate with on subsequent
// requests — only DI agents had an api_key. Sessions are opaque, high-
// entropy random tokens (crypto.randomBytes), looked up directly (same
// approach as api_key — the token's entropy is the security boundary, not
// secrecy of a hashing scheme), stored in the session_token/
// session_expires_at columns added by the migration in initDB above.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function startSession(userId: number): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    "UPDATE users SET session_token = $1, session_expires_at = $2 WHERE id = $3",
    [token, expiresAt, userId]
  );
  return token;
}

function extractCredential(req: express.Request): string | undefined {
  if (req.headers["x-api-key"]) return req.headers["x-api-key"] as string;
  if (req.headers["authorization"]?.toLowerCase().startsWith("bearer ")) {
    return (req.headers["authorization"] as string).substring(7).trim();
  }
  return undefined;
}

// SECURITY FIX (2026-07-09): real Google ID token verification. This
// endpoint previously trusted whatever email/first_name/google_id the
// caller put in the request body — nothing was ever checked against
// Google, so anyone could claim any email address. Set
// GOOGLE_OAUTH_CLIENT_ID (a real OAuth 2.0 Web Client ID from Google Cloud
// Console) to enable Google SSO; until that's configured, the endpoint
// refuses to authenticate anyone via Google rather than falling back to
// trusting client-supplied fields. The frontend also still needs updating
// to obtain a real Google ID token via Google Identity Services in place of
// the current simulator UI — tracked separately, not done in this pass.
const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; firstName: string; lastName: string; googleId: string } | null> {
  if (!googleClient || !googleClientId) return null;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) return null;
    return {
      email: payload.email,
      firstName: payload.given_name || payload.email.split("@")[0],
      lastName: payload.family_name || "",
      googleId: payload.sub,
    };
  } catch (e: any) {
    console.error("Google ID token verification failed:", e.message);
    return null;
  }
}

async function getHydratedTask(taskId: number | string) {
  const { rows: [task] } = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
  if (!task) return null;

  const { rows: projectAssignments } = await pool.query(
    `SELECT tp.project_id, tp.section_id, p.team_id, t.organization_id
     FROM task_projects tp
     JOIN projects p ON tp.project_id = p.id
     JOIN teams t ON p.team_id = t.id
     WHERE tp.task_id = $1`,
    [taskId]
  );

  const projectIds = projectAssignments.map((p: any) => p.project_id);
  const teamIdsFromProjects = [...new Set(projectAssignments.map((p: any) => p.team_id))];
  const organizationIdsFromProjects = [...new Set(projectAssignments.map((p: any) => p.organization_id))];
  const finalOrgId = task.organization_id || organizationIdsFromProjects[0] || null;
  const finalTeamId = task.team_id || teamIdsFromProjects[0] || null;

  const sectionAssignments = projectAssignments.reduce((acc: any, p: any) => {
    acc[p.project_id] = p.section_id;
    return acc;
  }, {});

  const { rows: subtaskRows } = await pool.query("SELECT * FROM subtasks WHERE task_id = $1", [taskId]);
  const subtasks = await Promise.all(
    subtaskRows.map(async (st: any) => {
      const { rows: stAttachments } = await pool.query("SELECT * FROM attachments WHERE subtask_id = $1", [st.id]);
      const { rows: stComments } = await pool.query(
        "SELECT * FROM comments WHERE subtask_id = $1 ORDER BY created_at ASC",
        [st.id]
      );
      return { ...st, attachments: stAttachments, comments: stComments };
    })
  );

  const { rows: attachments } = await pool.query(
    "SELECT * FROM attachments WHERE task_id = $1 AND subtask_id IS NULL",
    [taskId]
  );
  const { rows: comments } = await pool.query(
    "SELECT * FROM comments WHERE task_id = $1 AND subtask_id IS NULL ORDER BY created_at ASC",
    [taskId]
  );

  return {
    ...task,
    project_ids: projectIds,
    team_ids: teamIdsFromProjects,
    organization_ids: organizationIdsFromProjects,
    org_id: finalOrgId,
    team_id: finalTeamId,
    organization_id: finalOrgId,
    section_assignments: sectionAssignments,
    subtasks,
    attachments,
    comments
  };
}

async function startServer() {
  await initDB();
  await migratePlaintextPasswords();

  const app = express();
  const PORT = Number(process.env.PORT) || 8080;
  app.use(express.json());

  const apiRouter = express.Router();

  // SECURITY FIX (2026-07-09): this used to only check a credential IF one
  // was sent — a request with no X-API-Key/Authorization header at all was
  // simply waved through via next() with no req.user set, meaning every
  // route (tasks, users, orgs, teams, projects, every CRUD op including
  // deletes) was fully accessible to anyone with zero credentials. Now
  // rejects with 401 by default; PUBLIC_PATHS is the explicit, short
  // allowlist of routes that must stay reachable without auth (the ones
  // that exist specifically to let you become authenticated, plus the
  // Cloud Run health check). req.path here is relative to this router's
  // mount point (/api), so "/health" matches a request to /api/health.
  const PUBLIC_PATHS = new Set(["/health", "/auth/login", "/auth/google-sso"]);

  apiRouter.use(async (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path)) return next();

    const credential = extractCredential(req);
    if (!credential) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const { rows } = await pool.query(
        `SELECT * FROM users WHERE api_key = $1
           OR (session_token = $1 AND session_expires_at IS NOT NULL AND session_expires_at > NOW())`,
        [credential]
      );
      if (!rows[0]) {
        return res.status(401).json({ error: "Invalid or expired credentials" });
      }
      (req as any).user = rows[0];
      next();
    } catch (e: any) {
      console.error("Auth check failed:", e);
      res.status(500).json({ error: "Authentication check failed" });
    }
  });

  apiRouter.get("/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch (e: any) {
      res.status(500).json({ status: "error", error: e.message });
    }
  });

  // --- ORGANIZATIONS ---
  apiRouter.get("/organizations", async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM organizations ORDER BY name ASC");
    res.json(rows);
  });

  apiRouter.post("/organizations", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const { rows } = await pool.query("INSERT INTO organizations (name) VALUES ($1) RETURNING *", [name]);
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/organizations/:id", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const { rows } = await pool.query("UPDATE organizations SET name = $1 WHERE id = $2 RETURNING *", [name, req.params.id]);
    res.json(rows[0]);
  });

  apiRouter.delete("/organizations/:id", async (req, res) => {
    await pool.query("DELETE FROM organizations WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- DIVISIONS ---
  apiRouter.get("/divisions", async (req, res) => {
    const { organization_id } = req.query;
    if (organization_id) {
      const { rows } = await pool.query("SELECT * FROM divisions WHERE organization_id = $1 ORDER BY name ASC", [organization_id]);
      return res.json(rows);
    }
    const { rows } = await pool.query("SELECT * FROM divisions ORDER BY name ASC");
    res.json(rows);
  });

  apiRouter.post("/divisions", async (req, res) => {
    const { name, organization_id } = req.body;
    if (!name || !organization_id) return res.status(400).json({ error: "name and organization_id are required" });
    const { rows } = await pool.query(
      "INSERT INTO divisions (name, organization_id) VALUES ($1, $2) RETURNING *",
      [name, organization_id]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/divisions/:id", async (req, res) => {
    const { name, organization_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push(`name = $${values.push(name)}`); }
    if (organization_id !== undefined) { updates.push(`organization_id = $${values.push(organization_id)}`); }
    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE divisions SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  });

  apiRouter.delete("/divisions/:id", async (req, res) => {
    await pool.query("DELETE FROM divisions WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- TEAMS ---
  apiRouter.get("/teams", async (req, res) => {
    const { organization_id, division_id } = req.query;
    if (division_id) {
      const { rows } = await pool.query("SELECT * FROM teams WHERE division_id = $1 ORDER BY name ASC", [division_id]);
      return res.json(rows);
    }
    if (organization_id) {
      const { rows } = await pool.query("SELECT * FROM teams WHERE organization_id = $1 ORDER BY name ASC", [organization_id]);
      return res.json(rows);
    }
    const { rows } = await pool.query("SELECT * FROM teams ORDER BY name ASC");
    res.json(rows);
  });

  apiRouter.post("/teams", async (req, res) => {
    let { name, organization_id, division_id } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!organization_id) {
      const { rows } = await pool.query("SELECT id FROM organizations LIMIT 1");
      if (rows[0]) organization_id = rows[0].id;
    }
    const { rows } = await pool.query(
      "INSERT INTO teams (name, organization_id, division_id) VALUES ($1, $2, $3) RETURNING *",
      [name, organization_id || null, division_id || null]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/teams/:id", async (req, res) => {
    const { name, organization_id, division_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push(`name = $${values.push(name)}`); }
    if (organization_id !== undefined) { updates.push(`organization_id = $${values.push(organization_id)}`); }
    if (division_id !== undefined) { updates.push(`division_id = $${values.push(division_id)}`); }
    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE teams SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  });

  apiRouter.delete("/teams/:id", async (req, res) => {
    await pool.query("DELETE FROM teams WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- SUB-TEAMS ---
  // TEMPLATE FEATURE (2026-07-10): optional tier under Team. Every team can
  // have sub-teams; none are required to. Authorization mirrors
  // divisions/teams elsewhere in this file: Super Admin anywhere,
  // division-scoped Admin only within divisions they manage (resolved via
  // the sub-team's parent team). Plain create/rename/delete has no special
  // gate beyond normal auth today, same as teams/projects above -- write
  // access to structure isn't scope-gated in this codebase yet, only user/
  // scope management is (see POST /users and /user_scopes).
  apiRouter.get("/sub_teams", async (req, res) => {
    const { team_id } = req.query;
    if (team_id) {
      const { rows } = await pool.query("SELECT * FROM sub_teams WHERE team_id = $1 ORDER BY name ASC", [team_id]);
      return res.json(rows);
    }
    const { rows } = await pool.query("SELECT * FROM sub_teams ORDER BY name ASC");
    res.json(rows);
  });

  apiRouter.post("/sub_teams", async (req, res) => {
    const { team_id, name } = req.body;
    if (!team_id || !name) return res.status(400).json({ error: "team_id and name are required" });
    const { rows } = await pool.query(
      "INSERT INTO sub_teams (team_id, name) VALUES ($1,$2) RETURNING *",
      [team_id, name]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/sub_teams/:id", async (req, res) => {
    const { name, team_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push(`name = $${values.push(name)}`); }
    if (team_id !== undefined) { updates.push(`team_id = $${values.push(team_id)}`); }
    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE sub_teams SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  });

  apiRouter.delete("/sub_teams/:id", async (req, res) => {
    // Projects/tasks under this sub-team fall back to sitting directly under
    // the team (sub_team_id -> NULL via ON DELETE SET NULL on both FKs) --
    // nothing under a deleted sub-team is itself deleted.
    await pool.query("DELETE FROM sub_teams WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- USERS ---
  apiRouter.get("/users", async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY first_name ASC");
    res.json(sanitizeUsers(rows));
  });

  apiRouter.post("/users", async (req, res) => {
    // SECURITY FIX (2026-07-09, revised): user creation is Super-Admin-only,
    // full stop -- Admins (division-scoped or otherwise) cannot create new
    // accounts at all, per Greg's explicit decision. Admins can still manage
    // *existing* users' access to their division (see POST/DELETE
    // /user_scopes below); they just can't bring a new account into
    // existence. Earlier draft of this fix allowed org-scoped Admins to
    // create users too -- superseded by this simpler, stricter rule.
    const requester = (req as any).user;
    if (!isSuperAdminUser(requester)) {
      return res.status(403).json({ error: "Only Super Admins can create users" });
    }
    const { first_name, last_name, email, phone, is_di, user_type, password, scopes } = req.body;
    if (!first_name || !email || !user_type) return res.status(400).json({ error: "first_name, email, and user_type are required" });
    // Scopes are optional here (Super Admin can grant any scope to anyone,
    // no authorization check needed) -- just assigned in the same request
    // as a convenience so a new user isn't left with zero access.
    const requestedScopes: Array<{ scope_type: string; scope_id: number }> = Array.isArray(scopes)
      ? scopes.filter((s: any) => s && s.scope_type && s.scope_id)
      : [];
    const avatar_url = is_di
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${first_name}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${first_name}`;
    const name = last_name ? `${first_name} ${last_name}` : first_name;
    // SECURITY FIX (2026-07-09): Math.random() is not cryptographically
    // secure (~32 bits of real entropy here) and was guessable/brute-
    // forceable. crypto.randomBytes matches the generator already used for
    // passwords elsewhere in this file. This only affects NEWLY created DI
    // agents — the 4 existing seed keys (Sandie/Cole/Audrey/Atlas) are
    // untouched by this change.
    const api_key = is_di ? `roots_di_${crypto.randomBytes(16).toString("hex")}` : null;
    // SECURITY FIX (2026-07-03): used to silently fall back to the literal
    // "password" if none was supplied. Now generates a random one-time
    // password instead and returns it in the response — the caller is
    // responsible for delivering it to the user and prompting a change.
    // Never falls back to a known/guessable value.
    const generatedPassword = password || crypto.randomBytes(12).toString("base64url");
    // SECURITY FIX (2026-07-08): the plaintext generatedPassword is only
    // ever used for the one-time response below (so the caller can deliver
    // it to the user) — the value actually written to the database is now
    // always the bcrypt hash, never the plaintext.
    const hashedPassword = await hashPassword(generatedPassword);
    try {
      const { rows } = await pool.query(
        "INSERT INTO users (name, first_name, last_name, email, phone, is_di, user_type, avatar_url, password, api_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
        [name, first_name, last_name || null, email, phone || null, is_di || false, user_type, avatar_url, hashedPassword, api_key]
      );
      const responseUser: any = sanitizeUser(rows[0]);
      if (!password) responseUser.generatedPassword = generatedPassword; // only surfaced when we made it up, and only this once
      if (rows[0].api_key) responseUser.api_key = rows[0].api_key; // caller needs the key it just created, once

      // Assign the requested scopes now that the user exists. This is a
      // brand-new user_id so there's no pre-existing scope row to collide
      // with -- no need for the duplicate check POST /user_scopes does.
      const createdScopes: any[] = [];
      for (const s of requestedScopes) {
        const { rows: scopeRows } = await pool.query(
          "INSERT INTO user_scopes (user_id, scope_type, scope_id) VALUES ($1,$2,$3) RETURNING *",
          [rows[0].id, s.scope_type, s.scope_id]
        );
        createdScopes.push(scopeRows[0]);
      }
      responseUser.scopes = createdScopes;

      res.status(201).json(responseUser);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.patch("/users/:id", async (req, res) => {
    const { id } = req.params;
    const { rows: [user] } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { first_name, last_name, email, phone, is_di, user_type, password, regenerate_api_key } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      updates.push(`${col} = $${values.push(val)}`);
    };

    if (first_name !== undefined) addUpdate("first_name", first_name);
    if (last_name !== undefined) addUpdate("last_name", last_name || null);
    if (email !== undefined) addUpdate("email", email);
    if (phone !== undefined) addUpdate("phone", phone || null);
    if (is_di !== undefined) addUpdate("is_di", is_di);
    if (user_type !== undefined) addUpdate("user_type", user_type);
    if (password !== undefined) addUpdate("password", await hashPassword(password));

    if (regenerate_api_key) {
      // SECURITY FIX (2026-07-09): same Math.random() -> crypto.randomBytes
      // fix as user creation above.
      addUpdate("api_key", `roots_di_${crypto.randomBytes(16).toString("hex")}`);
    }

    const finalFirstName = first_name ?? user.first_name;
    const finalLastName = last_name !== undefined ? last_name : user.last_name;
    if (first_name !== undefined || last_name !== undefined) {
      addUpdate("name", finalLastName ? `${finalFirstName} ${finalLastName}`.trim() : finalFirstName);
    }

    const finalIsDi = is_di !== undefined ? is_di : user.is_di;
    if (first_name !== undefined || is_di !== undefined) {
      addUpdate("avatar_url", finalIsDi
        ? `https://api.dicebear.com/7.x/bottts/svg?seed=${finalFirstName}`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${finalFirstName}`
      );
    }

    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(id);

    try {
      const { rows } = await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
      const responseUser: any = sanitizeUser(rows[0]);
      if (regenerate_api_key) responseUser.api_key = rows[0].api_key; // caller asked for a new key, needs to see it once
      res.json(responseUser);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.delete("/users/:id", async (req, res) => {
    const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "User not found" });
    res.status(204).send();
  });

  // --- AUTH ---
  apiRouter.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const { rows: [user] } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    // SECURITY FIX (2026-07-08): was a plaintext `!==` comparison. Now
    // compares against the bcrypt hash. looksHashed guards against the
    // (should-be-impossible-post-migration) edge case of a row that still
    // holds a plaintext value, so a stray plaintext row fails closed instead
    // of matching via bcrypt.compare on a non-hash string.
    const passwordOk = !!user && looksHashed(user.password) && await bcrypt.compare(password, user.password);
    if (!user || !passwordOk) return res.status(400).json({ error: "Invalid email or password" });
    // SECURITY FIX (2026-07-09): issue a real session token now that every
    // other route requires authentication. The frontend attaches this as
    // `Authorization: Bearer <token>` on every subsequent request (see
    // src/authFetch.ts) — it's carried inside the same
    // roots_logged_in_user object already stored in localStorage.
    const session_token = await startSession(user.id);
    res.json({ ...sanitizeUser(user), session_token });
  });

  apiRouter.post("/auth/google-sso", async (req, res) => {
    // SECURITY FIX (2026-07-09): this endpoint used to trust whatever
    // email/first_name/google_id the caller put in the request body, with
    // nothing checked against Google — anyone could claim to be any email
    // address (including an existing admin's) and get logged in or have an
    // account silently created. It now requires a real Google-issued
    // id_token and verifies it server-side; identity fields come ONLY from
    // the verified token payload, never from the request body. Until
    // GOOGLE_OAUTH_CLIENT_ID is configured (and the frontend is updated to
    // obtain a real token via Google Identity Services, replacing today's
    // simulator), this endpoint refuses every request rather than falling
    // back to the old trust-the-body behavior.
    const { id_token } = req.body;
    if (!googleClientId) {
      return res.status(501).json({ error: "Google SSO is not configured on this server. Use password login instead." });
    }
    if (!id_token) {
      return res.status(400).json({ error: "id_token is required" });
    }
    const verified = await verifyGoogleIdToken(id_token);
    if (!verified) {
      return res.status(401).json({ error: "Invalid Google ID token" });
    }
    const { email, firstName, lastName, googleId } = verified;

    let { rows: [user] } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!user) {
      const name = lastName ? `${firstName} ${lastName}` : firstName;
      const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName || "Google"}`;
      // SECURITY FIX (2026-07-03): was the literal "password" — meaning an
      // SSO-only account could also be logged into via plain
      // /auth/login with that known password, bypassing Google auth
      // entirely. Use an unguessable random value instead; this account is
      // meant to authenticate via SSO only.
      const ssoPlaceholderPassword = crypto.randomBytes(24).toString("base64url");
      // SECURITY FIX (2026-07-08): store the bcrypt hash of the random
      // placeholder, not the plaintext value itself, consistent with every
      // other password write path.
      const hashedSsoPassword = await hashPassword(ssoPlaceholderPassword);
      const { rows } = await pool.query(
        "INSERT INTO users (name, first_name, last_name, email, is_di, user_type, avatar_url, google_id, password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [name, firstName, lastName || null, email, false, "Human User", avatar_url, googleId || null, hashedSsoPassword]
      );
      user = rows[0];
    } else if (!user.google_id && googleId) {
      await pool.query("UPDATE users SET google_id = $1 WHERE id = $2", [googleId, user.id]);
    }
    const session_token = await startSession(user.id);
    res.json({ ...sanitizeUser(user), session_token });
  });

  // SECURITY FIX (2026-07-09): new. Lets the frontend confirm a stored
  // session is still valid and pull fresh user data without re-logging in.
  // Protected by the auth gate above (not in PUBLIC_PATHS), so req.user is
  // already populated by the time this runs.
  apiRouter.get("/auth/me", async (req, res) => {
    res.json(sanitizeUser((req as any).user));
  });

  // SECURITY FIX (2026-07-09): new. Invalidates the caller's own session
  // token server-side — clearing localStorage client-side alone would leave
  // the token itself still valid for anyone who'd copied it.
  apiRouter.post("/auth/logout", async (req, res) => {
    await pool.query(
      "UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = $1",
      [(req as any).user.id]
    );
    res.json({ success: true });
  });

  // --- USER SCOPES ---
  apiRouter.get("/user_scopes", async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM user_scopes");
    res.json(rows);
  });

  apiRouter.post("/user_scopes", async (req, res) => {
    // SECURITY FIX (2026-07-09, revised): authorization. Previously any
    // authenticated caller could grant any scope to any user. Now: Super
    // Admins can grant anything; division-scoped Admins can grant scopes
    // only within divisions they manage (this is their "full control at the
    // division level, including other users' access to that division," per
    // Greg's decision) -- they can grant division/team/project scope within
    // their division, but never 'organization' scope (that's Super-Admin
    // exclusive, see resolveDivisionIdForScope). Plain Users can't grant
    // anything.
    const requester = (req as any).user;
    const { user_id, scope_type, scope_id } = req.body;
    if (!user_id || !scope_type || !scope_id) return res.status(400).json({ error: "user_id, scope_type, scope_id required" });
    if (!isAdminUser(requester)) {
      return res.status(403).json({ error: "Only Super Admins and Admins can assign scopes" });
    }
    if (!isSuperAdminUser(requester)) {
      const divisionId = await resolveDivisionIdForScope(scope_type, scope_id);
      if (!(await canManageDivisionServer(requester, divisionId))) {
        return res.status(403).json({ error: "Not authorized to grant this scope" });
      }
    }
    const { rows: [exists] } = await pool.query(
      "SELECT id FROM user_scopes WHERE user_id = $1 AND scope_type = $2 AND scope_id = $3",
      [user_id, scope_type, scope_id]
    );
    if (exists) return res.status(400).json({ error: "Scope assignment already exists" });
    const { rows } = await pool.query(
      "INSERT INTO user_scopes (user_id, scope_type, scope_id) VALUES ($1,$2,$3) RETURNING *",
      [user_id, scope_type, scope_id]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.delete("/user_scopes", async (req, res) => {
    // SECURITY FIX (2026-07-09, revised): same authorization as POST
    // /user_scopes -- Super Admin anywhere, division-scoped Admin only
    // within divisions they manage.
    const requester = (req as any).user;
    const { user_id, scope_type, scope_id } = req.body;
    if (!user_id || !scope_type || !scope_id) return res.status(400).json({ error: "user_id, scope_type, scope_id required" });
    if (!isAdminUser(requester)) {
      return res.status(403).json({ error: "Only Super Admins and Admins can revoke scopes" });
    }
    if (!isSuperAdminUser(requester)) {
      const divisionId = await resolveDivisionIdForScope(scope_type, scope_id);
      if (!(await canManageDivisionServer(requester, divisionId))) {
        return res.status(403).json({ error: "Not authorized to revoke this scope" });
      }
    }
    const { rowCount } = await pool.query(
      "DELETE FROM user_scopes WHERE user_id = $1 AND scope_type = $2 AND scope_id = $3",
      [user_id, scope_type, scope_id]
    );
    if (!rowCount) return res.status(404).json({ error: "Scope not found" });
    res.json({ success: true });
  });

  // --- PROJECTS ---
  apiRouter.get("/projects", async (req, res) => {
    const { team_id, sub_team_id } = req.query;
    if (sub_team_id) {
      const { rows } = await pool.query("SELECT * FROM projects WHERE sub_team_id = $1 ORDER BY name ASC", [sub_team_id]);
      return res.json(rows);
    }
    if (team_id) {
      const { rows } = await pool.query("SELECT * FROM projects WHERE team_id = $1 ORDER BY name ASC", [team_id]);
      return res.json(rows);
    }
    const { rows } = await pool.query("SELECT * FROM projects ORDER BY name ASC");
    res.json(rows);
  });

  apiRouter.post("/projects", async (req, res) => {
    // sub_team_id is optional -- a project can sit directly under a team
    // (sub_team_id NULL, same behavior as before this feature existed) or
    // under one of that team's sub-teams. Not validated that sub_team_id
    // actually belongs to team_id; the frontend only offers sub-teams
    // belonging to the selected team, same trust level as the rest of this
    // API's structure endpoints.
    const { team_id, name, description, sub_team_id } = req.body;
    if (!team_id || !name) return res.status(400).json({ error: "team_id and name are required" });
    const { rows } = await pool.query(
      "INSERT INTO projects (team_id, name, description, sub_team_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [team_id, name, description || "", sub_team_id || null]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/projects/:id", async (req, res) => {
    const { name, description, team_id, sub_team_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push(`name = $${values.push(name)}`); }
    if (description !== undefined) { updates.push(`description = $${values.push(description)}`); }
    if (team_id !== undefined) { updates.push(`team_id = $${values.push(team_id)}`); }
    if (sub_team_id !== undefined) { updates.push(`sub_team_id = $${values.push(sub_team_id)}`); }
    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE projects SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  });

  apiRouter.delete("/projects/:id", async (req, res) => {
    await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- SECTIONS ---
  apiRouter.get("/sections", async (req, res) => {
    const { project_id } = req.query;
    if (project_id) {
      const { rows } = await pool.query("SELECT * FROM sections WHERE project_id = $1 ORDER BY order_index ASC", [project_id]);
      return res.json(rows);
    }
    const { rows } = await pool.query("SELECT * FROM sections ORDER BY project_id, order_index ASC");
    res.json(rows);
  });

  apiRouter.post("/sections", async (req, res) => {
    const { project_id, name, color } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: "project_id and name required" });
    const { rows } = await pool.query(
      "INSERT INTO sections (project_id, name, color) VALUES ($1,$2,$3) RETURNING *",
      [project_id, name, color || "slate"]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/sections/:id", async (req, res) => {
    const { name, color, order_index } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push(`name = $${values.push(name)}`); }
    if (color !== undefined) { updates.push(`color = $${values.push(color)}`); }
    if (order_index !== undefined) { updates.push(`order_index = $${values.push(order_index)}`); }
    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE sections SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  });

  apiRouter.delete("/sections/:id", async (req, res) => {
    await pool.query("DELETE FROM sections WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- TASKS ---
  apiRouter.get("/tasks", async (req, res) => {
    try {
      const { project_id } = req.query;
      let taskRows;
      if (project_id) {
        const { rows } = await pool.query(
          `SELECT t.* FROM tasks t JOIN task_projects tp ON t.id = tp.task_id WHERE tp.project_id = $1 ORDER BY t.created_at DESC`,
          [project_id]
        );
        taskRows = rows;
      } else {
        const { rows } = await pool.query("SELECT * FROM tasks ORDER BY created_at DESC");
        taskRows = rows;
      }
      const hydrated = await Promise.all(taskRows.map((t: any) => getHydratedTask(t.id)));
      res.json(hydrated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/tasks/:id", async (req, res) => {
    const task = await getHydratedTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  apiRouter.post("/tasks", async (req, res) => {
    const { title, description, priority, due_date, key_result, project_ids, section_id, organization_id, team_id, division_id, org_id, assignee_id, sub_team_id } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [task] } = await client.query(
        `INSERT INTO tasks (title, description, priority, due_date, key_result, organization_id, team_id, division_id, assignee_id, sub_team_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [title, description || "", priority || "moderate", due_date || null, key_result || "", organization_id || org_id || null, team_id || null, division_id || null, assignee_id || null, sub_team_id || null]
      );
      if (project_ids && Array.isArray(project_ids)) {
        for (const pid of project_ids) {
          await client.query(
            "INSERT INTO task_projects (task_id, project_id, section_id) VALUES ($1,$2,$3)",
            [task.id, pid, section_id || null]
          );
        }
      }
      await client.query("COMMIT");
      res.status(201).json(await getHydratedTask(task.id));
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Failed to create task:", e);
      res.status(500).json({ error: "Failed to create task" });
    } finally {
      client.release();
    }
  });

  apiRouter.patch("/tasks/:id", async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updates: string[] = [];
      const values: any[] = [];
      const addField = (col: string, val: any) => { updates.push(`${col} = $${values.push(val)}`); };

      if (body.title !== undefined) addField("title", body.title);
      if (body.description !== undefined) addField("description", body.description);
      if (body.status !== undefined) addField("status", body.status);
      if (body.priority !== undefined) addField("priority", body.priority);
      if (body.due_date !== undefined) addField("due_date", body.due_date);
      if (body.key_result !== undefined) addField("key_result", body.key_result);
      if (body.assignee_id !== undefined) addField("assignee_id", body.assignee_id);

      const orgId = body.organization_id ?? body.org_id ?? body.organizationId ?? body.orgId;
      if (orgId !== undefined) addField("organization_id", orgId);

      const teamId = body.team_id ?? body.teamId;
      if (teamId !== undefined) addField("team_id", teamId);

      const divId = body.division_id ?? body.divisionId;
      if (divId !== undefined) addField("division_id", divId);

      const subTeamId = body.sub_team_id ?? body.subTeamId;
      if (subTeamId !== undefined) addField("sub_team_id", subTeamId);

      if (updates.length > 0) {
        updates.push(`updated_at = $${values.push(new Date().toISOString())}`);
        values.push(id);
        await client.query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
      }

      if (body.project_ids && Array.isArray(body.project_ids)) {
        const { rows: existing } = await client.query("SELECT project_id, section_id FROM task_projects WHERE task_id = $1", [id]);
        const sectionMap = existing.reduce((acc: any, p: any) => { acc[p.project_id] = p.section_id; return acc; }, {});
        await client.query("DELETE FROM task_projects WHERE task_id = $1", [id]);
        for (const pid of body.project_ids) {
          await client.query("INSERT INTO task_projects (task_id, project_id, section_id) VALUES ($1,$2,$3)", [id, pid, sectionMap[pid] || null]);
        }
      }

      if (body.section_id !== undefined && body.current_project_id !== undefined) {
        await client.query("UPDATE task_projects SET section_id = $1 WHERE task_id = $2 AND project_id = $3", [body.section_id, id, body.current_project_id]);
      }

      await client.query("COMMIT");
      const updated = await getHydratedTask(id);
      if (!updated) return res.status(404).json({ error: "Task not found" });
      res.json(updated);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error(`Failed to update task ${id}:`, e);
      res.status(500).json({ error: "Failed to update task" });
    } finally {
      client.release();
    }
  });

  apiRouter.patch("/tasks/:id/section", async (req, res) => {
    const { section_id, current_project_id } = req.body;
    await pool.query("UPDATE task_projects SET section_id = $1 WHERE task_id = $2 AND project_id = $3", [section_id, req.params.id, current_project_id]);
    const { rows: [task] } = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    res.json(task);
  });

  apiRouter.delete("/tasks/:id", async (req, res) => {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Task not found" });
    res.status(204).send();
  });

  // --- SUBTASKS ---
  apiRouter.post("/subtasks", async (req, res) => {
    const { task_id, title } = req.body;
    if (!task_id || !title) return res.status(400).json({ error: "task_id and title required" });
    const { rows } = await pool.query("INSERT INTO subtasks (task_id, title) VALUES ($1,$2) RETURNING *", [task_id, title]);
    res.status(201).json(rows[0]);
  });

  apiRouter.patch("/subtasks/:id", async (req, res) => {
    const { title, status } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (title !== undefined) { updates.push(`title = $${values.push(title)}`); }
    if (status !== undefined) { updates.push(`status = $${values.push(status)}`); }
    if (!updates.length) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE subtasks SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  });

  apiRouter.delete("/subtasks/:id", async (req, res) => {
    await pool.query("DELETE FROM subtasks WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- ATTACHMENTS ---
  apiRouter.post("/attachments", async (req, res) => {
    const { task_id, subtask_id, name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url required" });
    const { rows } = await pool.query(
      "INSERT INTO attachments (task_id, subtask_id, name, url) VALUES ($1,$2,$3,$4) RETURNING *",
      [task_id || null, subtask_id || null, name, url]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.delete("/attachments/:id", async (req, res) => {
    await pool.query("DELETE FROM attachments WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  // --- COMMENTS ---
  apiRouter.post("/comments", async (req, res) => {
    const { task_id, subtask_id, content, attachment_name, attachment_url } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });
    if (!task_id && !subtask_id) return res.status(400).json({ error: "task_id or subtask_id required" });
    const { rows } = await pool.query(
      "INSERT INTO comments (task_id, subtask_id, content, attachment_name, attachment_url) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [task_id || null, subtask_id || null, content, attachment_name || null, attachment_url || null]
    );
    res.status(201).json(rows[0]);
  });

  apiRouter.delete("/comments/:id", async (req, res) => {
    await pool.query("DELETE FROM comments WHERE id = $1", [req.params.id]);
    res.status(204).send();
  });

  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  app.use("/api", apiRouter);

  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Roots Tasks running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
