"use strict";
/* My cover: overview, policies, policy detail, ask, hospitals, stress test, compare. */

function retryView(pg, title, body, back) {
  pg.innerHTML = '<div class="stack"><h1 class="d1" style="max-width:16ch">' + title + '</h1><p class="lg m measure">' + body + '</p></div><div class="rowx"><button class="btn big" id="rt" type="button">Try again</button></div><div class="status" id="rs" role="status"></div>';
  let n = 0; $("#rt", pg).onclick = async (e) => { const me = RUN; busy(e.target, "Trying…"); $("#rs", pg).innerHTML = ""; await wait(1300); if (me !== RUN) return;
    if (!n++) { idle(e.target, "Try again"); say($("#rs", pg), "Still no answer.", "err"); } else go(back); };
}

reg("home", { name: "Overview", group: "My cover", crumb: ["My cover", "Overview"],
  states: [["ready", "Ready"], ["loading", "Loading"], ["reading", "Still reading"], ["empty", "No policy yet"], ["error", "Not answering"]],
  async render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<div class="stack"><p class="md m">Saturday, 28 November</p><h1 class="d1">Good evening, ' + HH.first + '.</h1></div><p class="lg m measure">Add your first policy. Knowvia reads it and shows what it found here.</p><div><button class="btn big" data-go="add" type="button">Add a policy</button></div>'; return; }
    if (st === "error") return retryView(pg, "Knowvia is not answering.", "Your cover could not be loaded just now.", "home");
    if (st === "loading") { pg.innerHTML = SK(4); await wait(1700); if (me !== RUN) return; pg.innerHTML = ""; }
    pg.innerHTML = '<div class="stack l"><p class="md m">Saturday, 28 November · Good evening, ' + HH.first + '.</p>' +
      '<h1 class="d1" style="max-width:24ch"><span class="acc num" id="tot"></span> of health cover across two policies. One is yours, one comes with your job.</h1></div>' +
      (st === "reading" ? '<p class="nudge"><span><b>TeamCare Group is still being read.</b> <button class="btn txt acc" id="chk" type="button">Check again</button> <span id="cs" role="status"></span></span></p>'
        : '<p class="nudge"><span><b>One detail needs your decision:</b> the room rent limit has two readings. <a class="acc b" data-go="review">Decide now</a></span></p>') +
      '<div class="cols3"><div class="fig"><span>Next renewal</span><span class="v">14 Mar 2027</span><span class="m">Shield One, in 106 days</span></div>' +
      '<div class="fig"><span>Next premium</span><span class="v num">Rs 24,860</span><span class="m">Due 1 Mar 2027 · <a data-go="money">Premiums</a></span></div>' +
      '<div class="fig"><span>Waiting periods</span><span class="v">1 still running</span><span class="m">Pre-existing, ends 14 Mar 2027</span></div></div>' +
      '<section class="stack"><div class="rowx" style="justify-content:space-between"><h2 class="h">Your policies</h2><a data-go="add">Add a policy</a></div><div class="rows">' +
      P.map((p) => '<a class="rowb" data-go="policy/' + p.id + '"><span><span class="ttl">' + p.plan + "</span><span>" + p.ins + " · " + p.who + '</span></span><span class="num b md">' + rs(p.si) + '</span><span class="go">→</span></a>').join("") + "</div></section>" +
      '<section class="stack"><h2 class="h">Ask about your cover</h2><div class="rowx" style="gap:10px 34px">' +
      ["What are my waiting periods?", "What does my policy not cover?", "Find a cashless hospital near me"].map((q) => '<a class="md" data-q="' + q + '">' + q + "</a>").join("") + "</div></section>";
    if (st === "loading") $("#tot", pg).textContent = rs(1500000); else roll($("#tot", pg), 1500000, 900);
    pg.addEventListener("click", (e) => { const a = e.target.closest("[data-q]"); if (a) { ASK.q = a.dataset.q; go("chat", "ask"); } });
    const c = $("#chk", pg); if (c) c.onclick = async () => { c.disabled = true; c.textContent = "Checking…"; await wait(1200); if (me !== RUN) return; go("home", "ready"); };
  } });

reg("policies", { know: ["freelook", "grace", "morat"], name: "My policies", group: "My cover", crumb: ["My cover", "My policies"],
  states: [["two", "Two policies"], ["reading", "One still reading"], ["empty", "None yet"]],
  render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<h1 class="d1">No policies yet.</h1><p class="lg m measure">Add a policy and what Knowvia finds in it shows here.</p><div><button class="btn big" data-go="add" type="button">Add a policy</button></div>'; return; }
    pg.innerHTML = '<div class="rowx" style="justify-content:space-between;align-items:end"><div class="stack s"><h1 class="d2">My policies</h1><p class="md m">2 policies · ' + rs(1500000) + ' in all</p></div><button class="btn" data-go="pay" type="button">Add a policy</button></div>' +
      '<div class="glass"><table><thead><tr><th>Policy</th><th>People</th><th>Policy period</th><th class="r">Premium</th><th class="r">Sum insured</th><th></th></tr></thead><tbody>' +
      P.map((p, i) => (st === "reading" && i === 1)
        ? '<tr><td><span class="b md">TeamCare policy</span><br><span class="sig warn">Still being read</span></td><td colspan="3"><span class="sk" style="width:80%;height:18px"></span></td><td class="r"><button class="btn txt acc" id="chk" type="button">Check again</button></td><td></td></tr>'
        : '<tr style="cursor:pointer" data-go="policy/' + p.id + '"><td><a class="b md" data-go="policy/' + p.id + '" style="text-decoration:none">' + p.plan + "</a><br>" + p.ins + "</td><td>" + p.who + "</td><td>" + p.from + " to " + p.to + '</td><td class="r">' + rs(p.prem) + '</td><td class="r b md">' + rs(p.si) + '</td><td class="r">→</td></tr>').join("") + "</tbody></table></div>" +
      '<div class="rowx"><a data-go="compare">Compare them side by side</a><a data-go="stress">Run a hospital bill through them</a></div>';
    const c = $("#chk", pg); if (c) c.onclick = async () => { c.disabled = true; c.textContent = "Checking…"; await wait(1200); if (me === RUN) go("policies", "two"); };
  } });

const FACTS = {
  Limits: [["Sum insured", "Rs 10,00,000", "Schedule, page 1"], ["Room rent limit", "Single private room", "You chose this"], ["Co-pay", "None", "Terms, page 9"], ["ICU charges", "Paid in full", "Terms, page 9"], ["Ambulance", "Rs 3,000 per admission", "Terms, page 11"], ["Day-care procedures", "541 listed", "Terms, page 26"]],
  Exclusions: [["Cosmetic surgery", "Not paid", "Terms, page 21"], ["Dental, unless from an accident", "Not paid", "Terms, page 21"], ["Spectacles and hearing aids", "Not paid", "Terms, page 22"], ["Self-inflicted injury", "Not paid", "Terms, page 22"]],
  Cashless: [["Network hospitals", "8,412 across India", "Insurer list"], ["Pre-authorisation, planned", "48 hours before admission", "Terms, page 30"], ["Pre-authorisation, emergency", "Within 24 hours", "Terms, page 30"]],
  Money: [["Premium", "Rs 24,860 a year", "Schedule, page 1"], ["No-claim bonus", "10% a year, up to 50%", "Terms, page 18"], ["Restore benefit", "Once a year, 100%", "Terms, page 17"], ["Grace period", "30 days", "Terms, page 33"]] };
reg("policy", { name: "Policy detail", group: "My cover", nav: "policies", crumb: ["My cover", "My policies", "Shield One"],
  states: [["p1", "Shield One"], ["p2", "TeamCare Group"]],
  render(pg, st, me) {
    const p = P.find((x) => x.id === st) || P[0]; $(".crumb .here", dev).textContent = p.plan;
    pg.innerHTML = '<div class="stack s"><p class="md m">' + p.ins + '</p><h1 class="d1">' + p.plan + "</h1></div>" +
      '<div class="cols3"><div class="fig"><span>Sum insured</span><span class="v" id="si"></span></div><div class="fig"><span>Policy period</span><span class="v">' + p.to + '</span><span class="m">Started ' + p.from + '</span></div><div class="fig"><span>Premium</span><span class="v num">' + rs(p.prem) + '</span><span class="m">A year</span></div></div>' +
      '<div class="cols2"><div class="stack l"><div class="tabs" role="tablist">' + ["Limits", "Waiting", "Exclusions", "Cashless", "Money"].map((t, i) => '<button class="tab" role="tab" type="button" aria-selected="' + (i === 0) + '">' + t + "</button>").join("") + '</div><div id="tabp"></div></div>' +
      '<aside class="stack l"><dl class="kv" style="grid-template-columns:auto 1fr"><dt>Policy number</dt><dd>' + p.no + "</dd><dt>People</dt><dd>" + p.who + '</dd><dt>Insurer terms</dt><dd class="ok" style="animation:none">' + TICK + 'Attached</dd></dl>' +
      '<form class="stack" id="sf"><label class="field"><span>Search your policy wording</span><input type="search" id="sq" placeholder="For example maternity"></label><div><button class="btn line" type="submit">Search</button></div><div class="stack" id="sr" role="status"></div></form>' +
      '<div class="stack s"><a data-go="chat">Ask about this policy</a><a data-go="policies">All policies</a></div></aside></div>';
    roll($("#si", pg), p.si, 800);
    const tabp = $("#tabp", pg);
    const draw = (t) => { tabp.innerHTML = t === "Waiting"
      ? '<div class="line-tl" style="animation:rise 200ms var(--enter) both">' + [["on", "Initial wait, 30 days", "Ended 14 Apr 2024"], ["on", "Joint, hernia and cataract surgery, 2 years", "Ended 14 Mar 2026"], ["", "Pre-existing conditions, 3 years", "Ends 14 Mar 2027, in 106 days"]].map((x) => '<span class="dot ' + x[0] + '"></span><div class="t"><p class="md b">' + x[1] + "</p><p>" + x[2] + "</p></div>").join("") + "</div>"
      : '<div class="kv3" style="animation:rise 200ms var(--enter) both">' + FACTS[t].map((f) => "<span>" + f[0] + '</span><span class="b num">' + f[1] + '</span><span class="sm">' + f[2] + "</span>").join("") + "</div>"; };
    draw("Limits");
    $(".tabs", pg).onclick = (e) => { const b = e.target.closest(".tab"); if (!b) return; $$(".tab", pg).forEach((x) => x.setAttribute("aria-selected", String(x === b))); draw(b.textContent); };
    $("#sf", pg).onsubmit = async (e) => { e.preventDefault(); const b = $("button", e.target), q = $("#sq", pg).value.trim(), r = $("#sr", pg); if (!q) { $("#sq", pg).focus(); return; }
      busy(b, "Searching…"); r.innerHTML = ""; await wait(900); if (me !== RUN) return; idle(b);
      r.innerHTML = /mater|wait|room|knee|joint/i.test(q) ? '<p class="quote">“Expenses for ' + q.toLowerCase() + ' are payable subject to the limits in the schedule and after the waiting period, if any, has been served.”</p><p class="sm">Terms, page 16</p>' : '<p class="err">Nothing in the wording for “' + q.replace(/</g, "") + "”.</p>"; };
  } });

const QA = [
  [/knee|joint|replac/i, "Yes. Shield One pays for knee replacement once the two-year wait for joint surgery is over. Yours ended on 14 March 2026, so a claim today is payable up to Rs 10,00,000.", "Joint replacement surgery, unless arising from an accident, is payable after twenty-four months of continuous cover.", "Policy terms, page 14, clause 4.2", [["Wait for joint surgery", "2 years, ended 14 Mar 2026"], ["Sum insured", "Rs 10,00,000"]]],
  [/wait/i, "Three waiting periods apply to Shield One. Two are over. The wait for pre-existing conditions ends on 14 March 2027.", "Pre-existing diseases declared at inception are covered after thirty-six months of continuous cover.", "Policy terms, page 13, clause 4.1", [["Initial wait", "30 days, ended"], ["Joint, hernia, cataract", "2 years, ended"], ["Pre-existing conditions", "3 years, ends 14 Mar 2027"]]],
  [/not cover|exclu/i, "Shield One does not pay for cosmetic surgery, dental work unless it follows an accident, spectacles and hearing aids, or self-inflicted injury.", "The Company shall not be liable for expenses towards cosmetic or plastic surgery unless necessitated by an accident, burns or cancer.", "Policy terms, page 21, clause 6", [["Exclusions listed", "14"]]],
  [/hospital|cashless/i, "Six cashless hospitals sit within five kilometres of 560038. Lakeside Multispeciality is the nearest.", "", "Sahyadri network list", [["Pincode on your profile", "560038"]], "hospitals/results"] ];
reg("chat", { name: "Ask about your cover", group: "My cover", crumb: ["My cover", "Ask about your cover"],
  states: [["empty", "Nothing asked"], ["ask", "Answering"], ["slow", "Slow, then fails"], ["none", "Not in the policy"]],
  render(pg, st, me) {
    pg.style.gap = "40px";
    pg.innerHTML = '<div class="log" id="log" role="log"></div>'; const log = $("#log", pg);
    const starters = ["What are my waiting periods?", "What does my policy not cover?", "Find a cashless hospital near me", "Is knee replacement covered?"];
    const ask = async (q, mode) => { const my = RUN; $("#start", pg) && $("#start", pg).remove();
      const turn = document.createElement("div"); turn.className = "stack"; turn.innerHTML = '<p class="q"></p><div class="a glass"><p class="rowx" style="gap:12px"><span class="pulse"></span><span class="m" id="wt">Looking in your cover…</span></p></div>'; $(".q", turn).textContent = q; log.appendChild(turn);
      const a = $(".a", turn), sc = $(".scroll", dev); sc.scrollTop = sc.scrollHeight;
      if (mode === "slow") { await wait(2200); if (my !== RUN) return; $("#wt", turn).textContent = "Still working…"; await wait(2400); if (my !== RUN) return;
        a.innerHTML = '<p class="err" role="alert">That took too long.</p><div><button class="btn line" type="button">Try again</button></div>'; $("button", a).onclick = () => { turn.remove(); ask(q); }; return; }
      await wait(1100); if (my !== RUN) return;
      const hit = mode === "none" ? null : QA.find((x) => x[0].test(q));
      a.innerHTML = "<p></p>"; const ok = await stream(a.firstChild, hit ? hit[1] : "That is not in Shield One or TeamCare Group. Ask about a treatment, a waiting period, a limit or a hospital.", my); if (!ok) return;
      if (hit) { if (hit[2]) a.insertAdjacentHTML("beforeend", '<p class="quote">“' + hit[2] + "”</p>");
        a.insertAdjacentHTML("beforeend", '<dl class="kv" style="animation:rise 200ms var(--enter) both;font-size:16px">' + hit[4].map((f) => "<dt>" + f[0] + "</dt><dd>" + f[1] + "</dd>").join("") + "</dl>" +
          '<p class="rowx" style="font-size:16px"><a data-go="policy/p1">' + hit[3] + "</a>" + (hit[5] ? '<a class="b acc" data-go="' + hit[5] + '">Open network hospitals</a>' : "") + "</p>"); }
      sc.scrollTop = sc.scrollHeight; };
    SC.chat.ask = (q) => ask(q);
    if (st === "empty") { const s = document.createElement("div"); s.id = "start"; s.className = "stack l"; s.innerHTML = '<h1 class="d1" style="max-width:14ch">Ask anything about your cover.</h1><div class="rows glass" style="max-width:680px">' + starters.map((q) => '<button class="rowb" type="button" data-s="' + q + '"><span class="md m">' + q + '</span><span></span><span class="go">→</span></button>').join("") + "</div>"; pg.prepend(s);
      s.onclick = (e) => { const b = e.target.closest("[data-s]"); if (b) ask(b.dataset.s); }; }
    else { const q = ASK.q || "Is knee replacement covered?"; ASK.q = ""; ask(st === "none" ? "Does it cover my dog’s surgery?" : q, st); }
  } });

const HOSP = [["Lakeside Multispeciality Hospital", "12 Lake Road, Indiranagar", "1.2 km", 1], ["St Alban Heart Centre", "Old Airport Road, Domlur", "2.4 km", 1], ["Greenfield Children’s Hospital", "80 Feet Road, Koramangala", "3.1 km", 1], ["Northgate Orthopaedic Clinic", "CMH Road, Indiranagar", "3.3 km", 0], ["Cedar Women’s Hospital", "HAL 2nd Stage", "4.0 km", 1], ["Riverbend General Hospital", "Ulsoor Main Road", "4.6 km", 1], ["Marigold Eye Hospital", "Double Road, Indiranagar", "4.8 km", 1]];
reg("hospitals", { know: ["cashless", "discharge", "sos"], name: "Network hospitals", group: "My cover", crumb: ["My cover", "Network hospitals"],
  states: [["start", "Start"], ["results", "Results"], ["none", "None found"], ["bad", "Bad pincode"]],
  render(pg, st, me) {
    pg.innerHTML = '<h1 class="d2">Network hospitals</h1><form class="rowx glass" id="hf" style="align-items:end"><label class="field" style="width:240px"><span>Pincode</span><input type="text" inputmode="numeric" maxlength="6" id="pin" class="num" placeholder="Six digits"></label>' +
      '<div class="seg" id="hp">' + P.map((p, i) => '<button type="button" aria-pressed="' + (i === 0) + '">' + p.plan + "</button>").join("") + '</div><button class="btn" type="submit">Find hospitals</button></form><div class="stack" id="out" role="status"><div class="bento"><div class="c5 float">' + ART.hosp + '</div><div class="c7 stack" style="align-content:center"><p class="d3">Type a pincode to see which hospitals take your policy without cash.</p><p class="md m">Your profile pincode is 560038.</p></div></div></div>';
    const pin = $("#pin", pg), out = $("#out", pg);
    $("#hp", pg).onclick = (e) => { const b = e.target.closest("button"); if (b) { $$("button", $("#hp", pg)).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (out.firstChild) $("#hf", pg).requestSubmit(); } };
    pin.oninput = () => { pin.value = pin.value.replace(/\D/g, ""); pin.classList.remove("bad"); };
    $("#hf", pg).onsubmit = async (e) => { e.preventDefault(); const b = $("[type=submit]", e.target);
      if (!/^[1-9]\d{5}$/.test(pin.value)) { pin.classList.add("bad"); say(out, "A pincode has six digits and does not start with 0.", "err"); pin.focus(); return; }
      out.innerHTML = '<table><tbody>' + '<tr><td><span class="sk" style="width:60%;height:18px"></span></td></tr>'.repeat(4) + "</tbody></table>"; busy(b, "Searching…"); await wait(1100); if (me !== RUN) return; idle(b);
      if (pin.value.endsWith("99")) { say(out, "No network hospital is listed for " + pin.value + ". Try a nearby pincode.", "err"); return; }
      const cash = HOSP.filter((h) => h[3]).length;
      out.innerHTML = '<p class="md m" style="animation:rise 200ms var(--enter) both">' + HOSP.length + " hospitals near " + pin.value + " · " + cash + ' cashless</p><div class="glass" style="animation:rise 240ms var(--enter) both"><table><thead><tr><th>Hospital</th><th>Address</th><th class="r">Distance</th><th class="r">Cashless</th></tr></thead><tbody>' +
        HOSP.map((h) => '<tr><td class="b md">' + h[0] + "</td><td>" + h[1] + '</td><td class="r">' + h[2] + '</td><td class="r"><span class="sig ' + (h[3] ? "ok\">Cashless" : "bad\">Pay first") + "</span></td></tr>").join("") + "</tbody></table></div>"; };
    if (st === "results") { pin.value = "560038"; $("#hf", pg).requestSubmit(); } if (st === "none") { pin.value = "560099"; $("#hf", pg).requestSubmit(); } if (st === "bad") { pin.value = "0560"; $("#hf", pg).requestSubmit(); }
  } });

reg("stress", { name: "Stress test", group: "My cover", crumb: ["My cover", "Stress test"],
  states: [["start", "No bill yet"], ["within", "Within cover"], ["over", "Past the sum insured"], ["copay", "With co-pay"]],
  render(pg, st, me) {
    pg.innerHTML = '<h1 class="d2">Who pays if a hospital bill comes?</h1>' +
      '<div class="cols2" style="grid-template-columns:minmax(0,5fr) minmax(0,6fr)"><div class="stack l"><div class="stack s"><span class="m" style="font-size:15px">Policy</span><div><div class="seg" id="sp">' + P.map((p, i) => '<button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' + p.plan + "</button>").join("") + "</div></div></div>" +
      '<label class="field"><span>Hospital bill, in rupees</span><input class="bigin" type="text" inputmode="numeric" id="bill" placeholder="3,00,000"></label>' +
      '<div class="stack s">' + [["Appendix surgery", 120000], ["Knee replacement", 450000], ["Heart bypass", 1200000]].map((x) => '<button class="btn txt" style="justify-content:start" type="button" data-b="' + x[1] + '">' + x[0] + " · " + rs(x[1]) + "</button>").join("") + "</div></div>" +
      '<div class="stack l" id="res"><div class="stack s"><p class="md m">You pay</p><p class="d1 num" id="you" style="font-family:var(--sans);font-weight:600">Rs 0</p><p class="md m" id="why">Type a bill to see who pays.</p></div>' +
      '<div class="split" aria-hidden="true"><i id="sb" style="width:0%"></i></div>' +
      '<table><tbody><tr><td>Hospital bill</td><td class="r b" id="l1">Rs 0</td></tr><tr id="cr"><td id="cl">Your co-pay</td><td class="r b" id="l2">Rs 0</td></tr><tr><td>Above the sum insured</td><td class="r b" id="l3">Rs 0</td></tr><tr><td class="b">Insurer pays</td><td class="r b md" id="l4">Rs 0</td></tr></tbody></table></div></div>';
    let pi = 0; const bill = $("#bill", pg);
    const calc = () => { const p = P[pi], n = +bill.value.replace(/\D/g, "") || 0, over = Math.max(0, n - p.si), base = n - over, co = Math.round(base * p.copay / 100), ins = base - co, you = over + co;
      roll($("#you", pg), you); roll($("#l1", pg), n); roll($("#l2", pg), co); roll($("#l3", pg), over); roll($("#l4", pg), ins);
      $("#cl", pg).textContent = "Your co-pay, " + p.copay + "%"; $("#sb", pg).style.width = n ? (ins / n) * 100 + "%" : "0%";
      $("#why", pg).textContent = !n ? "Type a bill to see who pays." : over ? "The bill goes past your sum insured of " + rs(p.si) + "." : you ? "Within your sum insured of " + rs(p.si) + ", after your co-pay." : "Within your sum insured of " + rs(p.si) + ".";
      $("#you", pg).style.color = over ? "var(--fail)" : ""; };
    bill.oninput = () => { const n = bill.value.replace(/\D/g, "").slice(0, 9); bill.value = n ? (+n).toLocaleString("en-IN") : ""; calc(); };
    pg.addEventListener("click", (e) => { const b = e.target.closest("[data-b]"), s = e.target.closest("#sp button"); if (b) { bill.value = (+b.dataset.b).toLocaleString("en-IN"); calc(); }
      if (s) { pi = +s.dataset.i; $$("#sp button", pg).forEach((x) => x.setAttribute("aria-pressed", String(x === s))); calc(); } });
    const set = (i, n) => { pi = i; $$("#sp button", pg).forEach((x, j) => x.setAttribute("aria-pressed", String(j === i))); bill.value = n.toLocaleString("en-IN"); calc(); };
    if (st === "within") set(0, 450000); if (st === "over") set(0, 1200000); if (st === "copay") set(1, 300000); if (st === "start") calc();
  } });

reg("compare", { know: ["lastday", "room", "grace"], name: "Compare plans", group: "My cover", crumb: ["My cover", "Compare plans"],
  states: [["all", "Every row"], ["diff", "Differences only"], ["one", "Only one policy"]],
  render(pg, st) {
    if (st === "one") { pg.innerHTML = '<h1 class="d1" style="max-width:18ch">You have one policy. Add another to see them side by side.</h1><div><button class="btn big" data-go="pay" type="button">Add a policy</button></div>'; return; }
    const R = [["Sum insured", "Rs 10,00,000", "Rs 5,00,000"], ["Policy period", "15 Mar 2026 to 14 Mar 2027", "3 Aug 2026 to 2 Aug 2027"], ["Premium", "Rs 24,860", "Rs 38,400"], ["Room rent limit", "Single private room", "Rs 5,000 a day"], ["Co-pay", "None", "20%"], ["Initial wait", "30 days", "30 days"],
      ["Pre-existing conditions", "3 years", "2 years"], ["Restore benefit", "Once a year", "Not found"], ["No-claim bonus", "10% a year", "5% a year"], ["Ambulance", "Rs 3,000 per admission", "Rs 2,000 per admission"], ["Grace period", "30 days", "30 days"], ["Cashless hospitals", "8,412", "6,930"]];
    pg.innerHTML = '<div class="rowx" style="justify-content:space-between;align-items:end"><h1 class="d2">Your policies side by side</h1><label class="rowx m" style="gap:12px;cursor:pointer"><input class="sw" type="checkbox" id="od"' + (st === "diff" ? " checked" : "") + '>Only what differs</label></div>' +
      '<div class="glass"><table><thead><tr><th style="width:26%"></th>' + P.map((p) => '<th><span class="d3" style="display:block">' + p.plan + '</span><span style="font-weight:400">' + p.ins + "</span></th>").join("") + '</tr></thead><tbody id="cb">' +
      R.map((r) => '<tr data-same="' + (r[1] === r[2]) + '"><td>' + r[0] + '</td><td class="' + (r[1] === r[2] ? "" : "b") + '">' + r[1] + '</td><td class="' + (r[1] === r[2] ? "" : "b") + '">' + r[2] + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="rowx"><a data-go="stress">Run a hospital bill through them</a></div>';
    const apply = (on) => $$('#cb tr[data-same="true"]', pg).forEach((tr) => { if (on) { tr.className = "out"; setTimeout(() => { if ($("#od", pg) && $("#od", pg).checked) tr.hidden = true; }, 140); } else { tr.hidden = false; tr.className = "in"; } });
    $("#od", pg).onchange = (e) => apply(e.target.checked); if (st === "diff") $$('#cb tr[data-same="true"]', pg).forEach((tr) => (tr.hidden = true));
  } });
