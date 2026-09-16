import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'heke99/flexexa';
const endpoint = `https://api.github.com/repos/${repository}/branches/main`;
const reject = (code) => { throw new Error(`DEV_APPLY_CONTEXT_REJECTED: ${code}`); };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// This is a necessary pre-credential gate, not full governance or Phase 0 approval.
// GitHub reports whether any branch protection applies; reviewer/ruleset coverage
// and AWS bootstrap readiness still need independent review.
export function validateInvocation(env) {
  const expected = {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REPOSITORY: repository,
    GITHUB_REPOSITORY_ID: '1362385793',
    GITHUB_REPOSITORY_OWNER_ID: '129280077',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com',
    FLEXEXA_APPLY_CONFIRM: 'APPLY_DEV',
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (env[key] !== expectedValue) reject(`INVALID_${key}`);
  }
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')) reject('INVALID_COMMIT_SHA');
  for (const key of ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT']) {
    if (!/^[1-9][0-9]*$/.test(env[key] ?? '')) reject(`INVALID_${key}`);
  }
  if (typeof env.GH_TOKEN !== 'string' || !env.GH_TOKEN.trim()) reject('MISSING_GITHUB_TOKEN');
  return { sha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT };
}

export function verifyMainBranch(branch, invocation) {
  if (!record(branch) || branch.name !== 'main' || !record(branch.commit)) reject('INVALID_BRANCH_RESPONSE');
  if (branch.commit.sha !== invocation.sha) reject('STALE_MAIN_COMMIT');
  if (branch.protected !== true) reject('MAIN_BRANCH_NOT_PROTECTED');
  return {
    gate: 'dev-apply-context-v1', status: 'passed', repository,
    commit: invocation.sha, runId: invocation.runId, runAttempt: invocation.runAttempt,
    protected: true,
    scope: 'Pre-credential context only; not complete governance, AWS readiness or Phase 0 acceptance.',
  };
}

export async function verifyApplyContext(env, fetchImpl = fetch) {
  const invocation = validateInvocation(env);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'GET', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'flexexa-dev-apply-context',
      },
    });
  } catch { reject('GITHUB_READ_FAILED'); }
  if (response.status !== 200 || response.ok !== true || response.redirected === true) reject('GITHUB_READ_DENIED');
  let branch;
  try { branch = await response.json(); } catch { reject('INVALID_GITHUB_JSON'); }
  return verifyMainBranch(branch, invocation);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) reject('UNEXPECTED_ARGUMENTS');
    console.log(JSON.stringify(await verifyApplyContext(process.env)));
  } catch (error) {
    // Never print an HTTP response, headers, token, or an upstream exception.
    const message = error instanceof Error && /^DEV_APPLY_CONTEXT_REJECTED: [A-Z_]+$/.test(error.message)
      ? error.message : 'DEV_APPLY_CONTEXT_REJECTED: VERIFICATION_FAILED';
    console.error(message);
    process.exitCode = 1;
  }
}
