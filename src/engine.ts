import { config } from "./config";
import type { Forge, MergedPR } from "./github";
import { boardDecision, boardReview, compileToBrainfuck, mine, quantumMood, runBrainfuck } from "./microservices";
import { apply, moodOf, nannyChoice, newEgg, sprite, stageOf, tick, tierOf, type ActionId, type Pet } from "./pet";
import { renderReadme } from "./readme";

export interface Job {
  id: string;
  action: ActionId;
  by: string;
  github?: string;
  source: "human" | "nanny";
}

export interface StageInfo {
  id: string;
  name: string;
  tech: string;
}

export const STAGES: StageInfo[] = [
  { id: "lb", name: "Load Balancer", tech: "nginx in a trench coat" },
  { id: "auth", name: "Auth Gateway", tech: "Brainfuck" },
  { id: "bus", name: "Event Bus", tech: "Kafka (Array.prototype.push)" },
  { id: "bio", name: "Biological Clock", tech: "TypeScript + calculus" },
  { id: "vets", name: "Veterinary Review Board", tech: "3 Office Assistants" },
  { id: "chain", name: "Proof-of-Pet Blockchain", tech: "SHA-256 PoW" },
  { id: "quantum", name: "Quantum Mood Engine", tech: "Math.random()" },
  { id: "render", name: "README Renderer", tech: "string concat, enterprise grade" },
  { id: "git", name: "GitOps Controller", tech: "GitHub REST API (real)" },
];

type Emit = (event: string, data: unknown) => void;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STATE_PATH = "pet/state.json";

export class Engine {
  pet: Pet = newEgg(1);
  mergedTotal = 0;
  sessionMerged = 0;
  sessionCoauthored = 0;
  queue: Job[] = [];
  current: Job | null = null;
  nanny = config.nanny;
  nextNannyAt = 0;
  recent: (MergedPR & { by: string; action: ActionId; at: number; coauthors: number })[] = [];
  private lastPRAt = 0;
  private nannyCount = 0;
  private busOffset = 0;

  constructor(private forge: Forge, private emit: Emit) {}

  async init() {
    const raw = await this.forge.readFile(STATE_PATH);
    if (raw) this.pet = JSON.parse(raw);
    this.mergedTotal = await this.forge.mergedPRCount().catch(() => 0);
    this.log(`booted · ${this.pet.name} gen ${this.pet.generation} · ${this.mergedTotal} merged PRs so far`);
    void this.loop();
  }

  snapshot() {
    const now = Date.now();
    const { pet } = tick(this.pet, now, config.timeScale);
    const tier = tierOf(this.mergedTotal);
    return {
      pet,
      mood: moodOf(pet),
      stage: stageOf(pet, now, config.timeScale),
      tier,
      sprite: sprite(pet, tier, now, config.timeScale),
      mergedTotal: this.mergedTotal,
      target: config.target,
      sessionMerged: this.sessionMerged,
      sessionCoauthored: this.sessionCoauthored,
      queue: this.queue.map((j) => ({ id: j.id, action: j.action, by: j.by })),
      current: this.current && { id: this.current.id, action: this.current.action, by: this.current.by, source: this.current.source },
      nanny: this.nanny,
      nannyIntervalSec: config.nannyIntervalSec,
      nextNannyAt: this.nextNannyAt,
      recent: this.recent.slice(0, 30),
      stages: STAGES.map((s) => (s.id === "vets" && config.anthropicKey ? { ...s, tech: "Claude Haiku ×3 (real AI)" } : s)),
      repo: `${config.owner}/${config.repo}`,
      dryRun: config.dryRun,
      guestCoauthor: config.allowGuestCoauthor,
    };
  }

  enqueue(action: ActionId, by: string, github?: string): Job {
    if (this.queue.length >= config.maxQueue) throw new Error("Kafka is full (12 messages). Enterprise scale reached.");
    const job: Job = { id: crypto.randomUUID().slice(0, 8), action, by, github, source: "human" };
    this.queue.push(job);
    this.emit("queue", this.snapshot().queue);
    return job;
  }

  setNanny(on: boolean) {
    this.nanny = on;
    this.emit("nanny", { nanny: on });
  }

  private log(msg: string, level: "info" | "warn" | "error" = "info") {
    this.emit("log", { at: Date.now(), msg, level });
  }

  private async loop() {
    for (;;) {
      let job = this.queue.shift() ?? null;
      const now = Date.now();
      if (!job) {
        this.nextNannyAt = this.lastPRAt + config.nannyIntervalSec * 1000;
        if (this.nanny && now >= this.nextNannyAt) {
          const action = nannyChoice(tick(this.pet, now, config.timeScale).pet, this.nannyCount++);
          job = { id: crypto.randomUUID().slice(0, 8), action, by: "🤖 nanny", source: "nanny" };
        } else {
          await sleep(500);
          continue;
        }
      } else {
        const wait = this.lastPRAt + config.humanGapSec * 1000 - now;
        if (wait > 0) await sleep(wait);
      }
      this.current = job;
      this.lastPRAt = Date.now();
      try {
        await this.run(job);
      } catch (e) {
        this.log(String(e), "error");
        this.emit("bsod", { message: String(e) });
      }
      this.current = null;
      this.emit("state", this.snapshot());
    }
  }

  private async stage<T>(job: Job, id: string, fn: () => Promise<{ detail: string; value?: T }>): Promise<T | undefined> {
    const theatrical = job.source === "human";
    const started = performance.now();
    this.emit("stage", { job: job.id, stage: id, status: "running" });
    try {
      const { detail, value } = await fn();
      if (theatrical) await sleep(350 + Math.random() * 700);
      this.emit("stage", { job: job.id, stage: id, status: "done", detail, ms: Math.round(performance.now() - started) });
      return value;
    } catch (e) {
      this.emit("stage", { job: job.id, stage: id, status: "error", detail: String(e) });
      throw e;
    }
  }

  private async run(job: Job) {
    this.emit("job", { id: job.id, action: job.action, by: job.by, source: job.source });
    const human = job.source === "human";

    await this.stage(job, "lb", async () => ({ detail: "routed to replica 1 of 1 (99.999% uptime, 1 sample)" }));

    await this.stage(job, "auth", async () => {
      const program = compileToBrainfuck("OK");
      const out = runBrainfuck(program);
      if (out !== "OK") throw new Error("Brainfuck auth failed. Access denied.");
      return { detail: `executed ${program.length} bytes of Brainfuck → "${out}"` };
    });

    await this.stage(job, "bus", async () => ({ detail: `produced to topic pet.${job.action} @ offset ${this.busOffset++}` }));

    const ticked = await this.stage(job, "bio", async () => {
      const { pet, notes } = tick(this.pet, Date.now(), config.timeScale);
      return { detail: notes.join(" · ") || "no time has passed (physics ok)", value: pet };
    });

    let action = job.action;
    if (human && !ticked!.alive && action !== "funeral") action = "funeral";
    if (human && ticked!.alive && ticked!.born == null && action !== "hatch") action = "hatch";

    const board = await this.stage(job, "vets", async () => {
      const { reviews, ai } = await boardReview(ticked!, action, human ? config.anthropicKey : undefined);
      return { detail: `${boardDecision(reviews)}${ai ? " (real AI)" : ""}`, value: reviews };
    });

    const { pet: next, result } = apply(ticked!, action, job.by);

    const block = await this.stage(job, "chain", async () => {
      const b = await mine(this.pet.chain.hash, this.pet.chain.height + 1, `${action}:${job.by}`, human ? 5 : 4);
      return { detail: `mined block #${b.height} in ${b.ms}ms, nonce ${b.nonce}, ${b.hash.slice(0, 12)}…`, value: b };
    });
    next.chain = { height: block!.height, hash: block!.hash };

    await this.stage(job, "quantum", async () => ({ detail: quantumMood() }));

    const coauthors: string[] = [];
    const logins = [...config.coauthors, ...(config.allowGuestCoauthor && job.github ? [job.github] : [])];
    for (const login of new Set(logins)) {
      try {
        coauthors.push(await this.forge.coauthorEmail(login));
      } catch {
        this.log(`co-author "${login}" isn't a real GitHub user, skipped`, "warn");
      }
    }

    const files = await this.stage(job, "render", async () => {
      const readme = renderReadme(next, this.mergedTotal + 1, config.timeScale);
      return {
        detail: `rendered ${readme.length} bytes of README`,
        value: [
          { path: STATE_PATH, content: JSON.stringify(next, null, 2) + "\n" },
          { path: "README.md", content: readme },
        ],
      };
    });

    const emoji: Record<ActionId, string> = { hatch: "🐣", feed: "🍙", snack: "🍬", play: "🎾", clean: "🛁", sleep: "💤", medicine: "💊", pet: "✋", funeral: "🪦" };
    const title = `${emoji[action]} ${action} ${ticked!.name} (gen ${ticked!.generation}, action #${next.actions})`;
    const reviewText = board!.map((r) => `- **${r.reviewer}** — \`${r.verdict}\`: ${r.comment}`).join("\n");
    const body = [
      `Requested by **${job.by}**${human ? "" : " (autopilot)"}.`,
      "",
      `> ${result}`,
      "",
      "### Veterinary Review Board",
      reviewText,
      "",
      `**Decision:** ${boardDecision(board!)}`,
      "",
      `**Proof-of-Pet:** block #${block!.height} \`${block!.hash}\` (nonce ${block!.nonce})`,
    ].join("\n");
    const message = [title, "", result, "", `Proof-of-Pet block #${block!.height}: ${block!.hash}`, ...(coauthors.length ? ["", ...coauthors.map((c) => `Co-authored-by: ${c}`)] : [])].join("\n");

    const pr = await this.stage(job, "git", async () => {
      const branch = `pet/g${ticked!.generation}-${action}-${Date.now().toString(36)}`;
      const merged = await this.forge.openAndMerge({ branch, files: files!, message, title, body });
      return { detail: `PR #${merged.number} opened & merged`, value: merged };
    });

    next.lastAction = { ...next.lastAction!, pr: pr!.number };
    this.pet = next;
    this.mergedTotal++;
    this.sessionMerged++;
    if (coauthors.length) this.sessionCoauthored++;
    const entry = { ...pr!, by: job.by, action, at: Date.now(), coauthors: coauthors.length };
    this.recent.unshift(entry);
    this.recent.length = Math.min(this.recent.length, 50);
    this.emit("merged", { ...entry, result });
  }
}
