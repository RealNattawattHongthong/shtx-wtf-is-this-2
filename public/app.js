const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let state = null;
const ICON = { lb: "⚖️", auth: "🔐", bus: "📨", bio: "🧬", vets: "👔", chain: "⛓️", quantum: "⚛️", render: "📝", git: "🔀" };
const STATS = [
  ["hunger", "🍙 Hunger"],
  ["happiness", "💖 Happy"],
  ["hygiene", "🛁 Hygiene"],
  ["energy", "⚡ Energy"],
  ["health", "❤️ Health"],
];

// ── identity (per-viewer convenience) ──
const store = {
  get: (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
$("#by").value = store.get("by");
$("#gh").value = store.get("gh");
$("#by").addEventListener("change", (e) => store.set("by", e.target.value));
$("#gh").addEventListener("change", (e) => store.set("gh", e.target.value));

// ── rendering ──
function renderPet(s) {
  const p = s.pet;
  $("#pet-name").textContent = p.name;
  $("#pet-gen").textContent = `G${p.generation}`;
  $("#sprite").textContent = s.sprite;
  $("#pet-status").textContent = `${s.mood} · ${s.stage}`;
  $("#stats").innerHTML = STATS.map(
    ([k, label]) =>
      `<span>${label}</span><div class="bar ${p[k] < 30 ? "low" : ""}"><i style="width:${p[k]}%"></i></div><span>${Math.round(p[k])}</span>`,
  ).join("");
  $("#grave-count").textContent = p.graveyard.length;
}

function renderProgress(s) {
  const pct = Math.min(100, (s.mergedTotal / s.target) * 100);
  $("#shark-bar").style.width = pct + "%";
  $("#merged-total").textContent = s.mergedTotal;
  $("#session-merged").textContent = s.sessionMerged;
  $("#session-co").textContent = s.sessionCoauthored;
  for (const el of document.querySelectorAll(".tier")) {
    const need = { bronze: 16, silver: 128, gold: 1024 }[el.dataset.t];
    el.classList.toggle("got", s.mergedTotal >= need);
  }
  const left = Math.max(0, s.target - s.mergedTotal);
  const hours = (left * s.nannyIntervalSec) / 3600;
  $("#eta").textContent = left ? `${left} to go · ETA at autopilot pace ≈ ${hours.toFixed(1)} h` : "🥇 GOLDEN PULL SHARK ACHIEVED";
  $("#tray-shark").textContent = { bronze: "🦈", silver: "🦈✦", gold: "🦈👑" }[s.tier];
}

function renderMesh(stages) {
  $("#mesh").innerHTML = stages
    .map(
      (st) => `<li id="st-${st.id}"><div class="bubble">${ICON[st.id] ?? "•"}</div>
      <div class="svc"><b>${esc(st.name)}</b> <em>${esc(st.tech)}</em><span class="ms"></span><div class="detail"></div></div></li>`,
    )
    .join("");
}

function resetMesh() {
  for (const li of document.querySelectorAll(".mesh li")) {
    li.className = "";
    li.querySelector(".detail").textContent = "";
    li.querySelector(".ms").textContent = "";
  }
}

function feedItem(m, fresh) {
  const li = document.createElement("li");
  if (fresh) li.className = "fresh";
  const when = new Date(m.at).toLocaleTimeString();
  li.innerHTML = `<a href="${esc(m.url)}" target="_blank">#${m.number}</a> ${esc(m.title)}
    <div class="by">${esc(m.by)} · ${when} ${m.coauthors ? `<span class="co">👯 co-authored</span>` : ""}</div>`;
  return li;
}

function renderFeed(list) {
  const ul = $("#feed");
  ul.replaceChildren(...list.map((m) => feedItem(m, false)));
}

function log(msg, level = "info") {
  const li = document.createElement("li");
  li.className = level;
  li.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
  const ul = $("#log");
  ul.prepend(li);
  while (ul.children.length > 80) ul.lastChild.remove();
}

function renderAll(s) {
  state = s;
  renderPet(s);
  renderProgress(s);
  $("#queue-len").textContent = s.queue.length;
  $("#nanny").checked = s.nanny;
  $("#sb-repo").textContent = `📁 ${s.repo}`;
  $("#sb-mode").textContent = s.dryRun ? "⚠️ DRY RUN (no real PRs)" : "🟢 LIVE on github.com";
  $("#repo-link").href = `https://github.com/${s.repo}/pulls?q=is%3Apr+is%3Amerged`;
  $("#gh-row").hidden = $("#gh-hint").hidden = !s.guestCoauthor;
  if (!s.current) $("#job-label").textContent = "idle";
}

// ── balloon, bsod, sound ──
let balloonTimer;
function balloon(title, html) {
  $("#balloon-title").textContent = title;
  $("#balloon-text").innerHTML = html;
  $("#balloon").hidden = false;
  clearTimeout(balloonTimer);
  balloonTimer = setTimeout(() => ($("#balloon").hidden = true), 5000);
}

function bsod(msg) {
  $("#bsod-msg").textContent = msg;
  $("#bsod").hidden = false;
  setTimeout(() => ($("#bsod").hidden = true), 6000);
}
$("#bsod").addEventListener("click", () => ($("#bsod").hidden = true));
document.addEventListener("keydown", () => ($("#bsod").hidden = true));

let audio;
function chime() {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.4);
      o.connect(g).connect(audio.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.45);
    });
  } catch {}
}

// ── actions ──
document.querySelectorAll("#actions button").forEach((b) =>
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: b.dataset.a, by: $("#by").value, github: $("#gh").value }),
      });
      const data = await res.json();
      if (!res.ok) balloon("⚠️ Request denied", esc(data.error));
      else log(`queued ${b.dataset.a} (job ${data.job.id})`);
    } finally {
      setTimeout(() => (b.disabled = false), 800);
    }
  }),
);

$("#nanny").addEventListener("change", (e) =>
  fetch("/api/nanny", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: e.target.checked }) }),
);

// ── live stream ──
function connect() {
  const es = new EventSource("/api/events");
  es.onopen = () => {
    $("#sb-conn").textContent = "● connected";
    $("#sb-conn").className = "on";
  };
  es.onerror = () => {
    $("#sb-conn").textContent = "● reconnecting";
    $("#sb-conn").className = "";
  };
  es.addEventListener("state", (e) => renderAll(JSON.parse(e.data)));
  es.addEventListener("queue", (e) => ($("#queue-len").textContent = JSON.parse(e.data).length));
  es.addEventListener("nanny", (e) => ($("#nanny").checked = JSON.parse(e.data).nanny));
  es.addEventListener("log", (e) => {
    const d = JSON.parse(e.data);
    log(d.msg, d.level);
  });
  es.addEventListener("job", (e) => {
    const j = JSON.parse(e.data);
    resetMesh();
    $("#job-label").textContent = `→ ${j.action} by ${j.by}`;
  });
  es.addEventListener("stage", (e) => {
    const s = JSON.parse(e.data);
    const li = document.getElementById(`st-${s.stage}`);
    if (!li) return;
    li.className = s.status;
    if (s.detail) li.querySelector(".detail").textContent = s.detail;
    if (s.ms != null) li.querySelector(".ms").textContent = `${s.ms}ms`;
  });
  es.addEventListener("merged", (e) => {
    const m = JSON.parse(e.data);
    $("#feed").prepend(feedItem(m, true));
    $("#sprite").classList.remove("bounce");
    void $("#sprite").offsetWidth;
    $("#sprite").classList.add("bounce");
    if (!m.by.startsWith("🤖")) {
      chime();
      balloon(`PR #${m.number} merged`, `${esc(m.result)}<br><a href="${esc(m.url)}" target="_blank">view on GitHub</a>`);
    }
  });
  es.addEventListener("bsod", (e) => bsod(JSON.parse(e.data).message));
}

// ── boot ──
const clock = () => ($("#clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
setInterval(clock, 10000);
clock();

setInterval(() => {
  if (!state || !state.nanny || state.current) return ($("#nanny-next").textContent = "");
  const s = Math.max(0, Math.round((state.nextNannyAt - Date.now()) / 1000));
  $("#nanny-next").textContent = `next autopilot PR in ${s}s`;
}, 1000);

(async () => {
  const s = await (await fetch("/api/state")).json();
  renderMesh(s.stages);
  renderAll(s);
  renderFeed(s.recent);
  $("#lan").textContent = s.lanUrl;
  const drawQR = () => (window.QRCode ? new QRCode($("#qr"), { text: s.lanUrl, width: 256, height: 256 }) : setTimeout(drawQR, 300));
  drawQR();
  connect();
  // Biology keeps ticking between PRs.
  setInterval(async () => renderAll(await (await fetch("/api/state")).json()), 20000);
})();
