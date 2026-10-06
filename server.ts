import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { config, resolveToken } from "./src/config";
import { Engine } from "./src/engine";
import { FakeForge, GitHub, type Forge } from "./src/github";
import { HUMAN_ACTIONS, type ActionId } from "./src/pet";

const clients = new Set<ReadableStreamDefaultController>();
const enc = new TextEncoder();

function emit(event: string, data: unknown) {
  const chunk = enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  for (const c of clients) {
    try {
      c.enqueue(chunk);
    } catch {
      clients.delete(c);
    }
  }
}

let forge: Forge;
if (config.dryRun) {
  forge = new FakeForge();
} else {
  const gh = new GitHub(await resolveToken(), config.owner, config.repo, config.base);
  gh.onWait = (sec, why) => emit("log", { at: Date.now(), level: "warn", msg: `${why} — cooling down ${sec}s` });
  forge = gh;
}

const engine = new Engine(forge, emit);
await engine.init();

const lanUrl = (() => {
  for (const list of Object.values(networkInterfaces()))
    for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) return `http://${i.address}:${config.port}`;
  return `http://localhost:${config.port}`;
})();

const PUBLIC = join(import.meta.dir, "public");
const json = (data: unknown, status = 200) => Response.json(data, { status });

Bun.serve({
  port: config.port,
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/state") return json({ ...engine.snapshot(), lanUrl });

    if (url.pathname === "/api/events") {
      let ctrl: ReadableStreamDefaultController;
      let ping: Timer;
      const stream = new ReadableStream({
        start(c) {
          ctrl = c;
          clients.add(c);
          c.enqueue(enc.encode(`retry: 2000\n\n`));
          ping = setInterval(() => {
            try {
              c.enqueue(enc.encode(`: ping\n\n`));
            } catch {
              clearInterval(ping);
            }
          }, 15000);
        },
        cancel() {
          clients.delete(ctrl);
          clearInterval(ping);
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    if (url.pathname === "/api/action" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { action?: string; by?: string; github?: string };
      const action = body.action as ActionId;
      if (!HUMAN_ACTIONS.includes(action)) return json({ error: "unknown action" }, 400);
      const by = (body.by ?? "").trim().slice(0, 24) || "anonymous guest";
      const github = body.github?.trim().replace(/^@/, "");
      if (github && !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(github)) return json({ error: "that's not a GitHub username" }, 400);
      try {
        return json({ job: engine.enqueue(action, by, github || undefined) });
      } catch (e) {
        return json({ error: (e as Error).message }, 429);
      }
    }

    if (url.pathname === "/api/nanny" && req.method === "POST") {
      const { on } = (await req.json().catch(() => ({}))) as { on?: boolean };
      engine.setNanny(!!on);
      return json({ nanny: engine.nanny });
    }

    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(PUBLIC, path.replace(/\.\.+/g, "")));
    if (await file.exists()) return new Response(file);
    return new Response("404 — this page has been eaten by the shark", { status: 404 });
  },
});

console.log(`🦈 Gitchi running → http://localhost:${config.port}  (LAN: ${lanUrl})`);
console.log(`   repo: ${config.owner}/${config.repo}  dryRun=${config.dryRun}  nanny=${config.nanny} every ${config.nannyIntervalSec}s`);
