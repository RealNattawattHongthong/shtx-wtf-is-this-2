export type ActionId = "hatch" | "feed" | "snack" | "play" | "clean" | "sleep" | "medicine" | "pet" | "funeral";
export type Stage = "egg" | "baby" | "child" | "teen" | "adult" | "elder";
export type Mood = "happy" | "normal" | "sad" | "sick" | "sleeping" | "dead" | "egg";
export type Tier = "bronze" | "silver" | "gold";

export const HUMAN_ACTIONS: ActionId[] = ["feed", "snack", "play", "clean", "sleep", "medicine", "pet"];

export interface Grave {
  name: string;
  generation: number;
  born: number;
  diedAt: number;
  cause: string;
  actions: number;
}

export interface Pet {
  name: string;
  generation: number;
  born: number | null; // null while still an egg
  lastTick: number;
  hunger: number; // 100 = full
  happiness: number;
  hygiene: number;
  energy: number;
  health: number;
  asleep: boolean;
  sick: boolean;
  poops: number;
  alive: boolean;
  diedAt?: number;
  causeOfDeath?: string;
  actions: number;
  lastAction?: { id: ActionId; by: string; at: number; pr?: number };
  chain: { height: number; hash: string };
  graveyard: Grave[];
}

const NAMES = ["Gitchi", "Mergetaro", "Rebasey", "Commitchan", "Pushin P", "Sharkdown", "Forky", "Lint Lizard", "Cherry Pick"];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
const HOUR = 3_600_000;

export function newEgg(generation: number, graveyard: Grave[] = [], chain = { height: 0, hash: "0".repeat(64) }): Pet {
  const now = Date.now();
  return {
    name: NAMES[(generation - 1) % NAMES.length],
    generation,
    born: null,
    lastTick: now,
    hunger: 80,
    happiness: 80,
    hygiene: 100,
    energy: 100,
    health: 100,
    asleep: false,
    sick: false,
    poops: 0,
    alive: true,
    actions: 0,
    chain,
    graveyard,
  };
}

export function ageHours(p: Pet, now = Date.now(), timeScale = 1) {
  if (p.born == null) return 0;
  return (((p.diedAt ?? now) - p.born) / HOUR) * timeScale;
}

export function stageOf(p: Pet, now = Date.now(), timeScale = 1): Stage {
  if (p.born == null) return "egg";
  const h = ageHours(p, now, timeScale);
  if (h < 1) return "baby";
  if (h < 6) return "child";
  if (h < 24) return "teen";
  if (h < 96) return "adult";
  return "elder";
}

export function tierOf(mergedTotal: number): Tier {
  return mergedTotal >= 1024 ? "gold" : mergedTotal >= 128 ? "silver" : "bronze";
}

export function moodOf(p: Pet): Mood {
  if (!p.alive) return "dead";
  if (p.born == null) return "egg";
  if (p.asleep) return "sleeping";
  if (p.sick) return "sick";
  if (Math.min(p.hunger, p.happiness, p.hygiene) < 30) return "sad";
  if ((p.hunger + p.happiness + p.hygiene + p.energy) / 4 > 70) return "happy";
  return "normal";
}

// Biology. Returns a fresh pet advanced to `now`, plus a human-readable diary of what decayed.
export function tick(prev: Pet, now = Date.now(), timeScale = 1): { pet: Pet; notes: string[] } {
  const p: Pet = structuredClone(prev);
  const notes: string[] = [];
  if (!p.alive || p.born == null) {
    p.lastTick = now;
    return { pet: p, notes };
  }
  const h = ((now - p.lastTick) / HOUR) * timeScale;
  p.lastTick = now;
  if (h <= 0) return { pet: p, notes };

  p.hunger = clamp(p.hunger - 12 * h);
  p.happiness = clamp(p.happiness - 8 * h);
  p.hygiene = clamp(p.hygiene - (6 + 6 * p.poops) * h);
  p.energy = clamp(p.asleep ? p.energy + 25 * h : p.energy - 5 * h);

  const starving = [p.hunger, p.happiness, p.hygiene, p.energy].filter((s) => s <= 0).length;
  p.health = clamp(starving ? p.health - 15 * starving * h : p.health + 3 * h);
  if (!p.sick && (p.health < 40 || p.poops >= 3)) {
    p.sick = true;
    notes.push(`${p.name} caught a cold (health ${p.health})`);
  }
  if (p.sick) p.health = clamp(p.health - 4 * h);

  if (h > 0.01) notes.push(`${(h * 60).toFixed(1)} bio-minutes elapsed`);

  if (p.health <= 0) {
    p.alive = false;
    p.diedAt = now;
    p.causeOfDeath = p.hunger <= 0 ? "starvation" : p.hygiene <= 0 ? "dysentery (too many poops)" : p.happiness <= 0 ? "loneliness" : "unspecified sadness";
    notes.push(`💀 ${p.name} died of ${p.causeOfDeath}`);
  } else if (ageHours(p, now, timeScale) > 24 * 7) {
    p.alive = false;
    p.diedAt = now;
    p.causeOfDeath = "old age, surrounded by pull requests";
    notes.push(`🕊️ ${p.name} passed away peacefully`);
  }
  return { pet: p, notes };
}

export function apply(prev: Pet, action: ActionId, by: string, now = Date.now()): { pet: Pet; result: string } {
  const p: Pet = structuredClone(prev);
  p.actions++;
  p.lastAction = { id: action, by, at: now };

  if (action === "funeral") {
    const grave: Grave = {
      name: p.name,
      generation: p.generation,
      born: p.born ?? now,
      diedAt: p.diedAt ?? now,
      cause: p.causeOfDeath ?? "mysterious circumstances",
      actions: p.actions,
    };
    const next = newEgg(p.generation + 1, [grave, ...p.graveyard].slice(0, 20), p.chain);
    next.lastAction = { id: action, by, at: now };
    return { pet: next, result: `Laid ${p.name} to rest. A new egg appeared 🥚` };
  }
  if (!p.alive) return { pet: p, result: `${p.name} is dead. It needs a funeral, not ${action}.` };

  if (action === "hatch") {
    if (p.born != null) return { pet: p, result: `${p.name} already hatched.` };
    p.born = now;
    p.lastTick = now;
    return { pet: p, result: `🐣 ${p.name} hatched! Generation ${p.generation}.` };
  }
  if (p.born == null) return { pet: p, result: `It's still an egg. It needs to hatch first.` };

  let grumpy = "";
  if (p.asleep && action !== "sleep" && action !== "pet") {
    p.asleep = false;
    p.happiness = clamp(p.happiness - 10);
    grumpy = " (woken up, grumpy)";
  }

  switch (action) {
    case "feed": {
      p.hunger = clamp(p.hunger + 30);
      const pooped = Math.random() < 0.35;
      if (pooped) p.poops++;
      return { pet: p, result: `Ate a rice ball${pooped ? " and pooped 💩" : ""}${grumpy}` };
    }
    case "snack":
      p.hunger = clamp(p.hunger + 10);
      p.happiness = clamp(p.happiness + 15);
      p.health = clamp(p.health - 2);
      return { pet: p, result: `Ate a candy. Happy but slightly less healthy${grumpy}` };
    case "play":
      p.happiness = clamp(p.happiness + 25);
      p.energy = clamp(p.energy - 15);
      p.hunger = clamp(p.hunger - 5);
      return { pet: p, result: `Played fetch with a merge conflict${grumpy}` };
    case "clean": {
      const n = p.poops;
      p.hygiene = 100;
      p.poops = 0;
      return { pet: p, result: `Bath time. Removed ${n} poop${n === 1 ? "" : "s"}${grumpy}` };
    }
    case "sleep":
      p.asleep = !p.asleep;
      return { pet: p, result: p.asleep ? "Lights off 💤" : "Good morning ☀️" };
    case "medicine":
      if (!p.sick) {
        p.happiness = clamp(p.happiness - 10);
        return { pet: p, result: `Took medicine while healthy. Hated it${grumpy}` };
      }
      p.sick = false;
      p.health = clamp(p.health + 30);
      return { pet: p, result: `Cured! 💊${grumpy}` };
    case "pet":
      p.happiness = clamp(p.happiness + 8);
      return { pet: p, result: p.asleep ? "Headpat. It smiled in its sleep" : "Headpat. It wiggled happily" };
  }
  return { pet: p, result: "???" };
}

// What the autopilot nanny does when nobody is pressing buttons.
export function nannyChoice(p: Pet, n: number): ActionId {
  if (!p.alive) return "funeral";
  if (p.born == null) return "hatch";
  if (p.sick) return "medicine";
  if (p.poops > 0 || p.hygiene < 40) return "clean";
  if (p.asleep) return p.energy > 90 ? "sleep" : "pet";
  if (p.hunger < 55) return "feed";
  if (p.energy < 25) return "sleep";
  if (p.happiness < 60) return "play";
  return (["pet", "play", "snack", "pet"] as ActionId[])[n % 4];
}

// ─── Sprites ────────────────────────────────────────────────────────────────

const FACE: Record<Mood, [string, string]> = {
  happy: ["^", "w"],
  normal: ["o", "-"],
  sad: ["T", "n"],
  sick: ["@", "~"],
  sleeping: ["-", "o"],
  dead: ["x", "_"],
  egg: [" ", " "],
};

const BODY: Record<"baby" | "young" | "adult", string[]> = {
  baby: [
    "              ",
    "     __/\\__   ",
    "  ><( E  E )  ",
    "     \\_M__/   ",
    "              ",
  ],
  young: [
    "        /\\      ",
    "   ____/  \\___  ",
    "  / E   E     \\/|",
    "  \\_____M_____/\\|",
    "      \\/  \\/    ",
  ],
  adult: [
    "           /|        ",
    "      ____/ |_____   ",
    "    /  E    E      \\_/|",
    "   <    ___M___    _  |",
    "    \\_____________/ \\_|",
    "        \\/    \\/      ",
  ],
};

const EGG = [
  "     ____     ",
  "   /  . .\\    ",
  "  |  .  . |   ",
  "  | .  .  |   ",
  "   \\______/   ",
];

const GHOST = [
  "     .--.     ",
  "    ( x x)    ",
  "    |  _ |  ~ ",
  "    |    | ~  ",
  "    '~~~~'    ",
];

const CROWN: Record<Tier, string> = { bronze: "", silver: "  ✦ silver ✦", gold: "  \\^^^^/ GOLDEN PULL SHARK" };

export function sprite(p: Pet, tier: Tier, now = Date.now(), timeScale = 1): string {
  const mood = moodOf(p);
  const stage = stageOf(p, now, timeScale);
  let lines: string[];
  if (mood === "dead") lines = GHOST;
  else if (stage === "egg") lines = EGG;
  else {
    const body = stage === "baby" ? BODY.baby : stage === "adult" || stage === "elder" ? BODY.adult : BODY.young;
    const [e, m] = FACE[mood];
    lines = body.map((l) => l.replaceAll("E", e).replace("M", m));
  }
  const extras: string[] = [];
  if (tier !== "bronze" && mood !== "dead" && stage !== "egg") extras.push(CROWN[tier]);
  const out = [...extras, ...lines];
  if (mood === "sleeping") out.push("                 z Z z");
  if (stage === "elder" && mood !== "dead") out.push("   (has a tiny beard)");
  if (p.poops > 0 && mood !== "dead") out.push("  " + "💩 ".repeat(Math.min(p.poops, 5)));
  return out.join("\n");
}
