# Roots: Task Management Manual

## 1. What it is and what it's for
**Roots** is a local-first, high-performance task management ecosystem engineered for zero-latency operations. It serves as a central orchestration hub for organizing work across a six-tier hierarchy: **Organization > Division > Team > Sub-team > Project > Task**. Sub-team is optional -- any Team can have any number of Sub-teams, but none are required; a Team with no Sub-teams works exactly as if the tier didn't exist, with Projects sitting directly under the Team.

It is designed to eliminate the friction of traditional task managers, ensuring that search, filtering, and data entry are instantaneous. Each deployment is a fully separate, isolated instance for one company (its own database, its own environment) -- there is no shared multi-tenant infrastructure across companies, and correspondingly exactly one Organization record per instance.

## 2. Agent Interaction & Capabilities
Authenticated agents and users perform CRUD (Create, Read, Update, Delete) operations over system entities within their permitted access scopes. Every API route requires authentication except `/health`, `/auth/login`, and `/auth/google-sso` -- there is no self-service registration; accounts are created by a Super Admin (see below). Core governance and structural capabilities include:

*   **Security & Identity Governance:**
    *   **Human Accounts vs. Digital Intelligence (DI):** accounts can be Human users or Digital Intelligence (DI/bot) components; both are created the same way, by a Super Admin.
    *   **Role-Based Hierarchy:** System users carry defined roles: `Human Super Admin`, `Human Admin`, `DI Admin`, `Human User`, and `DI User`. **Super Admin must always be a Human account** -- there can be more than one Human Super Admin, but a DI account can never hold the Super Admin tier (enforced server-side on both account creation and any later edit; see `violatesDiSuperAdminRule` in `server.ts`).
    *   **Programmatic Agent Access:** Every DI user gets assigned a unique API key (`roots_di_...`). This can be rotated by administrators or regenerated to retain secure programmatic integrations.
    *   **Human sessions:** password login and Google SSO both issue an opaque `session_token`, attached as `Authorization: Bearer <token>` on subsequent requests; `POST /api/auth/logout` invalidates it server-side.
*   **Access Scopes & Permissions Engine:**
    *   **Super Admin:** the only role that can create new user accounts (human or DI). Full control everywhere -- every organization, division, team, project, and every user's access.
    *   **Admin:** scoped to one or more specific Divisions (via a `user_scopes` grant). Full control within those divisions -- editing structure/tasks there, and granting or revoking *other users'* access to that division (and its teams/projects) -- but cannot create new accounts, cannot edit any user's account/role (only grant/revoke scopes -- see PATCH `/api/users/:id` below), and can never hold or grant Organization-level access; that tier is Super-Admin-exclusive since each instance only has one Organization.
    *   **User:** access is whatever scope(s) (organization/division/team/sub_team/project) a Super Admin or an authorized Admin has explicitly granted them -- and that scope is now enforced server-side on every write, not just shown/hidden client-side (see below). No administrative capabilities of their own.
    *   **Cascading Rules:** Having a scope at a parent tier (e.g., Division level) naturally cascades read/write permission down to all children nested under that tree (Teams, Sub-teams, Projects, Tasks). Sub-team-level scope resolves up through its parent Team to a Division exactly like Team and Project scope do, for Admin authorization purposes.
    *   **Server-side enforcement (2026-07-10):** every structural write -- creating/editing/deleting an Organization, Division, Team, Sub-team, Project, or Task -- is now authorized server-side against the caller's actual role and granted scopes (`canManageStructureServer` in `server.ts`), not just gated by what the browser UI shows or hides. Found via a live test using the DI agent "Audrey" with zero granted scopes: she could create/delete an Organization outright and create tasks in teams she had no access to, because only user creation and scope-granting had real server-side checks before this date -- every other structural route only checked "is this a valid login," not "is this caller allowed to touch this." Also closed the same day: `PATCH`/`DELETE /api/users/:id` had no authorization check at all (any authenticated caller, human or DI, could edit any account -- including promoting themselves to Super Admin -- or delete any user, including the real Super Admin); both are now Super-Admin-only, with a guard preventing deletion of the last remaining Super Admin.
*   **Structure Management:** Creating and managing Organizations, Divisions, Teams, Sub-teams, and Projects.
*   **Workflow Organization:** Defining Sections within projects to categorize work (e.g., "Backlog", "Sprint", "Complete").
*   **Task Orchestration:** Managed tasks with metadata including priority labels (Low to Urgent), due dates, and descriptive notes.
*   **Granular Control:** Managing Subtasks for complex items and adding Comments/Logs to maintain an activity trail.
*   **In-App AI Assistant:** An always-available "Ask AI" side panel lets users create, edit, move, complete, and ask about tasks in natural language. It runs a Claude tool-use loop server-side and acts strictly with the logged-in user's own permissions (see `POST /api/agent/chat` below). Requires `ANTHROPIC_API_KEY`; degrades cleanly to disabled if not configured.

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
*   `POST /api/users`: Create a user account. **Super-Admin-only.** Rejects any request that would create an account that is both DI and Super Admin.
*   `PATCH /api/users/:id`: Update user role/credentials (and supports rotating/regenerating api keys via `{ regenerate_api_key: true }`). **Super-Admin-only** (2026-07-10 -- previously had no authorization check at all). Rejects any update that would leave an account both DI and Super Admin.
*   `DELETE /api/users/:id`: **Super-Admin-only** (2026-07-10 -- previously had no authorization check at all). Refuses to delete the last remaining Super Admin.
*   `GET /api/user_scopes`: Retrieve access scope assignments.
*   `POST /api/user_scopes` | `DELETE /api/user_scopes`: Grant/revoke targeted access scopes (`organization`, `division`, `team`, `sub_team`, `project` bounds) to users. Super Admin can grant/revoke anything; a Division-scoped Admin can only grant/revoke `division`/`team`/`sub_team`/`project` scopes within divisions they manage -- `organization`-level scope is Super-Admin-exclusive.

#### Core Structure Containers
All create/edit/delete routes below are authorized server-side (2026-07-10) via `canManageStructureServer`: Super Admin anywhere; a Division-scoped Admin or a User with a matching `user_scopes` grant (organization/division/team/sub_team/project, whichever applies) within their authority; everyone else gets `403`. Edits/deletes are checked against the entity's *current* parent, not any new parent proposed in the request body.
*   `GET /api/organizations` | `POST /api/organizations` | `PATCH /api/organizations/:id` | `DELETE /api/organizations/:id`: Top-level Organization containers. Create/edit/delete are **Super-Admin-only** (each deployment has exactly one Organization).
*   `GET /api/divisions` | `POST /api/divisions` | `PATCH /api/divisions/:id` | `DELETE /api/divisions/:id`: Manage parent divisions under an organization. Creating a *new* Division requires authority over its parent Organization (Super-Admin-only in practice); editing/deleting an existing Division requires authority over that Division.
*   `GET /api/teams` | `POST /api/teams` | `PATCH /api/teams/:id` | `DELETE /api/teams/:id`: Manage Teams linked to divisions and organizations. A Team with no `division_id` (org-level/independent) requires Organization-level authority to create or edit.
*   `GET /api/sub_teams` | `POST /api/sub_teams` | `PATCH /api/sub_teams/:id` | `DELETE /api/sub_teams/:id`: Manage optional Sub-teams under a Team (`?team_id=` filters the list). Deleting a Sub-team does not delete what's under it -- Projects/Tasks fall back to sitting directly under the parent Team (`sub_team_id` set to `NULL`).
*   `GET /api/projects` | `POST /api/projects` | `PATCH /api/projects/:id` | `DELETE /api/projects/:id`: Manage Projects linked to teams. `sub_team_id` is optional on both create and update -- a Project can sit directly under a Team or under one of that Team's Sub-teams.

#### Task Operations
Create/edit/delete are authorized the same way as Core Structure Containers above, checked against the task's current organization/division/team/sub_team/projects. A task created with none of those (fully orphaned, zero scope) is Super-Admin-only to create.
*   `GET /api/tasks` | `POST /api/tasks`: Core task CRUD.
*   `GET /api/tasks/:id`: Specific task retrieval.
*   `PATCH /api/tasks/:id` | `PATCH /api/tasks/:id/section`: Update task metadata (title, priority, section, assignee, description, project assignments, etc.).
*   `DELETE /api/tasks/:id`: Remove tasks and associated subtasks.
*   `POST /api/subtasks`: Add subtasks.
*   `POST /api/comments`: Post text comments or system logs.

#### In-App AI Agent (2026-07-16)
*   `POST /api/agent/chat`: Powers the in-UI task assistant (the "Ask AI" side panel). Body: `{ messages: [{ role: "user" | "assistant", content: string }, ...] }` — the full chat transcript, which must begin with a `user` turn. Returns `{ reply: string, actions: [{ tool, input, ok, status }], stopped: "completed" | "max_turns" }`.
    *   **How it works:** the server runs a Claude tool-use loop. The model can call task tools (`list_tasks`, `get_task`, `create_task`, `update_task`, `move_task`, `delete_task`, `add_subtask`, `add_comment`) plus a read-only `list_structure` tool for resolving names to ids. It has **no** tools for creating/editing structure (organizations/divisions/teams/projects).
    *   **Security model:** the agent acts entirely **as the logged-in user**. Every tool call is executed by calling Roots' own REST API over loopback with the *caller's own credential* forwarded verbatim, so the identical server-side authorization (`canManageStructureServer`, the Super-Admin gates, scope enforcement) runs on every action. The agent physically cannot do anything the user could not do by hand — a scoped user's agent receives the same `403`s the user's browser would. There is no separate agent identity, service account, or bypass path. The Anthropic API key is server-only and never sent to the browser.
    *   **Configuration:** requires `ANTHROPIC_API_KEY` (server env). If unset, this route returns `501` and the panel is disabled; the rest of the app is unaffected. `ANTHROPIC_MODEL` selects the Claude model; `AGENT_NAME` sets the assistant's display name.

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
| **v2.2** (on branch `feature/sub-teams`, not yet merged to `main`) | **Sub-team tier, for the multi-entity accelerator template:** optional layer between Team and Project -- any Team can have any number of Sub-teams (e.g. Business Development / Customer Success under Revenue), none required. Projects and Tasks can optionally attach to a Sub-team; deleting a Sub-team never deletes what's under it, just un-assigns it back to the parent Team. Sub-team-level access scope (`user_scopes`) resolves to a Division exactly like Team/Project scope. Also: a working **Add Project** UI now exists -- the "New Project" buttons previously set state that nothing rendered on, so project creation had no functioning form before this branch. **Also (found during Greg's human UI walkthrough, 2026-07-10):** a working **Create Team** UI now exists -- same bug as Add Project had: the "Create Team"/"New Team" buttons set `isAddingTeam` but no modal ever read it, so team creation had no functioning form either. Fixed with a modal (Team Name + optional Division picker). **Also:** the "All Tasks" quick-add task form only had a Project picker, with Division/Team silently derived from ambient sidebar-selection state (often unset on a fresh All Tasks screen). Added explicit Division and Team selects, auto-resolve Organization instead of requiring it be pre-selected (each deployment has exactly one), derive Team/Division from a chosen Project when not manually picked, and removed a duplicate Assignee dropdown found in the same form. **Also:** the Task Detail modal's fields (assignee, priority, due date, org/division/team, project) always auto-saved individually on change -- by design, no Save button was ever needed -- but gave zero visual confirmation, making a successful save indistinguishable from a silent failure. Added a brief "Saved" confirmation pill next to the modal's close button. **Also (Greg's request):** the "Users" sidebar nav item (User Management -- create accounts, rotate DI keys, grant/revoke scopes) was visible to every logged-in user regardless of role. Now hidden for plain Users; Super Admin and Admin still see it. |
| **v2.4** (on branch `feature/roots-agent`, not yet merged to `main`) | **In-app AI task assistant, 2026-07-16.** New "Ask AI" side panel in the UI and a `POST /api/agent/chat` endpoint that runs a Claude tool-use loop server-side to create/edit/move/complete tasks (plus subtasks and comments) from natural language. Structure (orgs/divisions/teams/projects) is read-only to the agent. **Acts as the logged-in user:** every tool call goes back through Roots' own REST API with the caller's own credential, so the agent inherits the user's exact scopes and cannot bypass any server-side authorization — a scoped user's agent gets the same `403`s the user would. Anthropic API key is server-only (`ANTHROPIC_API_KEY`); model and display name configurable (`ANTHROPIC_MODEL`, `AGENT_NAME`); route returns `501` and the panel is disabled if no key is set. No new npm dependency (calls the Anthropic Messages API via `fetch`). Verified: clean `tsc --noEmit` and a 24-assertion agent-loop unit suite (`test-agent.ts`) including the scope-denial/no-fabrication case. Also cleaned up the stale Gemini/AI-Studio `.env.example`. |
| **v2.3** (on branch `feature/sub-teams`, not yet merged to `main`) | **Structural CRUD authorization -- security fix, 2026-07-10.** Greg asked the DI agent "Audrey" to test the programmatic/agent access path directly against her real API key (zero granted scopes). She was able to create a task inside a team she had no access to, and create/delete a brand-new Organization outright -- proving that every structural write (Organizations, Divisions, Teams, Sub-teams, Projects, Tasks) had **no server-side authorization at all**, only authentication; only user creation and scope-granting had gotten real enforcement in the 2026-07-09 fix. Closed by extending the same enforcement (`canManageStructureServer`) to every create/edit/delete route across the whole structural hierarchy, checked against the *current* parent for edits/deletes (not any new parent proposed in the request). **Also found and fixed in the same pass:** `PATCH`/`DELETE /api/users/:id` had zero authorization at all -- any authenticated caller, human or DI, could edit any account (including promoting themselves to Super Admin) or delete any user, including the real Super Admin. Both are now Super-Admin-only, with a guard against deleting the last remaining Super Admin. **New business rule (Greg's explicit instruction):** Super Admin must always be a Human account -- multiple Human Super Admins are fine, but a DI account can never hold the Super Admin tier; enforced server-side on both create and edit, "DI Super Admin" removed as a selectable option client-side. Real-tested: 53/53 new scenarios covering every route and role combination, plus zero regressions across the prior 17 + 16 scenario suites from v2.1/v2.2. |

---
*Manual Updated: July 16, 2026*
