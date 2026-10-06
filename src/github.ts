const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FileChange {
  path: string;
  content: string;
}

export interface MergedPR {
  number: number;
  url: string;
  title: string;
  sha: string;
}

export interface PRRequest {
  files: FileChange[];
  message: string;
  title: string;
  body: string;
}

export interface Forge {
  readFile(path: string): Promise<string | null>;
  mergedPRCount(): Promise<number>;
  coauthorEmail(login: string): Promise<string>;
  openAndMerge(req: PRRequest): Promise<MergedPR>;
}

export interface Repo {
  owner: string;
  repo: string;
}

export interface GitHubOptions {
  author: string;
  upstream: Repo;
  fork: Repo;
  base: string;
  writeBudgetPerHour: number;
  writeBudgetPerMinute: number;
}

// The fork reuses one branch for every contribution; it's force-moved to each new commit.
const FORK_BRANCH = "gitchi-contribution";
const HOUR = 3_600_000;
const MINUTE = 60_000;

export class GitHub implements Forge {
  onWait?: (sec: number, why: string) => void;
  private emailCache = new Map<string, string>();
  private writes: number[] = [];

  constructor(private token: string, private o: GitHubOptions) {}

  private path(r: Repo) {
    return `/repos/${r.owner}/${r.repo}`;
  }

  // Never exceed our own hourly budget of content-creating requests, so GitHub never has to stop us.
  private async throttleWrite() {
    for (;;) {
      const now = Date.now();
      this.writes = this.writes.filter((t) => now - t < HOUR);
      const lastMinute = this.writes.filter((t) => now - t < MINUTE);
      if (this.writes.length < this.o.writeBudgetPerHour && lastMinute.length < this.o.writeBudgetPerMinute) {
        this.writes.push(now);
        return;
      }
      const hourly = this.writes.length >= this.o.writeBudgetPerHour;
      const wait = Math.ceil(((hourly ? this.writes[0] + HOUR : lastMinute[0] + MINUTE) - now) / 1000);
      this.onWait?.(wait, hourly ? `hourly write budget (${this.o.writeBudgetPerHour}/h) used up` : `minute write budget (${this.o.writeBudgetPerMinute}/min) used up`);
      await sleep(wait * 1000 + 250);
    }
  }

  async req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      if (method !== "GET") await this.throttleWrite();
      const res = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "gitchi-tamagotchi",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) return (res.status === 204 ? null : await res.json()) as T;

      const text = await res.text();
      const retryAfter = Number(res.headers.get("retry-after"));
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const limited =
        res.status === 429 ||
        (res.status === 403 && (/rate limit|abuse/i.test(text) || remaining === "0"));

      if (limited && attempt < 8) {
        const wait =
          retryAfter > 0
            ? retryAfter
            : remaining === "0" && reset
              ? Math.max(1, reset - Date.now() / 1000)
              : 60 * 2 ** Math.min(attempt, 4);
        this.onWait?.(Math.ceil(wait), `GitHub said ${res.status}: slow down`);
        await sleep(wait * 1000 + 1000);
        continue;
      }
      if (res.status >= 500 && attempt < 4) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  async readFile(path: string): Promise<string | null> {
    try {
      const f = await this.req("GET", `${this.path(this.o.upstream)}/contents/${path}?ref=${this.o.base}`);
      return Buffer.from(f.content, "base64").toString("utf8");
    } catch (e) {
      if (String(e).includes("→ 404")) return null;
      throw e;
    }
  }

  async mergedPRCount(): Promise<number> {
    const q = encodeURIComponent(`author:${this.o.author} is:pr is:merged`);
    const res = await this.req("GET", `/search/issues?q=${q}&per_page=1`);
    return res.total_count;
  }

  async coauthorEmail(login: string): Promise<string> {
    const key = login.toLowerCase();
    const hit = this.emailCache.get(key);
    if (hit) return hit;
    const u = await this.req("GET", `/users/${encodeURIComponent(login)}`);
    const trailer = `${u.login} <${u.id}+${u.login}@users.noreply.github.com>`;
    this.emailCache.set(key, trailer);
    return trailer;
  }

  private async pointForkBranch(sha: string) {
    const fork = this.path(this.o.fork);
    try {
      await this.req("PATCH", `${fork}/git/refs/heads/${FORK_BRANCH}`, { sha, force: true });
    } catch (e) {
      if (!/→ (404|422)/.test(String(e))) throw e;
      await this.req("POST", `${fork}/git/refs`, { ref: `refs/heads/${FORK_BRANCH}`, sha });
    }
  }

  // Commit on the fork, PR into upstream, merge upstream. 5 content-creating requests.
  // Fork and upstream share one object store, so the fork can build on upstream's latest commit directly.
  async openAndMerge({ files, message, title, body }: PRRequest): Promise<MergedPR> {
    const up = this.path(this.o.upstream);
    const fork = this.path(this.o.fork);
    const ref = await this.req("GET", `${up}/git/ref/heads/${this.o.base}`);
    const baseSha: string = ref.object.sha;
    const baseCommit = await this.req("GET", `${up}/git/commits/${baseSha}`);
    const tree = await this.req("POST", `${fork}/git/trees`, {
      base_tree: baseCommit.tree.sha,
      tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
    });
    const commit = await this.req("POST", `${fork}/git/commits`, { message, tree: tree.sha, parents: [baseSha] });
    await this.pointForkBranch(commit.sha);
    const pr = await this.req("POST", `${up}/pulls`, {
      title,
      head: `${this.o.fork.owner}:${FORK_BRANCH}`,
      base: this.o.base,
      body,
      maintainer_can_modify: false,
    });

    for (let i = 0; ; i++) {
      try {
        const m = await this.req("PUT", `${up}/pulls/${pr.number}/merge`, {
          merge_method: "merge",
          commit_title: `Merge #${pr.number}: ${title}`,
        });
        return { number: pr.number, url: pr.html_url, title, sha: m.sha };
      } catch (e) {
        // Mergeability is computed async right after the PR opens.
        if (i < 5 && /→ (405|409)/.test(String(e))) {
          await sleep(2000 * (i + 1));
          continue;
        }
        throw e;
      }
    }
  }
}

// Offline forge for rehearsing the demo without touching GitHub.
export class FakeForge implements Forge {
  private n = 9000;
  private files = new Map<string, string>();

  async readFile(path: string) {
    return this.files.get(path) ?? null;
  }
  async mergedPRCount() {
    return 147;
  }
  async coauthorEmail(login: string) {
    return `${login} <0+${login}@users.noreply.github.com>`;
  }
  async openAndMerge(req: PRRequest): Promise<MergedPR> {
    await sleep(600 + Math.random() * 900);
    for (const f of req.files) this.files.set(f.path, f.content);
    const number = ++this.n;
    return { number, url: `https://example.invalid/pull/${number}`, title: req.title, sha: crypto.randomUUID().replaceAll("-", "") };
  }
}
