// Unit tests for the in-app AI agent loop (2026-07-16).
// Run: npx tsx test-agent.ts
//
// These exercise agent.ts with an INJECTED fake model and a fake Roots API,
// so no live LLM, network, or database is needed. The most important thing
// proven here is the security contract: when the (fake) API denies an action
// with 403 — exactly the "Audrey with zero scopes" scenario from the build
// plan — the agent surfaces the denial and records ok:false. It has no path to
// fabricate success, because every action goes through the injected ApiCaller,
// which in production is the real Roots API called with the user's own token.

import {
  runAgentLoop,
  executeTool,
  sanitizeIncomingMessages,
  type ApiCaller,
  type ModelCaller,
  type AnthropicResponse,
} from "./agent";

let passed = 0;
let failed = 0;
function assert(cond: any, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

// A fake Roots API. `allowedProjects` models the caller's scope: creating a
// task in a project not in that list returns 403, mirroring
// canManageStructureServer. superAdmin bypasses the check (allowed anywhere).
function makeFakeApi(opts: { allowedProjects?: number[]; superAdmin?: boolean }): {
  call: ApiCaller;
  log: { method: string; path: string; body?: any }[];
  tasks: Map<number, any>;
} {
  const log: { method: string; path: string; body?: any }[] = [];
  const tasks = new Map<number, any>();
  let nextId = 100;
  const allowed = opts.allowedProjects || [];

  const call: ApiCaller = async (method, path, body) => {
    log.push({ method, path, body });

    if (method === "GET" && path === "/organizations") return { status: 200, body: [{ id: 1, name: "Acme" }] };
    if (method === "GET" && path === "/divisions") return { status: 200, body: [{ id: 2, name: "Eng", organization_id: 1 }] };
    if (method === "GET" && path === "/teams") return { status: 200, body: [{ id: 3, name: "Platform", division_id: 2, organization_id: 1 }] };
    if (method === "GET" && path === "/sub_teams") return { status: 200, body: [] };
    if (method === "GET" && path === "/projects") return { status: 200, body: [{ id: 5, name: "Finance", team_id: 3, sub_team_id: null }] };
    if (method === "GET" && path === "/sections") return { status: 200, body: [{ id: 9, name: "Backlog", project_id: 5 }] };
    if (method === "GET" && path === "/users") return { status: 200, body: [{ id: 1, name: "Greg", first_name: "Greg", user_type: "Human Super Admin" }] };

    if (method === "POST" && path === "/tasks") {
      const projectIds: number[] = body?.project_ids || [];
      const permitted = opts.superAdmin || projectIds.some((p) => allowed.includes(p));
      if (!permitted) return { status: 403, body: { error: "Not authorized to create a task here" } };
      const id = nextId++;
      const task = { id, status: "pending", ...body };
      tasks.set(id, task);
      return { status: 201, body: task };
    }
    if (method === "GET" && path.startsWith("/tasks")) {
      return { status: 200, body: [...tasks.values()] };
    }
    if (method === "DELETE" && path.startsWith("/tasks/")) {
      return { status: 204, body: null };
    }
    if (method === "POST" && path === "/comments") {
      return { status: 201, body: { id: 1, content: body.content } };
    }
    return { status: 404, body: { error: "not found" } };
  };

  return { call, log, tasks };
}

// A scripted fake model. Each entry is the response to return on that turn;
// once the script is exhausted the last entry repeats (used for the loop guard).
function makeScriptedModel(script: AnthropicResponse[]): { call: ModelCaller } {
  let turn = 0;
  const call: ModelCaller = async () => {
    const resp = script[Math.min(turn, script.length - 1)];
    turn++;
    return resp;
  };
  return { call };
}

const toolUse = (name: string, input: any, id = "t1"): AnthropicResponse => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input }],
});
const finalText = (text: string): AnthropicResponse => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text }],
});

const user = { id: 1, first_name: "Greg", user_type: "Human User" };

async function run() {
  // --- Scenario A: happy path create ---
  console.log("Scenario A: create a task the user is allowed to create");
  {
    const api = makeFakeApi({ allowedProjects: [5] });
    const model = makeScriptedModel([
      toolUse("create_task", { title: "Ship v2", project_id: 5 }),
      finalText("Done — created “Ship v2” in Finance."),
    ]);
    const res = await runAgentLoop({
      messages: [{ role: "user", content: "Create a task 'Ship v2' in project 5" }],
      callModel: model.call,
      callApi: api.call,
      user,
    });
    assert(res.stopped === "completed", "loop completes with a final text turn");
    assert(res.actions.length === 1 && res.actions[0].tool === "create_task", "one create_task action recorded");
    assert(res.actions[0].ok === true && res.actions[0].status === 201, "action marked ok with 201");
    assert(res.reply.includes("Ship v2"), "reply confirms the created task");
    const createCall = api.log.find((l) => l.method === "POST" && l.path === "/tasks");
    assert(!!createCall && Array.isArray(createCall.body.project_ids) && createCall.body.project_ids[0] === 5,
      "create_task maps project_id -> project_ids array for the API");
    assert(api.tasks.size === 1, "task actually persisted in the fake API");
  }

  // --- Scenario B: the Audrey scenario — denied by scope, must NOT fabricate ---
  console.log("Scenario B: create denied by scope (403) is surfaced, not faked");
  {
    const api = makeFakeApi({ allowedProjects: [] }); // zero scope
    const model = makeScriptedModel([
      toolUse("create_task", { title: "Sneaky task", project_id: 5 }),
      finalText("You don’t have access to create tasks in that project."),
    ]);
    const res = await runAgentLoop({
      messages: [{ role: "user", content: "Create a task in project 5" }],
      callModel: model.call,
      callApi: api.call,
      user,
    });
    assert(res.actions.length === 1 && res.actions[0].ok === false && res.actions[0].status === 403,
      "denied action recorded as ok:false with status 403");
    assert(api.tasks.size === 0, "no task was created (no bypass of the API's authorization)");
    assert(res.reply.toLowerCase().includes("access"), "reply relays the denial to the user");
  }

  // --- Scenario C: multi-step — resolve structure, then act ---
  console.log("Scenario C: list_structure then create_task using resolved ids");
  {
    const api = makeFakeApi({ allowedProjects: [5] });
    const model = makeScriptedModel([
      toolUse("list_structure", {}, "s1"),
      toolUse("create_task", { title: "Review Q3 budget", project_id: 5, section_id: 9, priority: "high" }, "s2"),
      finalText("Added “Review Q3 budget” to Finance › Backlog (high priority)."),
    ]);
    const res = await runAgentLoop({
      messages: [{ role: "user", content: "Add 'Review Q3 budget' to the Finance backlog, high priority" }],
      callModel: model.call,
      callApi: api.call,
      user,
    });
    assert(res.actions.length === 2, "two actions recorded (structure read + create)");
    assert(res.actions[0].tool === "list_structure" && res.actions[0].ok, "list_structure succeeded");
    assert(res.actions[1].tool === "create_task" && res.actions[1].ok, "create_task succeeded");
    assert(api.log.some((l) => l.path === "/organizations"), "list_structure fanned out to structure endpoints");
  }

  // --- Scenario D: runaway loop hits the turn guard ---
  console.log("Scenario D: max-turns guard stops an endless tool loop");
  {
    const api = makeFakeApi({ superAdmin: true });
    const model = makeScriptedModel([toolUse("list_tasks", {})]); // always tool_use, never finishes
    const res = await runAgentLoop({
      messages: [{ role: "user", content: "loop forever" }],
      callModel: model.call,
      callApi: api.call,
      user,
      maxTurns: 4,
    });
    assert(res.stopped === "max_turns", "loop stops at maxTurns");
    assert(res.actions.length === 4, "exactly maxTurns actions attempted");
    assert(res.reply.length > 0, "a graceful fallback reply is returned");
  }

  // --- Scenario E: executeTool field mapping ---
  console.log("Scenario E: executeTool direct field mapping");
  {
    const api = makeFakeApi({ superAdmin: true });
    const del = await executeTool(api.call, "delete_task", { task_id: 42 });
    assert(del.status === 204 && del.isError === false, "delete_task treats 204 as success");
    assert(del.content.includes("deleted"), "delete_task returns a deleted marker for the model");
    const com = await executeTool(api.call, "add_comment", { task_id: 42, content: "note" });
    assert(com.status === 201 && !com.isError, "add_comment posts a comment");
    const bad = await executeTool(api.call, "nonsense_tool", {});
    assert(bad.isError && bad.status === 400, "unknown tool is rejected");
  }

  // --- Scenario F: incoming-message sanitization ---
  console.log("Scenario F: transcript validation");
  {
    assert(sanitizeIncomingMessages([]) === null, "empty transcript rejected");
    assert(sanitizeIncomingMessages([{ role: "assistant", content: "hi" }]) === null, "assistant-first transcript rejected");
    assert(sanitizeIncomingMessages([{ role: "user", content: 5 }]) === null, "non-string content rejected");
    const good = sanitizeIncomingMessages([{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]);
    assert(Array.isArray(good) && good!.length === 2, "valid transcript accepted");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
