# Roots: Task Management Manual

## 1. What it is and what it's for
**Roots** is a local-first, high-performance task management ecosystem engineered for zero-latency operations. It serves as a central orchestration hub for organizing work across a six-tier hierarchy: **Organization > Division > Team > Sub-team > Project > Task**. Sub-team is optional -- any Team can have any number of Sub-teams, but none are required; a Team with no Sub-teams works exactly as if the tier didn't exist, with Projects sitting directly under the Team.

It is designed to eliminate the friction of traditional task managers, ensuring that search, filtering, and data entry are instantaneous. Each deployment is a fully separate, isolated instance for one company (its own database, its own environment) -- there is no shared multi-tenant infrastructure across companies, and correspondingly exactly one Organization record per instance.

## 2. Agent Interaction & Capabilities
Authenticated agents and users perform CRUD (Create, Read, Update, Delete) operations over system entities within their permitted access scopes. Every API route requires authentication except `/health`, `/auth/login`, and `/auth/google-sso` -- there is no self-service registration; accounts are created by a Super Admin (see below). Core governance and structural capabilities include:

*   **Security & Identity Governance:**
    *   **Human Accounts vs. Digital Intelligence (DI):** accounts can be Human users or Digital Intelligence (DI/bot) components; both are created the same way, by a Super Admin.
    *   **Role-Based Hierarchy:** System users carry defined roles: `Human Super Admin`, `DI Super Admin`, `Human Admin`, `DI Admin`, `Human User`, and `DI User`.
    *   **Programmatic Agent Access:** Every DI user gets assigned a unique API key (`roots_di_...`). This can be rotated by administrators or regenerated to retain secure programmatic integrations.
    *   **Human sessions:** password login and Google SSO both issue an opaque `session_token`, attached as `Authorization: Bearer <token>` on subsequent requests; `POST /api/auth/logout` invalidates it server-side.
*   **Access Scopes & Permissions Engine:**
    *   **Super Admin:** the only role that can create new user accounts (human or DI). Full control everywhere -- every organization, division, team, project, and every user's access.
    *   **Admin:** scoped to one or more specific Divisions (via a `user_scopes` grant). Full control within those divisions -- editing structure/tasks there, and granting or revoking *other users'* access to that division (and its teams/projects) -- but cannot create new accounts, and can never hold or grant Organization-level access; that tier is Super-Admin-exclusive since each instance only has one Organization.
    *   **User:** access is whatever scope(s) (organization/division/team/project) a Super Admin or an authorized Admin has explicitly granted them; no administrative capabilities of their own.
    *   **Cascading Rules:** Having a scope at a parent tier (e.g., Division level) naturally cascades read/write permission down to all children nested under that tree (Teams, Sub-teams, Projects, Tasks). Sub-team-level scope resolves up through its parent Team to a Division exactly like Team and Project scope do, for Admin authorization purposes.
*   **Structure Management:** Creating and managing Organizations, Divisions, Teams, Sub-teams, and Projects.
*   **Workflow Organization:** Defining Sections within projects to categorize work (e.g., "Backlog", "Sprint", "Complete").
*   **Task Orchestration:** Managed tasks with metadata including priority labels (Low to Urgent), due dates, and descriptive notes.
*   **Granular Control:** Managing Subtasks for complex items and adding Comments/Logs to maintain an activity trail.

---

## 3. API & Access Method
Roots exposes a RESTful API for seamless integration. All data is persisted in PostgreSQL (`DATABASE_URL` env var -- Cloud SQL in production, a local Postgres instance for development). Every route requires authentication except `/health`, `/auth/login`, and `/auth/google-sso`.

### 🔑 Authentication Options

#### 1. In-App/Interactive Auth
Users can sign in via email/password credentials or Google SSO (SSO requires `GOOGLE_OAUTH_CLIENT_ID` to be configured server-side; returns `501` if it isn't). Both methods return a `session_token` in the response body; the frontend attaches it as `Authorization: Bearer <token>` on subsequent requests.
*   `POST /api/auth/login`: Authenticate with email/password, returns `session_token`.
*   `POST /api/auth/google-sso`: Authenticate with a verified Google `id_token`, returns `session_token`.
*   `GET /api/auth/me`: Return the current session's user.
*   `POST /api/auth/logout`: Invalidate the current session token server-side.
*   `POST /api/users`: Create a new user account. **Super-Admin-only** -- there is no self-service registration. See Access Scopes above for what Admins can and can't do here.

#### 2. Programmatic Agent Auth (API Headers)
Digital Intelligence (DI) agents can query the API programmatically by appending their API Key to one of the following locations in headers:

*   **X-API-Key Header:** Include the header `X-API-Key: roots_di_xxxxx`
*   **Authorization Bearer Header:** Include the header `Authorization: Bearer roots_di_xxxxx`

If authenticated through this method, requests are scoped to that DI Agent's permissions. Note: the 4 seed DI agent accounts (used by `agent-dashboard`) are not Admins and cannot create users or manage scopes -- their role is task/data operations, not account provisioning.

---

### 🌐 Primary Endpoints

#### User & Scope Management
*   `GET /api/users`: Retrieve user accounts (any authenticated caller).
*   `POST /api/users`: Create a user account. **Super-Admin-only.**
*   `PATCH /api/users/:id`: Update user role/credentials (and supports rotating/regenerating api keys via `{ regenerate_api_key: true }`).
*   `GET /api/user_scopes`: Retrieve access scope assignments.
*   `POST /api/user_scopes` | `DELETE /api/user_scopes`: Grant/revoke targeted access scopes (`organization`, `division`, `team`, `sub_team`, `project` bounds) to users. Super Admin can grant/revoke anything; a Division-scoped Admin can only grant/revoke `division`/`team`/`sub_team`/`project` scopes within divisions they manage -- `organization`-level scope is Super-Admin-exclusive.

#### Core Structure Containers
*   `GET /api/organizations` | `POST /api/organizations`: Top-level Organization containers.
*   `GET /api/divisions` | `POST /api/divisions`: Manage parent divisions under an organization.
*   `GET /api/teams` | `POST /api/teams`: Manage Teams linked to divisions and organizations.
*   `GET /api/sub_teams` | `POST /api/sub_teams` | `PATCH /api/sub_teams/:id` | `DELETE /api/sub_teams/:id`: Manage optional Sub-teams under a Team (`?team_id=` filters the list). Deleting a Sub-team does not delete what's under it -- Projects/Tasks fall back to sitting directly under the parent Team (`sub_team_id` set to `NULL`).
*   `GET /api/projects` | `POST /api/projects`: Manage Projects linked to teams. `sub_team_id` is optional on both create and update -- a Project can sit directly under a Team or under one of that Team's Sub-teams.

#### Task Operations
*   `GET /api/tasks` | `POST /api/tasks`: Core task CRUD.
*   `GET /api/tasks/:id`: Specific task retrieval.
*   `PATCH /api/tasks/:id`: Update task metadata (title, priority, section, assignee, description, project assignments, etc.).
*   `DELETE /api/tasks/:id`: Remove tasks and associated subtasks.
*   `POST /api/subtasks`: Add subtasks.
*   `POST /api/comments`: Post text comments or system logs.

---

## 4. Running Log of Updates

| Version | Update Highlights |
| :--- | :--- |
| **v1.0** | **Initial Release:** Core hierarchy implementation (Teams/Projects/Tasks) with SQLite persistence. |
| **v1.1** | **Search & Discovery:** Added global search, project selection grid for teams, and advanced multi-filter "All Tasks" view. |
| **v1.2** | **View Control:** Fixed task status toggle responsiveness and implemented global "Show/Hide Completed" toggles. |
| **v1.3** | **Relational Flexibility:** Added the ability to re-assign tasks to different projects directly from the Project View or All Tasks table. |
| **v1.4** | **Team Mastery:** Implemented explicit "Team Assignment" labels, interactive Team selectors in the All Tasks table, and a dedicated "Orphaned Only" filter to find tasks with no project/team assignment. |
| **v1.5** | **Organization Hierarchy:** High-level "Organization" layer added. The hierarchy is now **Organization > Team > Project > Task**. Existing teams were migrated to a default organization. |
| **v2.0** | **Identity, Auth & Access Governance Release:** Added secure user accounts, password authentication, and Google SSO. Included a powerful Division layer (**Organization > Division > Team > Project > Task**). Provided programmatic authentication for Digital Intelligence (DI) agents using unique, copyable API keys via headers. Implemented cascading user scopes to control read/edit/delete access permissions on tasks throughout the workspace. |
| **v2.1** (merged to `main` 2026-07-09) | **Security hardening:** passwords now hashed with bcrypt (was plaintext); every API route requires authentication by default; real server-side sessions for human logins (`session_token`, logout invalidation); Google SSO now verifies a real Google `id_token` instead of trusting client-supplied identity (disabled until `GOOGLE_OAUTH_CLIENT_ID` is configured); DI agent API keys generated with a cryptographically secure random source. **Access model revision:** user creation is now Super-Admin-only (no self-service registration, no Admin exception); Admin authority is scoped to Division (not Organization -- each deployment has exactly one Organization, so org-level scope is Super-Admin-exclusive); Admins have full control within their division including managing other users' access to it. |
| **v2.2** (on branch `feature/sub-teams`, not yet merged to `main`) | **Sub-team tier, for the multi-entity accelerator template:** optional layer between Team and Project -- any Team can have any number of Sub-teams (e.g. Business Development / Customer Success under Revenue), none required. Projects and Tasks can optionally attach to a Sub-team; deleting a Sub-team never deletes what's under it, just un-assigns it back to the parent Team. Sub-team-level access scope (`user_scopes`) resolves to a Division exactly like Team/Project scope. Also: a working **Add Project** UI now exists -- the "New Project" buttons previously set state that nothing rendered on, so project creation had no functioning form before this branch. |

---
*Manual Updated: July 10, 2026*
