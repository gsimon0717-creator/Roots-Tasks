# Roots: Task Management Manual

## 1. What it is and what it's for
**Roots** is a local-first, high-performance task management ecosystem engineered for zero-latency operations. It serves as a central orchestration hub for organizing work across a five-tier hierarchy: **Organization > Division > Team > Project > Task**. 

It is designed to eliminate the friction of traditional task managers by providing a "powerhouse" interface that runs locally (hosted at `http://localhost:3000`), ensuring that search, filtering, and data entry are instantaneous.

## 2. Agent Interaction & Capabilities
Agents have full capability to register, authenticate, and perform CRUD (Create, Read, Update, Delete) autonomy over all system entities within their permitted access scopes. Core governance and structural capabilities include:

*   **Security & Identity Governance:**
    *   **Human Accounts vs. Digital Intelligence (DI):** Users can register as standard Human users or as Digital Intelligence components.
    *   **Role-Based Hierarchy:** System users carry defined roles: `Human Super Admin`, `DI Super Admin`, `Human Admin`, `DI Admin`, `Human User`, and `DI User`.
    *   **Programmatic Agent Access:** Every DI user gets assigned a unique API key (`roots_di_...`). This can be rotated by administrators or regenerated to retain secure programmatic integrations.
*   **Access Scopes & Permissions Engine:**
    *   **Super Admins:** Possess universal bypass permissions to view/modify everything.
    *   **Scoped Access mapping:** Standard Admins and Users receive targeted boundary scopes at the **Organization**, **Division**, **Team**, or **Project** level.
    *   **Cascading Rules:** Having a scope at a parent tier (e.g., Organization level) naturally cascades read/write permission down to all children nested under that tree (Divisions, Teams, Projects, Tasks).
*   **Structure Management:** Creating and managing Organizations, Divisions, Teams, and Projects.
*   **Workflow Organization:** Defining Sections within projects to categorize work (e.g., "Backlog", "Sprint", "Complete").
*   **Task Orchestration:** Managed tasks with metadata including priority labels (Low to Urgent), due dates, and descriptive notes.
*   **Granular Control:** Managing Subtasks for complex items and adding Comments/Logs to maintain an activity trail.

---

## 3. API & Access Method
Roots exposes a RESTful API for seamless integration. All data is persisted in a SQLite database (`tasks.db`) at the project root.

### 🔑 Authentication Options

#### 1. In-App/Interactive Auth
Users can sign in via email/password credentials or Google SSO.
*   `POST /api/auth/login`: Authenticate with email/password.
*   `POST /api/auth/google-sso`: Authenticate with Google SSO payload.
*   `POST /api/users`: Create a new user account with role selection.

#### 2. Programmatic Agent Auth (API Headers)
Digital Intelligence (DI) agents can query the API programmatically by appending their API Key to one of the following locations in headers:

*   **X-API-Key Header:** Include the header `X-API-Key: roots_di_xxxxx`
*   **Authorization Bearer Header:** Include the header `Authorization: Bearer roots_di_xxxxx`

If authenticated through this method, requests are scoped to that DI Agent's permissions.

---

### 🌐 Primary Endpoints

#### User & Scope Management
*   `GET /api/users` | `POST /api/users`: Retrieve or create user accounts.
*   `PATCH /api/users/:id`: Update user role/credentials (and supports rotating/regenerating api keys via `{ regenerate_api_key: true }`).
*   `GET /api/user_scopes` | `POST /api/user_scopes` | `DELETE /api/user_scopes`: Grant/revoke targeted access scopes (`organization`, `division`, `team`, `project` bounds) to users.

#### Core Structure Containers
*   `GET /api/organizations` | `POST /api/organizations`: Top-level Organization containers.
*   `GET /api/divisions` | `POST /api/divisions`: Manage parent divisions under an organization.
*   `GET /api/teams` | `POST /api/teams`: Manage Teams linked to divisions and organizations.
*   `GET /api/projects` | `POST /api/projects`: Manage Projects linked to teams.

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

---
*Manual Updated: June 5, 2026*
