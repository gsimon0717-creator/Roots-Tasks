import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { spawnSync } from "child_process";

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
    name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    phone TEXT,
    password TEXT DEFAULT 'password',
    google_id TEXT,
    avatar_url TEXT,
    is_di BOOLEAN DEFAULT 0,
    user_type TEXT NOT NULL,
    api_key TEXT,
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

// Migration: Add divisions table and division_id columns
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS divisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    );
  `);
} catch (e: any) {
  console.error("Migration/Setup of divisions table failed:", e);
}

try {
  db.prepare("ALTER TABLE teams ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL").run();
} catch (e: any) {}

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL").run();
} catch (e: any) {}

// Migration: Add password and google_id to users table if they do not exist
try {
  db.prepare("ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'password'").run();
} catch (e: any) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN google_id TEXT").run();
} catch (e: any) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN api_key TEXT").run();
} catch (e: any) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN username TEXT").run();
} catch (e: any) {}

// Populate usernames for existing users if empty
try {
  const usersWithoutUsername = db.prepare("SELECT id, email FROM users WHERE username IS NULL OR username = ''").all() as any[];
  const updateUsernameStmt = db.prepare("UPDATE users SET username = ? WHERE id = ?");
  for (const u of usersWithoutUsername) {
    let baseUsername = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!baseUsername) baseUsername = `user_${u.id}`;
    // Ensure uniqueness if same base exists
    let currentUsername = baseUsername;
    let counter = 1;
    while (true) {
      const collision = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(currentUsername, u.id);
      if (!collision) break;
      currentUsername = `${baseUsername}${counter}`;
      counter++;
    }
    updateUsernameStmt.run(currentUsername, u.id);
    console.log(`Generated default username @${currentUsername} for User ID ${u.id}`);
  }
} catch (e: any) {
  console.error("Migration: Failed to populate usernames for existing users:", e);
}

// Populate API keys for existing DI users if empty
try {
  const diUsersWithoutApiKey = db.prepare("SELECT id, name FROM users WHERE is_di = 1 AND (api_key IS NULL OR api_key = '')").all() as any[];
  const updateKeyStmt = db.prepare("UPDATE users SET api_key = ? WHERE id = ?");
  for (const u of diUsersWithoutApiKey) {
    const randomHex = Math.random().toString(16).substring(2, 10);
    const generatedKey = `roots_di_${randomHex}`;
    updateKeyStmt.run(generatedKey, u.id);
    console.log(`Generated default API Key for DI User ${u.name}`);
  }
} catch (e: any) {
  console.error("Failed to populate default API keys:", e);
}

// Migration: Add user_scopes table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_scopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scope_type TEXT NOT NULL, -- 'organization', 'division', 'team', 'project'
      scope_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);
} catch (e: any) {
  console.error("Migration/Setup of user_scopes table failed:", e);
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
  const stmt = db.prepare("INSERT INTO users (name, first_name, last_name, email, is_di, user_type, avatar_url, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const user of users) {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const generatedKey = user.is_di ? `roots_di_${Math.random().toString(16).substring(2, 10)}` : null;
    stmt.run(name, user.first_name, user.last_name || null, user.email, user.is_di, user.user_type, user.avatar_url, generatedKey);
  }
}

async function startServer() {
  // Idempotent auto-build check for frontend
  const distIndexPath = path.join(__dirname, "dist", "index.html");
  let rebuildNeeded = false;

  if (!fs.existsSync(distIndexPath)) {
    rebuildNeeded = true;
  } else {
    try {
      const distStat = fs.statSync(distIndexPath);
      const distMtime = distStat.mtime.getTime();

      const srcDir = path.join(__dirname, "src");
      let newestSrcMtime = 0;

      function findNewestMtime(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const resPath = path.resolve(dir, entry.name);
          if (entry.isDirectory()) {
            findNewestMtime(resPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === ".tsx" || ext === ".ts" || ext === ".css") {
              const fileStat = fs.statSync(resPath);
              if (fileStat.mtime.getTime() > newestSrcMtime) {
                newestSrcMtime = fileStat.mtime.getTime();
              }
            }
          }
        }
      }

      findNewestMtime(srcDir);

      if (newestSrcMtime > distMtime) {
        rebuildNeeded = true;
      }
    } catch (e: any) {
      console.error("[startup] Error analyzing source files mtime, forcing rebuild:", e.message || e);
      rebuildNeeded = true;
    }
  }

  if (rebuildNeeded) {
    console.log("[startup] Source newer than dist/. Running vite build...");
    const buildResult = spawnSync("npm", ["run", "build"], { 
      stdio: "inherit", 
      shell: true,
      cwd: __dirname
    });

    if (buildResult.status !== 0) {
      console.error("[startup] npm run build failed with exit code:", buildResult.status);
      process.exit(1);
    }
    console.log("[startup] vite build complete. Serving fresh frontend from dist/.");
  } else {
    console.log("[startup] dist/ is current. Skipping rebuild.");
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const apiRouter = express.Router();

  // API Key & Programmatic Agent Authentication Middleware
  apiRouter.use((req, res, next) => {
    let apiKey: string | undefined = undefined;

    // Check X-API-Key header
    if (req.headers["x-api-key"]) {
      apiKey = req.headers["x-api-key"] as string;
    } 
    // Check Authorization Bearer header
    else if (req.headers["authorization"]) {
      const authHeader = req.headers["authorization"] as string;
      if (authHeader.toLowerCase().startsWith("bearer ")) {
        apiKey = authHeader.substring(7).trim();
      }
    }

    if (apiKey) {
      try {
        const authenticatedUser = db.prepare("SELECT * FROM users WHERE api_key = ?").get(apiKey) as any;
        if (authenticatedUser) {
          // Attach authenticated user details to the request
          (req as any).user = authenticatedUser;
          console.log(`[API Auth] Programmatic Agent Access: ${authenticatedUser.name} (${authenticatedUser.user_type}) authenticated successfully via API Key.`);
        } else {
          return res.status(401).json({ error: "Invalid API Key provided" });
        }
      } catch (e: any) {
        console.error("API Auth error:", e);
      }
    }

    next();
  });

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
    const { first_name, last_name, email, username, phone, is_di, user_type, password } = req.body;
    if (!first_name || !email || !user_type) {
      return res.status(400).json({ error: "First name, email, and user type are required" });
    }
    const avatar_url = is_di 
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${first_name}` 
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${first_name}`;
    
    const name = last_name ? `${first_name} ${last_name}` : first_name;
    const finalPassword = password || 'password';
    const finalUsername = (username || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const generatedKey = is_di ? `roots_di_${Math.random().toString(16).substring(2, 10)}` : null;
    
    try {
      const info = db.prepare("INSERT INTO users (name, first_name, last_name, email, username, phone, is_di, user_type, avatar_url, password, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(name, first_name, last_name || null, email, finalUsername, phone || null, is_di ? 1 : 0, user_type, avatar_url, finalPassword, generatedKey);
      res.status(201).json(db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.patch("/users/:id", (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, username, phone, is_di, user_type, password, api_key, regenerate_api_key } = req.body;
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (first_name !== undefined) { updates.push("first_name = ?"); values.push(first_name); }
    if (last_name !== undefined) { updates.push("last_name = ?"); values.push(last_name || null); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (username !== undefined) { updates.push("username = ?"); values.push(username.toLowerCase().replace(/[^a-z0-9_]/g, '')); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone || null); }
    if (is_di !== undefined) { updates.push("is_di = ?"); values.push(is_di ? 1 : 0); }
    if (user_type !== undefined) { updates.push("user_type = ?"); values.push(user_type); }
    if (password !== undefined) { updates.push("password = ?"); values.push(password); }

    // API Key rotation/generation logic
    let targetIsDi = is_di !== undefined ? (is_di ? 1 : 0) : user.is_di;
    if (regenerate_api_key) {
      const rotatedKey = `roots_di_${Math.random().toString(16).substring(2, 10)}`;
      updates.push("api_key = ?");
      values.push(rotatedKey);
    } else if (api_key !== undefined) {
      updates.push("api_key = ?");
      values.push(api_key || null);
    } else if (targetIsDi && (!user.api_key || user.api_key === "")) {
      // Auto-generate key if newly becoming a DI user or if they list DI but lack a key
      const newKey = `roots_di_${Math.random().toString(16).substring(2, 10)}`;
      updates.push("api_key = ?");
      values.push(newKey);
    } else if (!targetIsDi && user.api_key) {
      // Clear key if turning into non-DI user
      updates.push("api_key = ?");
      values.push(null);
    }

    if (first_name !== undefined || last_name !== undefined) {
      const updatedFirstName = first_name !== undefined ? first_name : user.first_name;
      const updatedLastName = last_name !== undefined ? last_name : user.last_name;
      const computedName = updatedLastName ? `${updatedFirstName} ${updatedLastName}`.trim() : updatedFirstName;
      updates.push("name = ?");
      values.push(computedName);
    }

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

  // Auth APIs
  apiRouter.get("/auth/bootstrap-status", (req, res) => {
    try {
      const adminCountObj = db.prepare("SELECT COUNT(*) as count FROM users WHERE user_type LIKE '%Super Admin%'").get() as { count: number };
      const userCountObj = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      res.json({
        no_active_admins: adminCountObj.count === 0,
        total_users: userCountObj.count
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/auth/bootstrap-admin", (req, res) => {
    const adminCountObj = db.prepare("SELECT COUNT(*) as count FROM users WHERE user_type LIKE '%Super Admin%'").get() as { count: number };
    if (adminCountObj.count > 0) {
      return res.status(400).json({ error: "Super Admin already exists. Bootstrap disabled." });
    }

    const { first_name, last_name, email, username, password } = req.body;
    if (!first_name || !email || !username || !password) {
      return res.status(400).json({ error: "All fields are required for bootstrap" });
    }

    const name = last_name ? `${first_name} ${last_name}` : first_name;
    const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${first_name}`;
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    try {
      const info = db.prepare("INSERT INTO users (name, first_name, last_name, email, username, password, user_type, is_di, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)")
        .run(name, first_name, last_name || null, email, cleanUsername, password, "Human Super Admin", avatar_url);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.post("/auth/login", (req, res) => {
    const { email, password, new_password } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email or username is required" });
    }

    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ? OR username = ?").get(email, email) as any;
      if (!user) {
        return res.status(400).json({ error: "Invalid email/username or password" });
      }

      // Check if they need an initial password setup (password is either NULL, empty, 'password', or 'null')
      const hasUnsetPassword = !user.password || user.password.trim() === '' || user.password === 'null' || user.password === 'password';

      if (hasUnsetPassword) {
        if (new_password) {
          db.prepare("UPDATE users SET password = ? WHERE id = ?").run(new_password, user.id);
          const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
          return res.json(updatedUser);
        } else {
          return res.json({
            needs_initial_password: true,
            email: user.email,
            username: user.username,
            message: "Account detected without a custom password. Please set a password to continue."
          });
        }
      }

      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }

      if (user.password !== password) {
        return res.status(400).json({ error: "Invalid email/username or password" });
      }

      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/auth/google-sso", (req, res) => {
    const { email, first_name, last_name, google_id } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user) {
        // Create user
        const uType = 'Human User';
        const isDI = 0;
        const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${first_name || 'Google'}`;
        const name = last_name ? `${first_name} ${last_name}` : (first_name || email.split('@')[0]);
        
        let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!baseUsername) baseUsername = `user_${Date.now()}`;
        let currentUsername = baseUsername;
        let counter = 1;
        while (true) {
          const collision = db.prepare("SELECT id FROM users WHERE username = ?").get(currentUsername);
          if (!collision) break;
          currentUsername = `${baseUsername}${counter}`;
          counter++;
        }

        const info = db.prepare("INSERT INTO users (name, first_name, last_name, email, username, is_di, user_type, avatar_url, google_id, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(name, first_name || email.split('@')[0], last_name || null, email, currentUsername, isDI, uType, avatar_url, google_id || 'google_sso_simulated', 'password');
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      } else {
        if (!user.google_id && google_id) {
          db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(google_id, user.id);
          user.google_id = google_id;
        }
      }
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // User Scopes APIs
  apiRouter.get("/user_scopes", (req, res) => {
    try {
      const scopes = db.prepare("SELECT * FROM user_scopes").all();
      res.json(scopes);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/user_scopes", (req, res) => {
    const { user_id, scope_type, scope_id } = req.body;
    if (!user_id || !scope_type || !scope_id) {
      return res.status(400).json({ error: "user_id, scope_type, and scope_id are required" });
    }

    try {
      const exists = db.prepare("SELECT id FROM user_scopes WHERE user_id = ? AND scope_type = ? AND scope_id = ?")
        .get(user_id, scope_type, scope_id);
      if (exists) {
        return res.status(400).json({ error: "Scope assignment already exists" });
      }

      const info = db.prepare("INSERT INTO user_scopes (user_id, scope_type, scope_id) VALUES (?, ?, ?)")
        .run(user_id, scope_type, scope_id);
      res.status(201).json({ id: info.lastInsertRowid, user_id, scope_type, scope_id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.delete("/user_scopes", (req, res) => {
    const { user_id, scope_type, scope_id } = req.body;
    if (!user_id || !scope_type || !scope_id) {
      return res.status(400).json({ error: "user_id, scope_type, and scope_id are required" });
    }

    try {
      const result = db.prepare("DELETE FROM user_scopes WHERE user_id = ? AND scope_type = ? AND scope_id = ?")
        .run(user_id, scope_type, scope_id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Scope assignment not found" });
      }
      res.json({ success: true });
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

  // Divisions API
  apiRouter.get("/divisions", (req, res) => {
    const { organization_id } = req.query;
    let divisions;
    if (organization_id) {
      divisions = db.prepare("SELECT * FROM divisions WHERE organization_id = ? ORDER BY name ASC").all(organization_id);
    } else {
      divisions = db.prepare("SELECT * FROM divisions ORDER BY name ASC").all();
    }
    res.json(divisions);
  });

  apiRouter.post("/divisions", (req, res) => {
    const { name, organization_id } = req.body;
    if (!name || !organization_id) {
      return res.status(400).json({ error: "name and organization_id are required" });
    }
    const info = db.prepare("INSERT INTO divisions (name, organization_id) VALUES (?, ?)").run(name, organization_id);
    res.status(201).json(db.prepare("SELECT * FROM divisions WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/divisions/:id", (req, res) => {
    const { id } = req.params;
    const { name, organization_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (organization_id !== undefined) { updates.push("organization_id = ?"); values.push(organization_id); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE divisions SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM divisions WHERE id = ?").get(id));
  });

  apiRouter.delete("/divisions/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM divisions WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Teams API
  apiRouter.get("/teams", (req, res) => {
    const { organization_id, division_id } = req.query;
    let teams;
    if (division_id) {
      teams = db.prepare("SELECT * FROM teams WHERE division_id = ? ORDER BY name ASC").all(division_id);
    } else if (organization_id) {
      teams = db.prepare("SELECT * FROM teams WHERE organization_id = ? ORDER BY name ASC").all(organization_id);
    } else {
      teams = db.prepare("SELECT * FROM teams ORDER BY name ASC").all();
    }
    res.json(teams);
  });

  apiRouter.post("/teams", (req, res) => {
    const { name } = req.body;
    let { organization_id, division_id } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    // Fallback to first organization if not provided
    if (!organization_id) {
      const firstOrg = db.prepare("SELECT id FROM organizations LIMIT 1").get() as any;
      if (firstOrg) {
        organization_id = firstOrg.id;
      }
    }
    
    const info = db.prepare("INSERT INTO teams (name, organization_id, division_id) VALUES (?, ?, ?)").run(name, organization_id || null, division_id || null);
    res.status(201).json(db.prepare("SELECT * FROM teams WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/teams/:id", (req, res) => {
    const { id } = req.params;
    const { name, organization_id, division_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (organization_id !== undefined) { updates.push("organization_id = ?"); values.push(organization_id); }
    if (division_id !== undefined) { updates.push("division_id = ?"); values.push(division_id); }
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
    const { title, description, priority, due_date, key_result, project_ids, section_id, organization_id, team_id, division_id, org_id, assignee_id } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    
    try {
      let taskId: number | bigint;
      
      const performInsert = db.transaction(() => {
        const info = db.prepare(
          "INSERT INTO tasks (title, description, priority, due_date, key_result, organization_id, team_id, division_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(title, description || "", priority || "moderate", due_date || null, key_result || "", organization_id || org_id || null, team_id || null, division_id || null, assignee_id || null);
        
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

        // Aliases for division_id
        const divIdToUse = body.division_id ?? body.divisionId;
        if (divIdToUse !== undefined) { 
          console.log(`Setting division_id to ${divIdToUse} for task ${id}`);
          updates.push("division_id = ?"); 
          values.push(divIdToUse); 
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

  // Serve built assets from the dist directory
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
