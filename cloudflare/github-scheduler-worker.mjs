const WORKFLOWS_BY_CRON = {
  "8,18,28,38,48,58 * * * *": {
    file: "update-weather-live.yml",
    minimumGapMinutes: 8,
  },
  "10,25,40,55 * * * *": {
    file: "update-transport.yml",
    minimumGapMinutes: 10,
  },
};

const API_VERSION = "2022-11-28";

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "DinPuls-GitHub-Scheduler",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

function assertEnvironment(env) {
  for (const name of ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_REF"]) {
    if (!env[name]) throw new Error(`Missing required environment value: ${name}`);
  }
}

export async function triggerWorkflowIfNeeded(workflow, env, fetchImpl = fetch, now = Date.now()) {
  assertEnvironment(env);

  const repository = `${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`;
  const workflowFile = encodeURIComponent(workflow.file);
  const baseUrl = `https://api.github.com/repos/${repository}/actions/workflows/${workflowFile}`;
  const headers = githubHeaders(env.GITHUB_TOKEN);
  const runsResponse = await fetchImpl(`${baseUrl}/runs?per_page=10`, { headers });

  if (!runsResponse.ok) {
    throw new Error(`GitHub run lookup failed for ${workflow.file}: HTTP ${runsResponse.status}`);
  }

  const payload = await runsResponse.json();
  const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
  const activeRun = runs.find((run) => run.status && run.status !== "completed");

  if (activeRun) {
    return { workflow: workflow.file, action: "skipped-active", runId: activeRun.id };
  }

  const newestSuccessfulRun = runs.find((run) => run.status === "completed" && run.conclusion === "success");
  const newestRunTime = Date.parse(newestSuccessfulRun?.run_started_at || newestSuccessfulRun?.created_at || "");
  const minimumGapMs = workflow.minimumGapMinutes * 60_000;

  if (Number.isFinite(newestRunTime) && now - newestRunTime < minimumGapMs) {
    return { workflow: workflow.file, action: "skipped-recent", runId: newestSuccessfulRun.id };
  }

  const dispatchResponse = await fetchImpl(`${baseUrl}/dispatches`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: env.GITHUB_REF }),
  });

  if (dispatchResponse.status !== 204) {
    throw new Error(`GitHub dispatch failed for ${workflow.file}: HTTP ${dispatchResponse.status}`);
  }

  return { workflow: workflow.file, action: "dispatched" };
}

export async function runScheduled(cron, env, fetchImpl = fetch, now = Date.now()) {
  const workflow = WORKFLOWS_BY_CRON[cron];
  if (!workflow) throw new Error(`Unexpected cron expression: ${cron}`);

  const result = await triggerWorkflowIfNeeded(workflow, env, fetchImpl, now);
  console.log(JSON.stringify({ event: "github-workflow-scheduler", ...result }));
  return result;
}

export default {
  async scheduled(controller, env) {
    await runScheduled(controller.cron, env);
  },
};
