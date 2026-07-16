// Roots in-app AI agent (2026-07-16).
//
// A native task-management assistant embedded in the Roots UI. The frontend
// (see AgentPanel in src/App.tsx) POSTs a plain chat transcript to
// POST /api/agent/chat; this module runs a Claude tool-use loop server-side
// and returns the assistant's final reply plus a list of the actions it took.
//
// SECURITY MODEL — the single most important property of this feature:
// the agent acts AS THE LOGGED-IN USER, never with any elevated identity.
// Every tool call is executed by calling Roots' own REST API over loopback
// with the *caller's own credential* forwarded verbatim (see makeLocalApiCaller).
// That means the agent physically cannot do anything the user could not do by
// hand in the UI — the exact same server-side authorization
// (`canManageStructureServer`, the Super-Admin gates, scope enforcement) runs
// on every action, because it literally goes through the same routes. There is
// no separate agent API key, no service account, no bypass path. A scoped
// user's agent gets the same 403s the user's browser would.
//
// The Anthropic API key lives only on the server (ANTHROPIC_API_KEY) and is
// never sent to the browser. The model is configurable via ANTHROPIC_MODEL.

// ---- Types -------------------------------------------------------------

export interface AnthropicContentBlock {
  type: string;
  // text blocks
  text?: string;
  // tool_use blocks
  id?: string;
  name?: string;
  input?: any;
}

export interface AnthropicResponse {
  stop_reason?: string;
  content: AnthropicContentBlock[];
}

// A message in Anthropic's format. `content` is either a plain string (for the
// simple user/assistant turns the frontend sends) or an array of blocks (which
// is what we build up internally for tool_use / tool_result turns).
export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | any[];
}

export type ModelCaller = (args: {
  system: string;
  tools: any[];
  messages: AnthropicMessage[];
}) => Promise<AnthropicResponse>;

// Returns the raw HTTP status + parsed body of a Roots API call. Injected so
// the tool loop can be tested without a live LLM or a specific transport.
export type ApiCaller = (
  method: string,
  path: string,
  body?: any
) => Promise<{ status: number; body: any }>;

export interface AgentUser {
  id: number;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  user_type?: string;
  is_di?: boolean;
}

export interface RunAgentArgs {
  messages: AnthropicMessage[];
  callModel: ModelCaller;
  callApi: ApiCaller;
  user: AgentUser;
  now?: Date;
  agentName?: string;
  maxTurns?: number;
}

export interface AgentAction {
  tool: string;
  input: any;
  ok: boolean;
  status: number;
}

export interface RunAgentResult {
  reply: string;
  actions: AgentAction[];
  stopped?: "completed" | "max_turns";
}

export const DEFAULT_AGENT_NAME = "Ivy";
export const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TURNS_DEFAULT = 10;

// ---- Tool definitions (Anthropic tool schema) --------------------------
// Task-focused for v1. Structure (orgs/divisions/teams/projects/sections) is
// read-only via list_structure so the agent can resolve names to IDs; it has
// no create/edit/delete tools for structure. Writes are all task-scoped.

export const AGENT_TOOLS = [
  {
    name: "list_structure",
    description:
      "Read the organization structure the user can see: organizations, divisions, teams, sub-teams, projects, sections, and users (id + name). Call this FIRST when you need to resolve a name the user mentioned (a project, team, section, or assignee) into the numeric id required by the other tools. Read-only.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_tasks",
    description:
      "List tasks, most-recent first. Optionally narrow by project_id, or do a case-insensitive substring match on the title with `search`. Use this to find a task's id before updating, moving, or deleting it.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "Only tasks in this project." },
        search: { type: "string", description: "Case-insensitive substring to match against task titles." },
        status: { type: "string", enum: ["pending", "in_progress", "completed"], description: "Only tasks with this status." },
      },
      required: [],
    },
  },
  {
    name: "get_task",
    description: "Fetch one task in full (description, subtasks, comments, project/section assignments) by its id.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "number" } },
      required: ["task_id"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task. Provide at least a title. To place it in a project, pass project_id (and optionally section_id). Team/division/organization can be set explicitly or will be inferred by the server from the project. Only succeeds where the user has permission to create tasks; otherwise returns a 403 you should relay plainly.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "moderate", "high", "urgent"] },
        due_date: { type: "string", description: "ISO date string, e.g. 2026-07-20." },
        project_id: { type: "number" },
        section_id: { type: "number" },
        team_id: { type: "number" },
        sub_team_id: { type: "number" },
        division_id: { type: "number" },
        organization_id: { type: "number" },
        assignee_id: { type: "number" },
        key_result: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description:
      "Update fields on an existing task by id: title, description, status, priority, due_date, assignee_id, or key_result. Only include the fields you want to change.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "number" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed"] },
        priority: { type: "string", enum: ["low", "moderate", "high", "urgent"] },
        due_date: { type: "string" },
        assignee_id: { type: "number" },
        key_result: { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "move_task",
    description:
      "Move a task to a different section within a project it already belongs to. Pass task_id, the target section_id, and current_project_id (the project the section lives in).",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "number" },
        section_id: { type: "number" },
        current_project_id: { type: "number" },
      },
      required: ["task_id", "section_id", "current_project_id"],
    },
  },
  {
    name: "delete_task",
    description:
      "Permanently delete a task and its subtasks by id. This is destructive — only call it after the user has clearly confirmed they want the task deleted.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "number" } },
      required: ["task_id"],
    },
  },
  {
    name: "add_subtask",
    description: "Add a subtask (title only) under an existing task.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "number" }, title: { type: "string" } },
      required: ["task_id", "title"],
    },
  },
  {
    name: "add_comment",
    description: "Post a comment / activity-log note on a task.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "number" }, content: { type: "string" } },
      required: ["task_id", "content"],
    },
  },
];

// ---- System prompt -----------------------------------------------------

export function buildSystemPrompt(user: AgentUser, now: Date, agentName: string): string {
  const displayName =
    user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "the current user";
  const role = user.user_type || "User";
  const today = now.toISOString().slice(0, 10);
  return [
    `You are ${agentName}, a task-management assistant built into Roots, a hierarchical task manager.`,
    `The hierarchy is: Organization > Division > Team > Sub-team (optional) > Project > Task > Subtask.`,
    ``,
    `You are helping ${displayName} (role: ${role}). Today is ${today}.`,
    ``,
    `You act entirely on this user's behalf and with exactly their permissions. Every action you take runs through the same access checks as if the user did it themselves. If a tool returns a 403 / "not authorized", tell the user plainly that they don't have access to do that there — never try to work around it.`,
    ``,
    `Guidelines:`,
    `- The tools require numeric ids. When the user refers to a project, team, section, or person by name, call list_structure (and list_tasks for tasks) to resolve the correct id before acting. Never guess an id.`,
    `- Before deleting anything, make sure the user has clearly confirmed. Do not delete on a vague request.`,
    `- When you create or change something, briefly confirm what you did (task title, where it went).`,
    `- Prefer taking the action directly when the request is clear, rather than asking unnecessary questions. Ask only when something essential is genuinely ambiguous.`,
    `- Be concise. You are a sidebar assistant, not a chatbot — short, useful replies.`,
    `- You manage tasks (create, edit, move, complete, delete, subtasks, comments). You can read structure but cannot create or edit organizations, divisions, teams, or projects; if the user asks for that, tell them to use the main Roots UI.`,
  ].join("\n");
}

// ---- Tool execution ----------------------------------------------------
// Each tool maps to one or more Roots REST calls via the injected ApiCaller.
// The return `content` is a compact string the model reads back; `isError`
// flags non-2xx so the model knows the action failed (e.g. a 403).

function ok(status: number): boolean {
  return status >= 200 && status < 300;
}

export async function executeTool(
  callApi: ApiCaller,
  name: string,
  input: any
): Promise<{ content: string; status: number; isError: boolean }> {
  const wrap = (status: number, body: any) => ({
    content: typeof body === "string" ? body : JSON.stringify(body),
    status,
    isError: !ok(status),
  });

  try {
    switch (name) {
      case "list_structure": {
        const [orgs, divisions, teams, subTeams, projects, sections, users] = await Promise.all([
          callApi("GET", "/organizations"),
          callApi("GET", "/divisions"),
          callApi("GET", "/teams"),
          callApi("GET", "/sub_teams"),
          callApi("GET", "/projects"),
          callApi("GET", "/sections"),
          callApi("GET", "/users"),
        ]);
        const slim = (rows: any[], fields: string[]) =>
          Array.isArray(rows) ? rows.map((r) => Object.fromEntries(fields.map((f) => [f, r[f]]))) : rows;
        return wrap(200, {
          organizations: slim(orgs.body, ["id", "name"]),
          divisions: slim(divisions.body, ["id", "name", "organization_id"]),
          teams: slim(teams.body, ["id", "name", "division_id", "organization_id"]),
          sub_teams: slim(subTeams.body, ["id", "name", "team_id"]),
          projects: slim(projects.body, ["id", "name", "team_id", "sub_team_id"]),
          sections: slim(sections.body, ["id", "name", "project_id"]),
          users: slim(users.body, ["id", "name", "first_name", "last_name", "email", "user_type"]),
        });
      }
      case "list_tasks": {
        const path = input?.project_id ? `/tasks?project_id=${encodeURIComponent(input.project_id)}` : "/tasks";
        const res = await callApi("GET", path);
        let rows = res.body;
        if (Array.isArray(rows)) {
          if (input?.search) {
            const q = String(input.search).toLowerCase();
            rows = rows.filter((t: any) => String(t.title || "").toLowerCase().includes(q));
          }
          if (input?.status) rows = rows.filter((t: any) => t.status === input.status);
          // Trim to the fields the model needs, to keep the context small.
          rows = rows.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date,
            assignee_id: t.assignee_id,
            project_ids: t.project_ids,
          }));
        }
        return wrap(res.status, rows);
      }
      case "get_task": {
        const res = await callApi("GET", `/tasks/${encodeURIComponent(input.task_id)}`);
        return wrap(res.status, res.body);
      }
      case "create_task": {
        const res = await callApi("POST", "/tasks", {
          title: input.title,
          description: input.description,
          priority: input.priority,
          due_date: input.due_date,
          key_result: input.key_result,
          assignee_id: input.assignee_id,
          organization_id: input.organization_id,
          division_id: input.division_id,
          team_id: input.team_id,
          sub_team_id: input.sub_team_id,
          section_id: input.section_id,
          project_ids: input.project_id != null ? [input.project_id] : undefined,
        });
        return wrap(res.status, res.body);
      }
      case "update_task": {
        const { task_id, ...fields } = input || {};
        const res = await callApi("PATCH", `/tasks/${encodeURIComponent(task_id)}`, fields);
        return wrap(res.status, res.body);
      }
      case "move_task": {
        const res = await callApi("PATCH", `/tasks/${encodeURIComponent(input.task_id)}/section`, {
          section_id: input.section_id,
          current_project_id: input.current_project_id,
        });
        return wrap(res.status, res.body);
      }
      case "delete_task": {
        const res = await callApi("DELETE", `/tasks/${encodeURIComponent(input.task_id)}`);
        return wrap(res.status, ok(res.status) ? { deleted: true, task_id: input.task_id } : res.body);
      }
      case "add_subtask": {
        const res = await callApi("POST", "/subtasks", { task_id: input.task_id, title: input.title });
        return wrap(res.status, res.body);
      }
      case "add_comment": {
        const res = await callApi("POST", "/comments", { task_id: input.task_id, content: input.content });
        return wrap(res.status, res.body);
      }
      default:
        return { content: `Unknown tool: ${name}`, status: 400, isError: true };
    }
  } catch (e: any) {
    return { content: `Tool ${name} failed: ${e?.message || String(e)}`, status: 500, isError: true };
  }
}

// ---- The agent loop ----------------------------------------------------

function textFromContent(content: AnthropicContentBlock[]): string {
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runAgentLoop(args: RunAgentArgs): Promise<RunAgentResult> {
  const { callModel, callApi, user } = args;
  const now = args.now || new Date();
  const agentName = args.agentName || DEFAULT_AGENT_NAME;
  const maxTurns = args.maxTurns || MAX_TURNS_DEFAULT;
  const system = buildSystemPrompt(user, now, agentName);

  // Work on a copy; the frontend only ever sees the final reply, but we build
  // up the full tool-use transcript here for the model.
  const convo: AnthropicMessage[] = args.messages.map((m) => ({ role: m.role, content: m.content }));
  const actions: AgentAction[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await callModel({ system, tools: AGENT_TOOLS, messages: convo });
    convo.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason !== "tool_use") {
      return { reply: textFromContent(resp.content), actions, stopped: "completed" };
    }

    const toolResults: any[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      const result = await executeTool(callApi, block.name!, block.input || {});
      actions.push({ tool: block.name!, input: block.input, ok: !result.isError, status: result.status });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError,
      });
    }
    convo.push({ role: "user", content: toolResults });
  }

  // Ran out of turns without a final text answer.
  return {
    reply:
      "I did several steps but reached my action limit before finishing. Here's where I got to — let me know if you'd like me to continue.",
    actions,
    stopped: "max_turns",
  };
}

// ---- Transport helpers (wired up in server.ts) -------------------------

// Statuses worth retrying: rate limit (429) and transient server/overload
// conditions (500/502/503/529). Anthropic returns 529 "overloaded_error" when
// its API is momentarily at capacity — very retryable.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);

export function makeClaudeCaller(apiKey: string, model: string, maxRetries = 4): ModelCaller {
  return async ({ system, tools, messages }) => {
    let lastError = "Anthropic API error";
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: 1500, system, tools, messages }),
      });
      if (resp.ok) {
        if (attempt > 0) console.log(`[agent] Anthropic OK after ${attempt} retr${attempt === 1 ? "y" : "ies"} (model=${model})`);
        return (await resp.json()) as AnthropicResponse;
      }

      const text = await resp.text();
      lastError = `Anthropic API error ${resp.status}: ${text}`;
      const h = (k: string) => resp.headers.get(k) ?? "-";
      console.warn(
        `[agent] Anthropic attempt ${attempt + 1}/${maxRetries + 1} model=${model} status=${resp.status}` +
          ` request-id=${h("request-id")} retry-after=${h("retry-after")} should-retry=${h("x-should-retry")}` +
          ` ratelimit-remaining=${h("anthropic-ratelimit-requests-remaining")}/${h("anthropic-ratelimit-tokens-remaining")}` +
          ` body=${text.slice(0, 300)}`
      );
      // Give up immediately on non-retryable errors (bad key, bad request, etc.)
      // or once we've exhausted the retry budget.
      if (!RETRYABLE_STATUSES.has(resp.status) || attempt === maxRetries) {
        throw new Error(lastError);
      }
      // Honor Retry-After when present; otherwise exponential backoff + jitter.
      const retryAfter = Number(resp.headers.get("retry-after"));
      const delayMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error(lastError);
  };
}

// Calls Roots' own API over loopback, forwarding the caller's credential so
// every action is authorized exactly as the logged-in user. baseUrl is the
// server's own /api mount, e.g. http://127.0.0.1:8080/api.
export function makeLocalApiCaller(baseUrl: string, credential: string): ApiCaller {
  return async (method, path, body) => {
    const resp = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${credential}`,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: resp.status, body: parsed };
  };
}

// Basic shape validation for the transcript the frontend posts.
export function sanitizeIncomingMessages(raw: any): AnthropicMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: AnthropicMessage[] = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string") return null;
    out.push({ role: m.role, content: m.content });
  }
  // Anthropic requires the transcript to start with a user turn.
  if (out[0].role !== "user") return null;
  return out;
}
