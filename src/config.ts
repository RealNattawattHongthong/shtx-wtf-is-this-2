import { $ } from "bun";

const env = process.env;

export const config = {
  owner: env.GH_OWNER ?? "RealNattawattHongthong",
  repo: env.GH_REPO ?? "shtx-wtf-is-this-2",
  base: env.GH_BRANCH ?? "main",
  port: Number(env.PORT ?? 3000),
  // The nanny is the autopilot that keeps the pet alive (and keeps PRs flowing).
  nanny: env.NANNY !== "0",
  // GitHub allows ~500 content-creating requests/hour. One pet action = 5 writes.
  nannyIntervalSec: Number(env.NANNY_INTERVAL_SEC ?? 45),
  humanGapSec: Number(env.HUMAN_GAP_SEC ?? 4),
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
