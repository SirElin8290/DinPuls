import assert from "node:assert/strict";
import { runScheduled, triggerWorkflowIfNeeded } from "../cloudflare/github-scheduler-worker.mjs";

const env = {
  GITHUB_TOKEN: "test-token-not-a-real-secret",
  GITHUB_OWNER: "SirElin8290",
  GITHUB_REPO: "DinPuls",
  GITHUB_REF: "main",
};

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function testDispatchRequest() {
  const calls = [];
  const mockFetch = async (url, options = {}) => {
    calls.push({ url, options });
    return calls.length === 1
      ? response(200, { workflow_runs: [{ id: 1, status: "completed", conclusion: "success", run_started_at: "2026-09-02T10:00:00Z" }] })
      : response(204);
  };

  const result = await triggerWorkflowIfNeeded(
    { file: "update-transport.yml", minimumGapMinutes: 10 },
    env,
    mockFetch,
    Date.parse("2026-09-02T10:20:00Z"),
  );

  assert.equal(result.action, "dispatched");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://api.github.com/repos/SirElin8290/DinPuls/actions/workflows/update-transport.yml/dispatches");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-token-not-a-real-secret");
  assert.deepEqual(JSON.parse(calls[1].options.body), { ref: "main" });
}

async function testActiveRunGuard() {
  let calls = 0;
  const result = await triggerWorkflowIfNeeded(
    { file: "update-weather-live.yml", minimumGapMinutes: 8 },
    env,
    async () => {
      calls += 1;
      return response(200, { workflow_runs: [{ id: 22, status: "in_progress", conclusion: null }] });
    },
  );
  assert.equal(result.action, "skipped-active");
  assert.equal(calls, 1);
}

async function testRecentSuccessGuard() {
  let calls = 0;
  const result = await triggerWorkflowIfNeeded(
    { file: "update-weather-live.yml", minimumGapMinutes: 8 },
    env,
    async () => {
      calls += 1;
      return response(200, { workflow_runs: [{ id: 23, status: "completed", conclusion: "success", run_started_at: "2026-09-02T10:15:00Z" }] });
    },
    Date.parse("2026-09-02T10:20:00Z"),
  );
  assert.equal(result.action, "skipped-recent");
  assert.equal(calls, 1);
}

async function testCronRoutingAndErrors() {
  const result = await runScheduled(
    "10,25,40,55 * * * *",
    env,
    async () => response(200, { workflow_runs: [{ id: 24, status: "queued", conclusion: null }] }),
  );
  assert.equal(result.workflow, "update-transport.yml");
  await assert.rejects(() => runScheduled("* * * * *", env, async () => response(200)), /Unexpected cron/);
  await assert.rejects(
    () => triggerWorkflowIfNeeded({ file: "update-transport.yml", minimumGapMinutes: 10 }, { ...env, GITHUB_TOKEN: "" }, async () => response(200)),
    /GITHUB_TOKEN/,
  );
}

await testDispatchRequest();
await testActiveRunGuard();
await testRecentSuccessGuard();
await testCronRoutingAndErrors();
console.log("GitHub scheduler Worker tests passed.");
