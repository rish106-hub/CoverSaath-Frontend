"use strict";
/* Prototype core: helpers, feedback primitives, shell, router, canvas chrome. All data is invented. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rs = (n) => "Rs " + Math.round(n).toLocaleString("en-IN");
const TICK = '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
let RUN = 0;

/* feedback primitives: every press, wait, success and failure goes through these */
function busy(b, label) { b.disabled = true; if (!b.dataset.was) b.dataset.was = b.innerHTML; b.innerHTML = '<span class="spin" hidden></span>' + label;
  const s = b.firstChild; setTimeout(() => { if (b.disabled && s.isConnected) s.hidden = false; }, 250); }
function done(b, label) { b.disabled = true; b.innerHTML = TICK + label; }
function idle(b, label) { b.disabled = false; b.innerHTML = label || b.dataset.was || b.innerHTML; }
function say(el, html, kind) { if (!el) return;
  el.innerHTML = kind === "err" ? '<p class="err" role="alert">' + html + "</p>" : kind === "ok" ? '<p class="ok">' + TICK + "<span>" + html + "</span></p>" : html; }
function roll(el, to, ms, fmt) { ms = ms || 420; fmt = fmt || rs; const from = +el.dataset.v || 0; el.dataset.v = to;
  if (reduce()) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), me = (el._r = (el._r || 0) + 1);
  const f = (t) => { if (el._r !== me) return; const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(f); };
  el.textContent = fmt(from); requestAnimationFrame(f); }
async function stream(el, text, me, ms) { if (reduce()) { el.textContent = text; return true; }
  el.setAttribute("aria-busy", "true");
  for (const w of text.split(" ")) { if (me !== RUN) return false; el.textContent += (el.textContent ? " " : "") + w; await wait(ms || 34); }
  el.removeAttribute("aria-busy"); return true; }
const SK = (rows) => '<div class="stack l" aria-label="Loading"><span class="sk" style="width:46%;height:44px"></span>' +
  '<div class="cols3">' + '<span class="sk" style="width:70%;height:34px"></span>'.repeat(3) + "</div>" +
  '<div class="stack">' + Array.from({ length: rows || 4 }, (_, i) => '<span class="sk" style="width:' + (92 - i * 9) + '%;height:20px"></span>').join("") + "</div></div>";

/* one invented household, used on every screen */
const HH = { first: "Aarav", name: "Aarav Menon", email: "aarav@menon.example",
  people: [["Aarav Menon", "You", 29, "Both policies", 1500000], ["Latha Menon", "Mother", 58, "TeamCare Group", 500000], ["Suresh Menon", "Father", 61, "TeamCare Group", 500000]], work: "Quantro Labs", city: "Bengaluru" };
const P = [
  { id: "p1", plan: "Shield One", ins: "Sahyadri General Insurance", si: 1000000, from: "15 Mar 2026", to: "14 Mar 2027", prem: 24860, no: "SGI ···· 4471", who: "Aarav", copay: 0, kind: "Personal" },
  { id: "p2", plan: "TeamCare Group", ins: "Northlight Health Insurance", si: 500000, from: "3 Aug 2026", to: "2 Aug 2027", prem: 38400, no: "NLH ···· 0926", who: "Aarav, Latha, Suresh", copay: 10, kind: "From Quantro Labs" } ];
const ASK = { q: "" };

/* screens register themselves */
const SC = {}; const ORDER = [];
function reg(id, def) { def.id = id; if (!SC[id]) ORDER.push(id); SC[id] = def; }

const NAV = [["home", "Home"], ["policies", "My policies"], ["chat", "Ask"], ["family", "Family"], ["money", "Money"]];
const SUB = { policies: [["policies", "All policies"], ["compare", "Compare"], ["stress", "Stress test"], ["hospitals", "Hospitals"]], family: [["family", "People"], ["memory", "Cover memory"]], money: [["money", "Premiums"], ["tools", "Calculators"]] };

let dev, shellOn = false;
function buildShell() {
  dev.innerHTML = '<div class="app"><nav class="side" aria-label="Knowvia"><a class="brand" data-go="home"><i></i>Knowvia</a>' +
    '<button class="btn addp" type="button" data-go="pay">Add a policy</button>' +
    NAV.map(([id, l]) => '<a class="nav" data-go="' + id + '" data-nav="' + id + '">' + l + "</a>").join("") +
    '<div class="foot"><a class="nav sos" data-go="emergency" data-nav="emergency">Emergency</a><a class="nav" data-go="settings" data-nav="settings">Settings</a><a class="nav" data-go="profile" data-nav="profile">' + HH.name + "</a></div></nav>" +
    '<div class="main"><header class="top"><div class="crumb"></div><span class="sp"></span>' +
    '<button class="kbtn" type="button" data-pal>Search or jump to <kbd>⌘K</kbd></button><a class="me" data-go="profile" aria-label="Your profile">A</a></header>' +
    '<div class="scroll"><div class="page"></div></div>' +
    '<form class="dock"><label class="field" style="flex:1"><input type="text" name="q" placeholder="Ask about your cover" autocomplete="off" aria-label="Ask about your cover"></label><button class="btn" type="submit">Ask</button></form></div></div>';
  shellOn = true;
  $(".dock", dev).addEventListener("submit", (e) => { e.preventDefault(); const i = e.target.q, q = i.value.trim(); if (!q) { i.classList.add("bad"); setTimeout(() => i.classList.remove("bad"), 500); i.focus(); return; }
    ASK.q = q; i.value = ""; if (curId() === "chat" && SC.chat.ask) SC.chat.ask(q); else go("chat", "ask"); });
}
const curId = () => (location.hash.slice(1) || "home").split("/")[0];
function go(id, st) { const h = "#" + id + (st ? "/" + st : ""); if (location.hash === h) show(); else location.hash = h; }

function show() {
  const parts = (location.hash.slice(1) || "home").split("/"); const s = SC[parts[0]] || SC.home;
  const st = parts[1] || (s.states ? s.states[0][0] : ""); const me = ++RUN;
  const fc = typeof s.focus === "function" ? s.focus(st) : s.focus;
  if (fc != null) { shellOn = false; const ST = ["Find your policy", "Reading it", "Your people", "Your cover"];
    dev.innerHTML = '<div class="focus"><header><a class="brand" data-go="home"><i></i>Knowvia</a><ol class="stepper">' + ST.map((t, i) => '<li class="' + (i < fc ? "did" : i === fc ? "on" : "") + '"><span class="n">' + (i < fc ? TICK : i + 1) + "</span>" + t + "</li>").join("") + '</ol><a data-go="home" class="b">Save and exit</a></header><div class="scroll"><div class="page"></div></div></div>';
    s.render($(".page", dev), st, me); }
  else if (s.shell === false) { shellOn = false; dev.innerHTML = '<div style="height:100%;overflow:auto"></div>'; s.render(dev.firstChild, st, me); }
  else {
    if (!shellOn) buildShell();
    $$(".nav", dev).forEach((n) => { if (n.dataset.nav === (s.nav || s.id)) n.setAttribute("aria-current", "page"); else n.removeAttribute("aria-current"); });
    const sub = SUB[s.nav || s.id], cr = $(".crumb", dev);
    cr.innerHTML = sub ? '<nav class="subtabs">' + sub.map((t) => '<a data-go="' + t[0] + '"' + (t[0] === s.id || (s.id === "policy" && t[0] === "policies") ? ' aria-current="page"' : "") + ">" + t[1] + "</a>").join("") + '</nav><span class="here" hidden></span>' : '<span class="here">' + s.name + "</span>";
    $$(".over,.rzp-dim", dev).forEach((o) => o.remove());
    const old = $(".page", dev), pg = document.createElement("div"); pg.className = "page"; old.replaceWith(pg);
    $(".scroll", dev).scrollTop = 0; $(".dock", dev).hidden = !!s.nodock;
    s.render(pg, st, me); knowStrip(s);
  }
  chromeSync(s, st);
}

/* command palette: a takeover view, not a floating box */
function palette() { if (!shellOn || $(".over", dev)) return;
  const items = []; Object.values(SC).forEach((x) => { if (x.shell !== false && !x.focus && !/palette|policy|settings|profile/.test(x.id)) items.push([x.name, "Go to", () => go(x.id)]); });
  items.push(["Settings", "Account", () => go("settings")], ["Your profile", "Account", () => go("profile")], ["Section 80D calculator", "Tools", () => go("tools", "80d")], ["Room rent check", "Tools", () => go("tools", "room")],
    ["Add a family member", "Do", () => go("family", "add")], ["Switch light and dark", "Do", () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark"; }]);
  P.forEach((p) => items.push([p.plan, "Policy", () => go("policy", p.id)])); HH.people.forEach((x) => items.push([x[0], "Person", () => go("family")]));
  const o = document.createElement("div"); o.className = "over"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Search or jump to");
  o.innerHTML = '<div class="inner"><input class="pal-in" type="text" placeholder="Go to a page, find a policy, or ask" aria-label="Search"><div class="stack s" role="listbox"></div></div>';
  $(".main", dev).appendChild(o); const inp = $("input", o), list = $("[role=listbox]", o); let sel = 0, cur = [];
  const draw = () => { const q = inp.value.trim().toLowerCase(); cur = items.filter((x) => !q || (x[0] + " " + x[1]).toLowerCase().includes(q)).slice(0, 9);
    if (q && !cur.length) cur = [["Ask: “" + inp.value.trim() + "”", "Ask Knowvia", () => { ASK.q = inp.value.trim(); go("chat", "ask"); }]];
    sel = Math.min(sel, cur.length - 1); if (sel < 0) sel = 0;
    list.innerHTML = cur.map((x, i) => '<a class="pal-i" role="option" aria-selected="' + (i === sel) + '" data-i="' + i + '"><span>' + x[0] + '</span><span class="sm">' + x[1] + "</span></a>").join(""); };
  const close = () => o.remove(); const pick = (i) => { const x = cur[i]; close(); if (x) x[2](); };
  inp.addEventListener("input", () => { sel = 0; draw(); });
  inp.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { sel = Math.min(cur.length - 1, sel + 1); draw(); e.preventDefault(); } else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === "Enter") pick(sel); else if (e.key === "Escape") close(); });
  list.addEventListener("click", (e) => { const a = e.target.closest("[data-i]"); if (a) pick(+a.dataset.i); });
  list.addEventListener("mousemove", (e) => { const a = e.target.closest("[data-i]"); if (a && +a.dataset.i !== sel) { sel = +a.dataset.i; draw(); } });
  draw(); inp.focus(); }

/* canvas chrome */
function chromeSync(s, st) { const sel = $("#c-screen"); if (sel.value !== s.id) sel.value = s.id;
  const box = $("#c-states"); box.innerHTML = (s.states || []).map(([id, l]) => '<button class="chip" type="button" aria-pressed="' + (id === st) + '" data-st="' + id + '">' + l + "</button>").join(""); }
function fit() { const v = $(".viewport"), vw = v.clientWidth, vh = v.clientHeight || (innerHeight - 52), W = Math.max(1280, Math.min(1760, vw)), k = vw / W;
  dev.style.width = W + "px"; dev.style.height = vh / k + "px"; dev.style.transform = "scale(" + k + ")"; $("#c-w").textContent = W + " px wide" + (k < 0.995 ? ", shown at " + Math.round(k * 100) + "%" : ""); }

function boot() { dev = $(".device");
  const groups = {}; ORDER.forEach((id) => { const s = SC[id]; (groups[s.group] = groups[s.group] || []).push(s); });
  $("#c-screen").innerHTML = Object.keys(groups).map((g) => '<optgroup label="' + g + '">' + groups[g].map((s) => '<option value="' + s.id + '">' + s.name + "</option>").join("") + "</optgroup>").join("");
  $("#c-screen").addEventListener("change", (e) => go(e.target.value));
  $("#c-states").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) go(curId(), b.dataset.st); });
  const step = (d) => { const i = ORDER.indexOf(SC[curId()] ? curId() : "home"); go(ORDER[(i + d + ORDER.length) % ORDER.length]); };
  $("#c-prev").addEventListener("click", () => step(-1)); $("#c-next").addEventListener("click", () => step(1));
  dev.addEventListener("click", (e) => { const p = e.target.closest("[data-pal]"); if (p) { palette(); return; }
    const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); const pp = a.dataset.go.split("/"); go(pp[0], pp.slice(1).join("/")); } });
  addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); } });
  tiltOn(dev); addEventListener("hashchange", show); addEventListener("resize", fit); fit(); show(); }
