import { $ } from "bun";

const env = process.env;

function repoRef(value: string) {
  const [owner, repo] = value.split("/");
  if (!owner || !repo) throw new Error(`expected owner/repo, got "${value}"`);
  return { owner, repo };
}

export const config = {
  // The human whose Pull Shark we're feeding. PRs are opened with their token.
  author: env.GH_AUTHOR ?? "RealNattawattHongthong",
  // PRs go fork → upstream, like a normal open-source contribution.
  upstream: repoRef(env.GH_UPSTREAM ?? "nattawatt-com-org/shtx-wtf-is-this-2"),
  fork: repoRef(env.GH_FORK ?? "RealNattawattHongthong/shtx-wtf-is-this-2"),
  base: env.GH_BRANCH ?? "main",
  port: Number(env.PORT ?? 3000),
  // The nanny is the autopilot that keeps the pet alive (and keeps PRs flowing).
  nanny: env.NANNY !== "0",
  nannyIntervalSec: Number(env.NANNY_INTERVAL_SEC ?? 150),
  humanGapSec: Number(env.HUMAN_GAP_SEC ?? 4),
  // Hard caps on content-creating GitHub requests, well under GitHub's own 500/hour and 80/minute.
  writeBudgetPerHour: Number(env.WRITE_BUDGET_PER_HOUR ?? 300),
  writeBudgetPerMinute: Number(env.WRITE_BUDGET_PER_MINUTE ?? 30),
  maxQueue: Number(env.MAX_QUEUE ?? 12),
  // Real GitHub usernames only. Never add anyone who didn't agree to it.
  coauthors: (env.COAUTHORS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  allowGuestCoauthor: env.GUEST_COAUTHOR !== "0",
  target: 1024,
  anthropicKey: env.ANTHROPIC_API_KEY,
  // Speeds up biology for demos (2 = pet gets hungry twice as fast).
  timeScale: Number(env.TIME_SCALE ?? 1),
  dryRun: env.DRY_RUN === "1",
};

export async function resolveToken(): Promise<string> {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  return (await $`gh auth token`.quiet().text()).trim();
}
