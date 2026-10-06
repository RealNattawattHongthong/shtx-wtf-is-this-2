// The "microservices". Some are real, some are a trench coat full of functions.
import type { ActionId, Pet } from "./pet";

// ─── Auth Gateway (Brainfuck) ───────────────────────────────────────────────

export function compileToBrainfuck(text: string): string {
  let code = "";
  for (const ch of text) code += "+".repeat(ch.charCodeAt(0)) + ".[-]";
  return code;
}

export function runBrainfuck(code: string, maxSteps = 1_000_000): string {
  const tape = new Uint8Array(30000);
  const jump = new Map<number, number>();
  const stack: number[] = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "[") stack.push(i);
    else if (code[i] === "]") {
      const j = stack.pop()!;
      jump.set(i, j);
      jump.set(j, i);
    }
  }
  let ptr = 0;
  let out = "";
  for (let pc = 0, steps = 0; pc < code.length && steps < maxSteps; pc++, steps++) {
    switch (code[pc]) {
      case "+": tape[ptr]++; break;
      case "-": tape[ptr]--; break;
      case ">": ptr++; break;
      case "<": ptr--; break;
      case ".": out += String.fromCharCode(tape[ptr]); break;
      case "[": if (!tape[ptr]) pc = jump.get(pc)!; break;
      case "]": if (tape[ptr]) pc = jump.get(pc)!; break;
    }
  }
  return out;
}

// ─── Proof-of-Pet Blockchain ────────────────────────────────────────────────

export async function mine(prevHash: string, height: number, data: string, difficulty: number) {
  const prefix = "0".repeat(difficulty);
  const started = performance.now();
  for (let nonce = 0; ; nonce++) {
    const hash = new Bun.CryptoHasher("sha256").update(`${prevHash}|${height}|${data}|${nonce}`).digest("hex");
    if (hash.startsWith(prefix)) return { hash, nonce, height, ms: Math.round(performance.now() - started) };
    // Yield so the SSE stream keeps flowing while we burn CPU for no reason.
    if (nonce % 20000 === 0) await new Promise((r) => setImmediate(r));
  }
}

// ─── Veterinary Review Board ────────────────────────────────────────────────

export interface Review {
  reviewer: string;
  verdict: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comment: string;
}

const BOARD = ["📎 Clippy, DVM", "🦍 Bonzi Buddy, MBA", "🧙 Merlin, Esq."];

const CANNED: Record<string, string[]> = {
  APPROVE: [
    "It looks like you're trying to care for a pet. LGTM.",
    "Approved. Have you considered also downloading free smileys?",
    "Ship it. The pet's KPIs are trending up and to the right.",
    "I have reviewed the diff with my crystal ball. It is good.",
    "Wiggle detected. Approving.",
  ],
  REQUEST_CHANGES: [
    "Please add unit tests for the rice ball.",
    "This violates section 4.2 of the Pet Compliance Framework.",
    "Nit: the poop should be centered.",
  ],
  COMMENT: [
    "No strong opinion. I'm a wizard, not a vet.",
    "Have you tried turning the pet off and on again?",
  ],
};

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function cannedReviews(): Review[] {
  return BOARD.map((reviewer) => {
    const r = Math.random();
    const verdict = r < 0.7 ? "APPROVE" : r < 0.88 ? "REQUEST_CHANGES" : "COMMENT";
    return { reviewer, verdict, comment: pick(CANNED[verdict]) };
  });
}

export async function boardReview(pet: Pet, action: ActionId, apiKey?: string): Promise<{ reviews: Review[]; ai: boolean }> {
  if (!apiKey) return { reviews: cannedReviews(), ai: false };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content:
              `You are a silly veterinary code-review board of three retired Microsoft Office assistants: ${BOARD.join(", ")}. ` +
              `A pull request wants to perform the action "${action}" on a Tamagotchi shark named ${pet.name} ` +
              `(hunger ${pet.hunger}, happiness ${pet.happiness}, hygiene ${pet.hygiene}, energy ${pet.energy}, health ${pet.health}, sick=${pet.sick}, asleep=${pet.asleep}, poops=${pet.poops}). ` +
              `Each reviewer gives a verdict (APPROVE, REQUEST_CHANGES or COMMENT) and a one-sentence funny, in-character comment under 20 words, in the style of early-2000s software. ` +
              `Reply with only JSON: [{"reviewer":"...","verdict":"...","comment":"..."}]`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data: any = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    const reviews: Review[] = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    if (!Array.isArray(reviews) || reviews.length === 0) throw new Error("empty");
    return { reviews: reviews.slice(0, 3), ai: true };
  } catch {
    return { reviews: cannedReviews(), ai: false };
  }
}

export function boardDecision(reviews: Review[]): string {
  const yes = reviews.filter((r) => r.verdict === "APPROVE").length;
  const no = reviews.filter((r) => r.verdict === "REQUEST_CHANGES").length;
  if (yes > no) return `Approved ${yes}–${no}`;
  return `Rejected ${yes}–${no}, overruled by 🐕 Rover the Search Dog (tie-breaker, owns 51% of shares)`;
}

// ─── Quantum Mood Engine ────────────────────────────────────────────────────

export function quantumMood(): string {
  const qubits = Array.from({ length: 8 }, () => (Math.random() < 0.5 ? "0" : "1")).join("");
  return `collapsed |ψ⟩ → |${qubits}⟩ (Math.random() wearing a lab coat)`;
}
