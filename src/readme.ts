import { ageHours, moodOf, sprite, stageOf, tierOf, type Pet } from "./pet";

const bar = (v: number, w = 20) => "█".repeat(Math.round((v / 100) * w)).padEnd(w, "░");

function fmtAge(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

export function renderReadme(p: Pet, mergedTotal: number, timeScale: number, now = Date.now()): string {
  const tier = tierOf(mergedTotal);
  const pct = Math.min(100, (mergedTotal / 1024) * 100);
  const last = p.lastAction;
  const graves = p.graveyard.length
    ? p.graveyard
        .map((g) => `| ${g.generation} | ${g.name} | ${g.cause} | ${g.actions} | ${new Date(g.diedAt).toISOString().slice(0, 16).replace("T", " ")} |`)
        .join("\n")
    : "| – | nobody yet | – | – | – |";

  return `# 🦈 ${p.name} — the Pull Shark Tamagotchi

> **This README is alive.** Every time someone feeds, cleans or plays with ${p.name},
> a pull request is opened, reviewed by an AI veterinary board, notarized on a
> proof-of-work blockchain, and merged — which rewrites this file.
> Built for [Stupid Hackathon X](https://stupid.hackathon.in.th/x/). ห้ามสร้างสิ่งที่มีประโยชน์.

\`\`\`text
${sprite(p, tier, now, timeScale)}
\`\`\`

| | |
|---|---|
| **Status** | ${moodOf(p)} · ${stageOf(p, now, timeScale)} · generation ${p.generation} |
| **Age** | ${fmtAge(ageHours(p, now, timeScale))} |
| 🍙 Hunger | \`${bar(p.hunger)}\` ${p.hunger} |
| 💖 Happiness | \`${bar(p.happiness)}\` ${p.happiness} |
| 🛁 Hygiene | \`${bar(p.hygiene)}\` ${p.hygiene} |
| ⚡ Energy | \`${bar(p.energy)}\` ${p.energy} |
| ❤️ Health | \`${bar(p.health)}\` ${p.health} |
| **Last action** | ${last ? `${last.id} by ${last.by}` : "–"} |
| **Blockchain** | height ${p.chain.height} · \`${p.chain.hash.slice(0, 16)}…\` |

## 🦈 Evolution toward the Golden Pull Shark

\`${bar(pct, 32)}\` **${mergedTotal} / 1024** merged PRs · current form: **${tier}**

## 🪦 Graveyard

| Gen | Name | Cause of death | Actions | Died (UTC) |
|---|---|---|---|---|
${graves}

---
How it works: [docs/HOW.md](docs/HOW.md)
`;
}
