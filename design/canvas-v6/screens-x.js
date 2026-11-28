"use strict";
/* Glass versions of the three densest screens: overview, policy detail, stress test. */

reg("home", { name: "Overview", group: "My cover", crumb: ["My cover", "Overview"], know: ["ped", "cashless", "morat"],
  states: [["ready", "Ready"], ["loading", "Loading"], ["reading", "Still reading"], ["empty", "No policy yet"], ["error", "Not answering"]],
  async render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<div class="bento" style="align-items:center"><div class="glass c7 stack l" data-tilt><span class="pill"><i></i>Saturday, 28 November</span><h1 class="d1">Good evening, ' + HH.first + '.</h1><p class="lg m">Add your first policy. Knowvia reads it and shows what it found here, usually in about a minute.</p><div><button class="btn big" data-go="add" type="button">Add a policy</button></div></div><div class="c5 float">' + ART.doc + "</div></div>"; return; }
    if (st === "error") return retryView(pg, "Knowvia is not answering.", "Your cover could not be loaded just now.", "home");
    if (st === "loading") { pg.innerHTML = '<div class="glass">' + SK(4) + "</div>"; await wait(1700); if (me !== RUN) return; }
    pg.innerHTML = '<div class="bento">' +
      '<div class="glass c7 stack l" data-tilt><span class="pill"><i></i>Saturday, 28 November · Good evening, ' + HH.first + '</span>' +
      '<h1 class="d1"><span class="acc num" id="tot"></span> of health cover, across two policies.</h1>' +
      (st === "reading" ? '<p class="nudge"><span><b>TeamCare Group is still being read.</b> <button class="btn txt acc" id="chk" type="button">Check again</button></span></p>'
        : '<p class="nudge"><span><b>One detail needs your decision:</b> the room rent limit has two readings. <a class="acc b" data-go="review">Decide now</a></span></p>') + "</div>" +
      '<div class="c5 scene" aria-label="Your cover as two layers"><div class="stack3d"><div class="slab" style="--i:0;--c:var(--blob3)"><b>TeamCare Group</b><span class="num">Rs 5,00,000 · from your job</span></div><div class="slab" style="--i:1"><b>Shield One</b><span class="num">Rs 10,00,000 · yours</span></div></div></div>' +
      '<section class="c12 stack"><div class="rowx" style="justify-content:space-between"><h2 class="h">Finish setting up · 2 of 5 done</h2><span class="hbar" style="width:260px"><i data-w="0.4"></i></span></div><div class="todo">' +
      [["did", "Add your first policy", "home"], ["did", "Add your job policy", "home"], ["now", "Decide the room rent limit", "review"], ["", "Tell us about your family", "declarations"], ["", "Run a hospital bill", "stress"]].map((t, i) => '<a class="' + t[0] + '" data-go="' + t[2] + '"><span class="n">' + (t[0] === "did" ? TICK : i + 1) + '</span><b>' + t[1] + "</b>" + (t[0] === "now" ? '<span class="acc b">Do this now →</span>' : "") + "</a>").join("") + "</div></section>" +
      '<a class="glass tight lift c4 rowx" data-go="policy/p1" data-tilt style="text-decoration:none;flex-wrap:nowrap">' + ring(71, "106") + '<span class="stack s"><span>Days to renewal</span><span class="h">14 Mar 2027</span><span>Shield One</span></span></a>' +
      '<a class="glass tight lift c4 rowx" data-go="policy/p1/Waiting" data-tilt style="text-decoration:none;flex-wrap:nowrap">' + ring(90, "90%") + '<span class="stack s"><span>Pre-existing wait served</span><span class="h">Ends 14 Mar 2027</span><span>2 of 3 waits are over</span></span></a>' +
      '<a class="glass tight lift c4 stack s" data-go="money" data-tilt style="text-decoration:none"><span>Next premium</span><span class="fig"><span class="v num">Rs 24,860</span></span><span>Due 1 Mar 2027 · saves you up to Rs 7,458 in tax under 80D</span></a>' +
      '<section class="glass c7 stack"><div class="rowx" style="justify-content:space-between"><h2 class="h">Who is covered, and for how much</h2><a data-go="family">People</a></div>' +
      HH.people.map((p) => '<div class="rowx" style="flex-wrap:nowrap;gap:16px"><span class="av">' + p[0][0] + '</span><span style="flex:1" class="stack s"><span class="rowx" style="justify-content:space-between"><span><b>' + p[0] + "</b> · " + p[1] + ", " + p[2] + '</span><span class="b num">' + rs(p[4]) + '</span></span><span class="hbar"><i data-w="' + p[4] / 1500000 + '"></i></span><span>' + p[3] + "</span></span></div>").join("") + "</section>" +
      '<section class="glass c5 stack"><h2 class="h">Ask about your cover</h2><div class="rows">' +
      ["What are my waiting periods?", "I am switching jobs. What happens to my cover?", "Is knee replacement covered?", "Find a cashless hospital near me"].map((q) => '<button class="rowb" type="button" data-q="' + q + '"><span class="m">' + q + '</span><span></span><span class="go">→</span></button>').join("") + "</div></section>" +
      '<section class="glass c12 stack"><div class="rowx" style="justify-content:space-between"><h2 class="h">Your policies</h2><a data-go="pay">Add a policy</a></div><div class="rows">' +
      P.map((p) => '<a class="rowb" data-go="policy/' + p.id + '"><span><span class="ttl">' + p.plan + "</span><span>" + p.ins + " · " + p.kind + " · covers " + p.who + '</span></span><span class="num b md">' + rs(p.si) + '</span><span class="go">→</span></a>').join("") + "</div></section></div>";
    if (st === "loading") $("#tot", pg).textContent = rs(1500000); else roll($("#tot", pg), 1500000, 900); kick(pg);
    pg.addEventListener("click", (e) => { const a = e.target.closest("[data-q]"); if (a) { ASK.q = a.dataset.q; go("chat", "ask"); } });
    const c = $("#chk", pg); if (c) c.onclick = async () => { c.disabled = true; c.textContent = "Checking…"; await wait(1200); if (me === RUN) go("home", "ready"); };
  } });

reg("policy", { name: "Policy detail", group: "My cover", nav: "policies", crumb: ["My cover", "My policies", "Shield One"], know: ["room", "ped", "grace"],
  states: [["p1", "Shield One"], ["p2", "TeamCare Group"]],
  render(pg, st, me) {
    const p = P.find((x) => x.id === st) || P[0]; $(".crumb .here", dev).textContent = p.plan;
    const waits = [[100, "30 days", "Initial wait", "Ended 14 Apr 2024"], [100, "2 years", "Joint, hernia, cataract", "Ended 14 Mar 2026"], [90, "3 years", "Pre-existing conditions", "Ends 14 Mar 2027"]];
    pg.innerHTML = '<div class="bento"><div class="glass c8 stack l" data-tilt><div class="stack s"><span class="pill"><i></i>' + p.ins + " · " + p.kind + '</span><h1 class="d1">' + p.plan + "</h1></div>" +
      '<div class="cols3"><div class="fig"><span>Sum insured</span><span class="v" id="si"></span></div><div class="fig"><span>Renews</span><span class="v">' + p.to + '</span></div><div class="fig"><span>Premium a year</span><span class="v num">' + rs(p.prem) + "</span></div></div></div>" +
      '<button class="flip c4" type="button" aria-pressed="false" aria-label="Policy card, press to turn over"><span class="in3"><span class="face glass card-art"><span class="rowx" style="justify-content:space-between"><b class="md">' + p.plan + '</b><span>e-card</span></span><span class="stack s"><span class="lg b num">' + p.no + "</span><span>" + HH.name + " · valid to " + p.to + '</span></span></span>' +
      '<span class="face back glass"><b>At the hospital desk</b><span>Show this card and a photo ID. Ask for the cashless request time.</span><span class="b">Cashless decision due in 1 hour</span></span></span></button>' +
      '<div class="glass c8 stack l"><div class="tabs" role="tablist">' + ["Limits", "Waiting", "Exclusions", "Cashless", "Money"].map((t, i) => '<button class="tab" role="tab" type="button" aria-selected="' + (i === 0) + '">' + t + '</button>').join("") + '</div><div id="tabp"></div></div>' +
      '<aside class="c4 stack" style="gap:22px"><form class="glass tight stack" id="sf"><label class="field"><span>Search your policy wording</span><input type="search" id="sq" placeholder="For example maternity"></label><div><button class="btn line" type="submit">Search</button></div><div class="stack" id="sr" role="status"></div></form>' +
      '<div class="glass tight stack s"><dl class="kv" style="grid-template-columns:auto 1fr"><dt>People</dt><dd>' + p.who + '</dd><dt>Insurer terms</dt><dd class="ok" style="animation:none">' + TICK + 'Attached</dd></dl><a data-go="chat">Ask about this policy</a><a data-go="stress">Run a bill through it</a></div></aside></div>';
    roll($("#si", pg), p.si, 800); const tabp = $("#tabp", pg);
    const draw = (t) => { tabp.innerHTML = t === "Waiting"
      ? '<div class="cols3" style="animation:rise 200ms var(--enter) both">' + waits.map((w) => '<div class="stack s" style="justify-items:start">' + ring(w[0], w[1]) + '<b class="md">' + w[2] + '</b><span class="sig ' + (w[0] >= 100 ? "ok" : "warn") + '">' + w[3] + "</span></div>").join("") + "</div>"
      : '<div class="kv3" style="animation:rise 200ms var(--enter) both">' + FACTS[t].map((f) => "<span>" + f[0] + '</span><span class="b num ' + (/Not paid/.test(f[1]) ? "t-bad" : /Paid in full|^None$/.test(f[1]) ? "t-ok" : "") + '">' + f[1] + '</span><span class="sm">' + f[2] + "</span>").join("") + "</div>"; kick(tabp); };
    const pick = (t) => { $$(".tab", pg).forEach((x) => x.setAttribute("aria-selected", String(x.textContent === t))); draw(t); };
    pick((location.hash.split("/")[2]) || "Limits");
    $(".tabs", pg).onclick = (e) => { const b = e.target.closest(".tab"); if (b) pick(b.textContent); };
    $(".flip", pg).onclick = (e) => { const f = e.currentTarget; f.setAttribute("aria-pressed", String(f.getAttribute("aria-pressed") !== "true")); };
    $("#sf", pg).onsubmit = async (e) => { e.preventDefault(); const b = $("button", e.target), q = $("#sq", pg).value.trim(), r = $("#sr", pg); if (!q) { $("#sq", pg).focus(); return; }
      busy(b, "Searching…"); r.innerHTML = ""; await wait(900); if (me !== RUN) return; idle(b);
      r.innerHTML = /mater|wait|room|knee|joint/i.test(q) ? '<p class="quote">“Expenses for ' + q.toLowerCase().replace(/</g, "") + ' are payable subject to the limits in the schedule and after the waiting period, if any, has been served.”</p><p class="sm">Terms, page 16</p>' : '<p class="err">Nothing in the wording for “' + q.replace(/</g, "") + "”.</p>"; };
  } });

reg("stress", { name: "Stress test", group: "My cover", crumb: ["My cover", "Stress test"], know: ["room", "cashless", "discharge"],
  states: [["start", "No bill yet"], ["within", "Within cover"], ["both", "Both policies"], ["over", "Past all cover"]],
  render(pg, st) {
    const modes = [["Shield One", 0], ["TeamCare Group", 1], ["Both policies", 2]];
    pg.innerHTML = '<h1 class="d2">Who pays if a hospital bill comes?</h1><div class="bento">' +
      '<div class="glass c5 stack l"><div class="stack s"><span class="m">Claim on</span><div><div class="seg" id="sp">' + modes.map((m) => '<button type="button" data-i="' + m[1] + '" aria-pressed="' + (m[1] === 0) + '">' + m[0] + "</button>").join("") + "</div></div></div>" +
      '<label class="field"><span>Hospital bill, in rupees</span><input class="bigin" type="text" inputmode="numeric" id="bill" placeholder="3,00,000"></label>' +
      '<input type="range" id="rg" min="0" max="2000000" step="10000" value="0" aria-label="Hospital bill" style="width:100%;accent-color:var(--accent)">' +
      '<div class="rowx" style="gap:8px">' + [["Appendix surgery", 120000], ["Knee replacement", 450000], ["Heart bypass", 1200000], ["Long ICU stay", 1800000]].map((x) => '<button class="pill" style="cursor:pointer;height:36px" type="button" data-b="' + x[1] + '">' + x[0] + "</button>").join("") + "</div></div>" +
      '<div class="c7 stack"><div class="scene" style="height:300px"><div class="stack3d"><div class="slab" id="s1" style="--i:0;--c:var(--mint);--fill:0"><b>TeamCare Group</b><span class="num" id="t1">Rs 0</span></div><div class="slab" id="s0" style="--i:1;--fill:0"><b>Shield One</b><span class="num" id="t0">Rs 0</span></div><div class="slab bill" id="s2" style="--i:2;--fill:0"><b>You</b><span class="num" id="t2">Rs 0</span></div></div></div>' +
      '<div class="glass stack"><div class="rowx" style="justify-content:space-between;align-items:end"><div class="stack s"><span class="rowx"><span class="m md">You pay</span><span id="sgl"></span></span><span class="d1 num" id="you" style="font-family:var(--sans);font-weight:600">Rs 0</span></div><p class="md m" id="why" style="max-width:30ch;text-align:right"></p></div>' +
      '<table><tbody><tr><td>Hospital bill</td><td class="r b" id="l1">Rs 0</td></tr><tr><td>TeamCare Group pays</td><td class="r b" id="l2">Rs 0</td></tr><tr><td>Shield One pays</td><td class="r b" id="l3">Rs 0</td></tr></tbody></table></div></div></div>';
    let mode = 0; const bill = $("#bill", pg), rg = $("#rg", pg);
    const calc = () => { const n = +bill.value.replace(/\D/g, "") || 0; let g = 0, o = 0; if (mode !== 0) g = Math.min(n, 500000); if (mode !== 1) o = Math.min(n - g, 1000000); const you = n - g - o;
      roll($("#you", pg), you); roll($("#l1", pg), n); roll($("#l2", pg), g); roll($("#l3", pg), o); roll($("#t0", pg), o); roll($("#t1", pg), g); roll($("#t2", pg), you);
      $("#s0", pg).style.setProperty("--fill", o / 1000000); $("#s1", pg).style.setProperty("--fill", g / 500000); $("#s2", pg).style.setProperty("--fill", n ? Math.min(1, you / n * 2) : 0); $("#s2", pg).style.opacity = you ? 1 : 0.35;
      $("#you", pg).style.color = you ? "var(--bad)" : n ? "var(--ok)" : ""; $("#sgl", pg).innerHTML = !n ? "" : you ? '<span class="sig bad">You pay part of this</span>' : '<span class="sig ok">Fully covered</span>'; rg.value = n;
      $("#why", pg).textContent = !n ? "Type a bill, drag the slider or pick a treatment." : you ? "The bill goes " + rs(you) + " past the cover you chose." : mode === 2 ? "Claim on the job policy first. Shield One keeps its no-claim bonus." : "Fully inside your sum insured."; };
    bill.oninput = () => { const n = bill.value.replace(/\D/g, "").slice(0, 8); bill.value = n ? (+n).toLocaleString("en-IN") : ""; calc(); };
    rg.oninput = () => { bill.value = +rg.value ? (+rg.value).toLocaleString("en-IN") : ""; calc(); };
    const set = (m, n) => { mode = m; $$("#sp button", pg).forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.i === m))); if (n != null) bill.value = n.toLocaleString("en-IN"); calc(); };
    pg.addEventListener("click", (e) => { const b = e.target.closest("[data-b]"), s = e.target.closest("#sp button"); if (b) set(mode, +b.dataset.b); if (s) set(+s.dataset.i); });
    if (st === "within") set(0, 450000); else if (st === "both") set(2, 1200000); else if (st === "over") set(2, 1800000); else calc();
  } });
