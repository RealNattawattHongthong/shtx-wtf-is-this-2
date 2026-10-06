# 🦈 Gitchi — How it works

A Tamagotchi whose only source of truth is a git repository.
Every interaction is a pull request. The README is the pet's face.

```
 button press
   → ⚖️  Load Balancer          (nginx in a trench coat)
   → 🔐 Auth Gateway           (a real Brainfuck interpreter must print "OK")
   → 📨 Event Bus              (Kafka, i.e. Array.prototype.push)
   → 🧬 Biological Clock       (hunger/hygiene decay since the last PR)
   → 👔 Veterinary Review Board (Clippy, Bonzi Buddy & Merlin vote; Claude if ANTHROPIC_API_KEY is set)
   → ⛓️  Proof-of-Pet Blockchain (real SHA-256 proof-of-work per action)
   → ⚛️  Quantum Mood Engine    (Math.random() in a lab coat)
   → 📝 README Renderer
   → 🔀 GitOps Controller      (git tree → commit → branch → PR → merge, for real)
   → pet/state.json + README.md updated on main
```

An autopilot **nanny** keeps the pet alive when nobody is around, opening one PR
every `NANNY_INTERVAL_SEC` seconds. The pet evolves bronze → silver → **Golden Pull Shark**
as the owner's merged-PR count reaches 16 / 128 / 1024.

## Run

```sh
bun install
bun run demo          # offline rehearsal: fake GitHub, fast biology
bun start             # LIVE: commits on GH_FORK, PRs into GH_UPSTREAM, using `gh auth token`
```

| env | default | |
|---|---|---|
| `GH_UPSTREAM` | nattawatt-com-org/shtx-wtf-is-this-2 | repo the PRs are merged into |
| `GH_FORK` | RealNattawattHongthong/shtx-wtf-is-this-2 | fork the commits are pushed to |
| `GH_AUTHOR` | RealNattawattHongthong | whose merged PRs are counted |
| `NANNY` | `1` | `0` disables autopilot |
| `NANNY_INTERVAL_SEC` | `150` | one PR = 5 writes |
| `WRITE_BUDGET_PER_HOUR` / `_PER_MINUTE` | `300` / `30` | self-imposed caps, well under GitHub's 500/h and 80/min |
| `COAUTHORS` | – | comma-separated **real** GitHub usernames to add as `Co-authored-by` |
| `GUEST_COAUTHOR` | `1` | visitors may enter their own GitHub username to be credited |
| `ANTHROPIC_API_KEY` | – | real AI vet board for human actions |
| `TIME_SCALE` | `1` | speed up biology |
| `DRY_RUN` | – | `1` = no GitHub calls |

⚠️ Bulk automated PRs can be treated as inauthentic activity by GitHub. Use at your own risk.
