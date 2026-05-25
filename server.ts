import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("tasks.db");
db.pragma('foreign_keys = ON');

// Auto-migrate users table schema if upgrading from old version
try {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (tableExists) {
    const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const hasFirstName = columns.some(c => c.name === 'first_name');
    if (!hasFirstName) {
      console.log("Migration: 'first_name' column not found in 'users' table. Starting schema migration...");
      
      db.prepare("ALTER TABLE users ADD COLUMN first_name TEXT").run();
      db.prepare("ALTER TABLE users ADD COLUMN last_name TEXT").run();
      db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
      db.prepare("ALTER TABLE users ADD COLUMN is_di INTEGER DEFAULT 0").run();
      db.prepare("ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'human'").run();
      
      const hasName = columns.some(c => c.name === 'name');
      if (hasName) {
        const updateResult = db.prepare("UPDATE users SET first_name = name WHERE first_name IS NULL AND name IS NOT NULL").run();
        console.log(`Migration: Updated first_name for ${updateResult.changes} user(s) using their 'name' values.`);
      } else {
        console.log("Migration: No 'name' column found to migrate display names from.");
      }
      
      const userCountObj = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      console.log(`Migration: Users table schema successfully updated. Migrated ${userCountObj?.count || 0} existing users in total.`);
    }
  }
} catch (error: any) {
  console.error("Migration failed:", error.message || error);
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_di BOOLEAN DEFAULT 0,
    user_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'slate',
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    team_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'moderate',
    due_date TEXT,
    key_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS task_projects (
    task_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    section_id INTEGER,
    PRIMARY KEY (task_id, project_id),
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    subtask_id INTEGER,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (subtask_id) REFERENCES subtasks (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    subtask_id INTEGER,
    content TEXT NOT NULL,
    attachment_name TEXT,
    attachment_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (subtask_id) REFERENCES subtasks (id) ON DELETE CASCADE
  );
`);

// Migration: Add organization_id and team_id to tasks if not exists
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL").run();
} catch (e: any) {}
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL").run();
} catch (e: any) {}
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL").run();
} catch (e: any) {}

// Migration: Add key_result to tasks if not exists
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN key_result TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add organization_id to teams if not exists
try {
  db.prepare("ALTER TABLE teams ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE").run();
} catch (e) {
  // Already exists
}

// Seed default data if empty
const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as { count: number };
let defaultOrgId: any;
if (orgCount.count === 0) {
  const info = db.prepare("INSERT INTO organizations (name) VALUES (?)").run("Default Organization");
  defaultOrgId = info.lastInsertRowid;
} else {
  const firstOrg = db.prepare("SELECT id FROM organizations LIMIT 1").get() as any;
  defaultOrgId = firstOrg.id;
}

const teamCount = db.prepare("SELECT COUNT(*) as count FROM teams").get() as { count: number };
if (teamCount.count === 0) {
  const teamInfo = db.prepare("INSERT INTO teams (name, organization_id) VALUES (?, ?)").run("Personal", defaultOrgId);
  db.prepare("INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)")
    .run(teamInfo.lastInsertRowid, "General", "Default project for miscellaneous tasks");
}

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const users = [
    { first_name: "John", last_name: "Doe", email: "john@example.com", is_di: 0, user_type: "Human Super Admin", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=John" },
    { first_name: "DI Assistant", last_name: "", email: "assistant@di.com", is_di: 1, user_type: "DI Super Admin", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=DI" },
    { first_name: "Jane", last_name: "Smith", email: "jane@example.com", is_di: 0, user_type: "Human Admin", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane" }
  ];
  const stmt = db.prepare("INSERT INTO users (first_name, last_name, email, is_di, user_type, avatar_url) VALUES (?, ?, ?, ?, ?, ?)");
  for (const user of users) {
    stmt.run(user.first_name, user.last_name, user.email, user.is_di, user.user_type, user.avatar_url);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({
      status: "ok",
      database: "connected",
      endpoints: [
        "GET /api/organizations",
        "POST /api/organizations",
        "PATCH /api/organizations/:id",
        "GET /api/teams",
        "POST /api/teams",
        "PATCH /api/teams/:id",
        "GET /api/projects",
        "POST /api/projects",
        "PATCH /api/projects/:id",
        "GET /api/tasks",
        "GET /api/tasks/:id",
        "POST /api/tasks",
        "PATCH /api/tasks/:id",
        "GET /api/sections",
        "POST /api/sections"
      ]
    });
  });
  apiRouter.get("/organizations", (req, res) => {
    const orgs = db.prepare("SELECT * FROM organizations ORDER BY name ASC").all();
    res.json(orgs);
  });

  apiRouter.get("/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users ORDER BY first_name ASC").all();
    res.json(users);
  });

  apiRouter.post("/users", (req, res) => {
    const { first_name, last_name, email, phone, is_di, user_type } = req.body;
    if (!first_name || !email || !user_type) {
      return res.status(400).json({ error: "First name, email, and user type are required" });
    }
    const avatar_url = is_di 
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${first_name}` 
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${first_name}`;
    
    try {
      const info = db.prepare("INSERT INTO users (first_name, last_name, email, phone, is_di, user_type, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(first_name, last_name || null, email, phone || null, is_di ? 1 : 0, user_type, avatar_url);
      res.status(201).json(db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.patch("/users/:id", (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, phone, is_di, user_type } = req.body;
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (first_name !== undefined) { updates.push("first_name = ?"); values.push(first_name); }
    if (last_name !== undefined) { updates.push("last_name = ?"); values.push(last_name || null); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone || null); }
    if (is_di !== undefined) { updates.push("is_di = ?"); values.push(is_di ? 1 : 0); }
    if (user_type !== undefined) { updates.push("user_type = ?"); values.push(user_type); }

    const final_name = first_name !== undefined ? first_name : user.first_name;
    const final_is_di = is_di !== undefined ? (is_di ? 1 : 0) : user.is_di;
    if (first_name !== undefined || is_di !== undefined) {
      const avatar_url = final_is_di 
        ? `https://api.dicebear.com/7.x/bottts/svg?seed=${final_name}` 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${final_name}`;
      updates.push("avatar_url = ?");
      values.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    try {
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      res.json(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.delete("/users/:id", (req, res) => {
    const { id } = req.params;
    try {
      const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
      if (info.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.post("/organizations", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const info = db.prepare("INSERT INTO organizations (name) VALUES (?)").run(name);
    res.status(201).json(db.prepare("SELECT * FROM organizations WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/organizations/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    db.prepare("UPDATE organizations SET name = ? WHERE id = ?").run(name, id);
    res.json(db.prepare("SELECT * FROM organizations WHERE id = ?").get(id));
  });

  apiRouter.delete("/organizations/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM organizations WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Teams API
  apiRouter.get("/teams", (req, res) => {
    const { organization_id } = req.query;
    let teams;
    if (organization_id) {
      teams = db.prepare("SELECT * FROM teams WHERE organization_id = ? ORDER BY name ASC").all(organization_id);
    } else {
      teams = db.prepare("SELECT * FROM teams ORDER BY name ASC").all();
    }
    res.json(teams);
  });

  apiRouter.post("/teams", (req, res) => {
    const { name } = req.body;
    let { organization_id } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    // Fallback to first organization if not provided
    if (!organization_id) {
      const firstOrg = db.prepare("SELECT id FROM organizations LIMIT 1").get() as any;
      if (firstOrg) {
        organization_id = firstOrg.id;
      }
    }
    
    const info = db.prepare("INSERT INTO teams (name, organization_id) VALUES (?, ?)").run(name, organization_id || null);
    res.status(201).json(db.prepare("SELECT * FROM teams WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/teams/:id", (req, res) => {
    const { id } = req.params;
    const { name, organization_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (organization_id !== undefined) { updates.push("organization_id = ?"); values.push(organization_id); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE teams SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM teams WHERE id = ?").get(id));
  });

  apiRouter.delete("/teams/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM teams WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Projects API
  apiRouter.get("/projects", (req, res) => {
    const { team_id } = req.query;
    let projects;
    if (team_id) {
      projects = db.prepare("SELECT * FROM projects WHERE team_id = ? ORDER BY name ASC").all(team_id);
    } else {
      projects = db.prepare("SELECT * FROM projects ORDER BY name ASC").all();
    }
    res.json(projects);
  });

  apiRouter.post("/projects", (req, res) => {
    const { team_id, name, description } = req.body;
    if (!team_id || !name) return res.status(400).json({ error: "team_id and name are required" });
    const info = db.prepare("INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)")
      .run(team_id, name, description || "");
    res.status(201).json(db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/projects/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, team_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (description !== undefined) { updates.push("description = ?"); values.push(description); }
    if (team_id !== undefined) { updates.push("team_id = ?"); values.push(team_id); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
  });

  apiRouter.delete("/projects/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.status(204).send();
  });

  const getHydratedTask = (taskId: number | string) => {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;
    if (!task) return null;

    const projectAssignments = db.prepare(`
      SELECT tp.project_id, tp.section_id, p.team_id, t.organization_id 
      FROM task_projects tp 
      JOIN projects p ON tp.project_id = p.id 
      JOIN teams t ON p.team_id = t.id 
      WHERE tp.task_id = ?
    `).all(taskId) as any[];
    
    const projectIds = projectAssignments.map((p: any) => p.project_id);
    const teamIdsFromProjects = Array.from(new Set(projectAssignments.map((p: any) => p.team_id)));
    const organizationIdsFromProjects = Array.from(new Set(projectAssignments.map((p: any) => p.organization_id)));
    
    // Support direct columns if set, otherwise fallback to project-derived ones
    const finalOrgId = task.organization_id || organizationIdsFromProjects[0] || null;
    const finalTeamId = task.team_id || teamIdsFromProjects[0] || null;

    const sectionAssignments = projectAssignments.reduce((acc: any, p: any) => {
      acc[p.project_id] = p.section_id;
      return acc;
    }, {});

    const subtasks = db.prepare("SELECT * FROM subtasks WHERE task_id = ?").all(taskId).map((st: any) => {
      const stAttachments = db.prepare("SELECT * FROM attachments WHERE subtask_id = ?").all(st.id);
      const stComments = db.prepare("SELECT * FROM comments WHERE subtask_id = ? ORDER BY created_at ASC").all(st.id);
      return { ...st, attachments: stAttachments, comments: stComments };
    });
    const attachments = db.prepare("SELECT * FROM attachments WHERE task_id = ? AND subtask_id IS NULL").all(taskId);
    const comments = db.prepare("SELECT * FROM comments WHERE task_id = ? AND subtask_id IS NULL ORDER BY created_at ASC").all(taskId);
    
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
  };

  // Tasks API
  apiRouter.get("/tasks", (req, res) => {
    const { project_id } = req.query;
    let tasks;
    if (project_id) {
      tasks = db.prepare(`
        SELECT t.* FROM tasks t
        JOIN task_projects tp ON t.id = tp.task_id
        WHERE tp.project_id = ?
        ORDER BY t.created_at DESC
      `).all(project_id);
    } else {
      tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    }

    const hydratedTasks = tasks.map((task: any) => getHydratedTask(task.id));
    res.json(hydratedTasks);
  });

  apiRouter.get("/tasks/:id", (req, res) => {
    const { id } = req.params;
    const task = getHydratedTask(id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  apiRouter.post("/tasks", (req, res) => {
    const { title, description, priority, due_date, key_result, project_ids, section_id, organization_id, team_id, org_id, assignee_id } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    
    try {
      let taskId: number | bigint;
      
      const performInsert = db.transaction(() => {
        const info = db.prepare(
          "INSERT INTO tasks (title, description, priority, due_date, key_result, organization_id, team_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(title, description || "", priority || "moderate", due_date || null, key_result || "", organization_id || org_id || null, team_id || null, assignee_id || null);
        
        taskId = info.lastInsertRowid;
        
        if (project_ids && Array.isArray(project_ids)) {
          const stmt = db.prepare("INSERT INTO task_projects (task_id, project_id, section_id) VALUES (?, ?, ?)");
          for (const pid of project_ids) {
            stmt.run(taskId, pid, section_id || null);
          }
        }
        return taskId;
      });

      taskId = performInsert() as number;
      res.status(201).json(getHydratedTask(taskId));
    } catch (e) {
      console.error("Failed to create task:", e);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  apiRouter.patch("/tasks/:id", (req, res) => {
    const { id } = req.params;
    const body = req.body;
    
    console.log(`PATCH /tasks/${id} received with body:`, JSON.stringify(body));

    try {
      const performUpdate = db.transaction(() => {
        const updates: string[] = [];
        const values: any[] = [];

        if (body.title !== undefined) { updates.push("title = ?"); values.push(body.title); }
        if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description); }
        if (body.status !== undefined) { updates.push("status = ?"); values.push(body.status); }
        if (body.priority !== undefined) { updates.push("priority = ?"); values.push(body.priority); }
        if (body.due_date !== undefined) { updates.push("due_date = ?"); values.push(body.due_date); }
        if (body.key_result !== undefined) { updates.push("key_result = ?"); values.push(body.key_result); }
        if (body.assignee_id !== undefined) { updates.push("assignee_id = ?"); values.push(body.assignee_id); }
        
        // Aliases for organization_id
        const orgIdToUse = body.organization_id ?? body.org_id ?? body.organizationId ?? body.orgId;
        if (orgIdToUse !== undefined) { 
          console.log(`Setting organization_id to ${orgIdToUse} for task ${id}`);
          updates.push("organization_id = ?"); 
          values.push(orgIdToUse); 
        }
        
        // Aliases for team_id
        const teamIdToUse = body.team_id ?? body.teamId;
        if (teamIdToUse !== undefined) { 
          console.log(`Setting team_id to ${teamIdToUse} for task ${id}`);
          updates.push("team_id = ?"); 
          values.push(teamIdToUse); 
        }
        
        if (updates.length > 0) {
          updates.push("updated_at = CURRENT_TIMESTAMP");
          values.push(id);
          const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`;
          db.prepare(sql).run(...values);
        }

        if (body.project_ids && Array.isArray(body.project_ids)) {
          console.log(`Updating project assignments for task ${id}:`, body.project_ids);
          const existing = db.prepare("SELECT project_id, section_id FROM task_projects WHERE task_id = ?").all(id);
          const sectionMap = existing.reduce((acc: any, p: any) => { acc[p.project_id] = p.section_id; return acc; }, {});

          db.prepare("DELETE FROM task_projects WHERE task_id = ?").run(id);
          const stmt = db.prepare("INSERT INTO task_projects (task_id, project_id, section_id) VALUES (?, ?, ?)");
          for (const pid of body.project_ids) {
            stmt.run(id, pid, sectionMap[pid] || null);
          }
        }

        if (body.section_id !== undefined && body.current_project_id !== undefined) {
          console.log(`Updating section for task ${id} in project ${body.current_project_id} to ${body.section_id}`);
          db.prepare("UPDATE task_projects SET section_id = ? WHERE task_id = ? AND project_id = ?")
            .run(body.section_id, id, body.current_project_id);
        }
      });

      performUpdate();
      
      const updatedTask = getHydratedTask(id);
      if (!updatedTask) return res.status(404).json({ error: "Task not found after update" });
      
      console.log(`Task ${id} updated successfully:`, JSON.stringify(updatedTask));
      res.json(updatedTask);
    } catch (e) {
      console.error(`Failed to update task ${id}:`, e);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Alias for backward compatibility or specific use cases
  apiRouter.patch("/tasks/:id/section", (req, res) => {
    const { id } = req.params;
    const { section_id, current_project_id } = req.body;
    
    try {
      db.prepare("UPDATE task_projects SET section_id = ? WHERE task_id = ? AND project_id = ?")
        .run(section_id, id, current_project_id);
      
      // Return the updated task
      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      res.json(task);
    } catch (e) {
      console.error(`Failed to update task ${id} section:`, e);
      res.status(500).json({ error: "Failed to update project section" });
    }
  });

  apiRouter.delete("/tasks/:id", (req, res) => {
    const { id } = req.params;
    const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  });

  // Subtasks API
  apiRouter.post("/subtasks", (req, res) => {
    const { task_id, title } = req.body;
    if (!task_id || !title) return res.status(400).json({ error: "task_id and title are required" });
    const info = db.prepare("INSERT INTO subtasks (task_id, title) VALUES (?, ?)").run(task_id, title);
    res.status(201).json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/subtasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, status } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(title); }
    if (status !== undefined) { updates.push("status = ?"); values.push(status); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE subtasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id));
  });

  apiRouter.delete("/subtasks/:id", (req, res) => {
    db.prepare("DELETE FROM subtasks WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Attachments API
  apiRouter.post("/attachments", (req, res) => {
    const { task_id, subtask_id, name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url are required" });
    const info = db.prepare("INSERT INTO attachments (task_id, subtask_id, name, url) VALUES (?, ?, ?, ?)")
      .run(task_id || null, subtask_id || null, name, url);
    res.status(201).json(db.prepare("SELECT * FROM attachments WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.delete("/attachments/:id", (req, res) => {
    db.prepare("DELETE FROM attachments WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Comments API
  apiRouter.post("/comments", (req, res) => {
    const { task_id, subtask_id, content, attachment_name, attachment_url } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });
    if (!task_id && !subtask_id) return res.status(400).json({ error: "task_id or subtask_id is required" });
    
    const info = db.prepare(`
      INSERT INTO comments (task_id, subtask_id, content, attachment_name, attachment_url) 
      VALUES (?, ?, ?, ?, ?)
    `).run(task_id || null, subtask_id || null, content, attachment_name || null, attachment_url || null);
    
    res.status(201).json(db.prepare("SELECT * FROM comments WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.delete("/comments/:id", (req, res) => {
    db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Sections API
  apiRouter.get("/sections", (req, res) => {
    const { project_id } = req.query;
    if (project_id) {
      const sections = db.prepare("SELECT * FROM sections WHERE project_id = ? ORDER BY order_index ASC").all(project_id);
      return res.json(sections);
    }
    const sections = db.prepare("SELECT * FROM sections ORDER BY project_id, order_index ASC").all();
    res.json(sections);
  });

  apiRouter.post("/sections", (req, res) => {
    const { project_id, name, color } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: "project_id and name are required" });
    const info = db.prepare("INSERT INTO sections (project_id, name, color) VALUES (?, ?, ?)")
      .run(project_id, name, color || "slate");
    res.status(201).json(db.prepare("SELECT * FROM sections WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/sections/:id", (req, res) => {
    const { id } = req.params;
    const { name, color, order_index } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (color !== undefined) { updates.push("color = ?"); values.push(color); }
    if (order_index !== undefined) { updates.push("order_index = ?"); values.push(order_index); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE sections SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM sections WHERE id = ?").get(id));
  });

  apiRouter.delete("/sections/:id", (req, res) => {
    db.prepare("DELETE FROM sections WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Catch-all for apiRouter to log unmatched routes
  apiRouter.all("*", (req, res) => {
    console.log(`Unmatched API route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Mount the API router
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
