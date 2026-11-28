"use strict";
/* Family, money, tools, emergency, account, payment, system and public text screens. */
const segOn = (root, sel, fn) => { $(sel, root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $$("button", $(sel, root)).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (fn) fn(b.textContent, b); }; };
const seg = (id, opts, on) => '<div class="seg" id="' + id + '">' + opts.map((t, i) => '<button type="button" aria-pressed="' + (i === (on || 0)) + '">' + t + "</button>").join("") + "</div>";

reg("family", { name: "People", group: "My family", crumb: ["My family", "People"], know: ["d80", "ped", "lastday"],
  states: [["list", "Household"], ["add", "Adding someone"], ["noname", "Name missing"]],
  render(pg, st, me) {
    const row = (p, cls) => '<div class="rowx ' + (cls || "") + '" style="flex-wrap:nowrap;gap:16px;padding:14px 0;border-top:1px solid var(--rule)"><span class="av">' + p[0][0] + '</span><span style="flex:1"><b class="md">' + p[0] + "</b><br>" + p[1] + (p[2] ? ", " + p[2] : "") + '</span><span style="text-align:right"><b class="num">' + (p[4] ? rs(p[4]) : '<span class="sig bad">Not covered yet</span>') + "</b><br>" + (p[3] || "") + "</span></div>";
    pg.innerHTML = '<div class="rowx" style="justify-content:space-between;align-items:end"><h1 class="d2">Your household</h1><button class="btn" id="ad" type="button">Add family member</button></div>' +
      '<div class="bento"><section class="glass c7 stack s" id="ppl"><h2 class="h" style="padding-bottom:10px">3 people · ' + rs(1500000) + " of cover</h2>" + HH.people.map((p) => row(p)).join("") + "</section>" +
      '<div class="c5" id="side"><div class="float" style="padding:0 30px">' + ART.fam + "</div></div></div>";
    const side = $("#side", pg), ppl = $("#ppl", pg);
    const open = () => { side.innerHTML = '<form class="glass stack beside" id="af" novalidate><h2 class="d3">Who are you adding?</h2>' + seg("rel", ["Spouse", "Child", "Mother", "Father", "Sibling", "Someone else"], 0).replace('class="seg"', 'class="seg" style="flex-wrap:wrap"') +
        '<label class="field"><span>Name</span><input type="text" id="nm" autocomplete="off"></label><div class="status" id="as" role="status"></div><div class="rowx"><button class="btn" type="submit">Add to household</button><button class="btn txt" type="button" id="cl">Close</button></div></form>';
      segOn(pg, "#rel"); $("#cl", pg).onclick = () => go("family", "list"); $("#nm", pg).focus();
      $("#af", pg).onsubmit = async (e) => { e.preventDefault(); const nm = $("#nm", pg), b = $("[type=submit]", e.target), s = $("#as", pg);
        if (nm.value.trim().length < 2) { nm.classList.add("bad"); say(s, "Enter a name.", "err"); nm.focus(); return; } nm.classList.remove("bad"); s.innerHTML = "";
        busy(b, "Adding…"); await wait(900); if (me !== RUN) return; const rel = $('#rel [aria-pressed="true"]', pg).textContent;
        ppl.insertAdjacentHTML("beforeend", row([nm.value.trim(), rel, "", "Add them to a policy", 0], "in")); ppl.lastChild.style.animation = "rise 240ms var(--enter) both";
        $("h2", ppl).textContent = "4 people · " + rs(1500000) + " of cover"; done(b, "Added"); await wait(700); if (me !== RUN) return;
        side.innerHTML = '<div class="glass stack beside"><p class="ok md">' + TICK + "<span>" + nm.value.trim() + ' is in your household.</span></p><p>They are not on a policy yet.</p><div><button class="btn line" data-go="pay" type="button">Add a policy for them</button></div></div>'; }; };
    $("#ad", pg).onclick = open; if (st !== "list") open(); if (st === "noname") $("#af", pg).requestSubmit();
  } });

reg("memory", { name: "Cover memory", group: "My family", crumb: ["My family", "Cover memory"],
  states: [["ready", "Ready"], ["loading", "Loading"]],
  async render(pg, st, me) {
    if (st === "loading") { pg.innerHTML = '<div class="glass">' + SK(6) + "</div>"; await wait(1500); if (me !== RUN) return; }
    const S = [["Who is covered", [["Aarav is covered by both policies, for Rs 15,00,000 in all.", "Policy schedules"], ["Latha and Suresh are covered by TeamCare Group only, for Rs 5,00,000 shared.", "TeamCare schedule, page 1"]]],
      ["What you told us", [["Suresh has type 2 diabetes and has taken medicine since 2018.", "You told us"], ["Shield One premium of Rs 24,860 was paid by UPI on 12 Mar 2026.", "You told us"]]],
      ["Waiting periods", [["Shield One has served two of three waits. The pre-existing wait ends 14 Mar 2027.", "Terms, page 13"], ["TeamCare Group has no waiting periods.", "Group terms, page 4"]]],
      ["What it does not pay", [["Cosmetic surgery, dental work unless from an accident, spectacles and hearing aids.", "Terms, pages 21 to 22"]]]];
    pg.innerHTML = '<div class="stack s"><h1 class="d2">Cover memory</h1><p class="md m measure">Everything Knowvia knows about your cover, in one place. Answers are built from this.</p></div><div class="bento">' +
      S.map(([h, lines], i) => '<section class="glass stack ' + (i % 2 ? "c5" : "c7") + '" data-tilt><h2 class="h">' + h + "</h2>" + lines.map((l) => '<p class="md">' + l[0] + '<br><a class="sm" data-go="policy/p1">' + l[1] + "</a></p>").join("") + "</section>").join("") + "</div>";
  } });

reg("money", { name: "Premiums and bills", group: "My money", crumb: ["My money", "Premiums and bills"], know: ["d80", "grace"],
  states: [["ready", "Ready"], ["empty", "Nothing yet"]],
  render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<div class="bento" style="align-items:center"><div class="glass c7 stack l"><h1 class="d1">No money activity yet.</h1><p class="lg m">Premiums you record and dues that are expected show here once a policy is read.</p><div><button class="btn big" data-go="add" type="button">Add a policy</button></div></div><div class="c5 float">' + ART.pay + "</div></div>"; return; }
    const M = "JFMAMJJASOND".split(""), V = [0, 0, 24860, 0, 0, 0, 0, 0, 0, 0, 0, 0], N = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    pg.innerHTML = '<h1 class="d2">Premiums and bills</h1><div class="bento">' +
      '<div class="glass tight c4 fig" data-tilt><span>Premiums paid this year</span><span class="v" id="py"></span><span>1 payment recorded</span></div>' +
      '<div class="glass tight c4 fig" data-tilt><span>Paid by your employer</span><span class="v num">Rs 38,400</span><span>TeamCare Group · costs you nothing</span></div>' +
      '<div class="glass tight c4 fig" data-tilt><span>Tax you can save under 80D</span><span class="v num acc">Rs 7,458</span><span>At the 30% slab · <a data-go="tools/80d">Work it out</a></span></div>' +
      '<section class="glass c7 stack"><h2 class="h">Premiums due</h2><table><thead><tr><th>Policy</th><th>Due on</th><th class="r">Amount</th><th class="r"></th></tr></thead><tbody>' +
      '<tr><td class="b">Shield One</td><td>1 Mar 2027 <span class="sig orange" style="margin-left:10px">Due in 93 days</span></td><td class="r b">Rs 24,860</td><td class="r"><button class="btn txt acc" type="button" id="mp">Mark as paid</button></td></tr></tbody></table>' +
      '<h2 class="h" style="margin-top:12px">Paid so far</h2><table><tbody id="paid"><tr><td class="b">Shield One</td><td>12 Mar 2026 · UPI <span class="sig ok" style="margin-left:10px">Paid</span></td><td class="r b">Rs 24,860</td></tr></tbody></table></section>' +
      '<section class="glass c5 stack"><h2 class="h">Premiums by month</h2><div class="cols-m">' + M.map((m, i) => '<button type="button" data-m="' + i + '" aria-pressed="' + (i === 2) + '"><i style="height:' + (V[i] ? 100 : 6) + '%"></i>' + m + "</button>").join("") + '</div><p class="md b" id="ms">Mar · Rs 24,860 paid</p></section></div>';
    roll($("#py", pg), 24860, 800); kick(pg);
    $(".cols-m", pg).onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b) return; $$(".cols-m button", pg).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); const i = +b.dataset.m; $("#ms", pg).textContent = N[i] + " · " + (V[i] ? rs(V[i]) + " paid" : "Nothing paid"); };
    $("#mp", pg).onclick = async (e) => { const b = e.target; b.disabled = true; b.textContent = "Saving…"; await wait(800); if (me !== RUN) return; const td = b.parentNode; td.innerHTML = '<span class="ok">' + TICK + "Paid</span>";
      $("#paid", pg).insertAdjacentHTML("afterbegin", '<tr class="in"><td class="b">Shield One</td><td>28 Nov 2026</td><td class="r b">Rs 24,860</td></tr>'); roll($("#py", pg), 49720, 600); };
  } });

reg("tools", { name: "Calculators", group: "My money", crumb: ["My money", "Calculators"], know: ["d80", "room", "lastday"],
  states: [["80d", "80D tax saving"], ["room", "Room rent check"], ["exit", "Leaving a job"]],
  render(pg, st) {
    const tabs = [["80d", "80D tax saving"], ["room", "Room rent check"], ["exit", "Leaving a job"]];
    pg.innerHTML = '<h1 class="d2">Calculators</h1><div class="tabs" role="tablist">' + tabs.map((t) => '<button class="tab" role="tab" type="button" data-go="tools/' + t[0] + '" aria-selected="' + (t[0] === st) + '">' + t[1] + '</button>').join("") + '</div><div class="bento" id="tb"></div>';
    const tb = $("#tb", pg), num = (id) => +$(id, pg).value.replace(/\D/g, "") || 0;
    const inp = (id, label, v) => '<label class="field"><span>' + label + '</span><input type="text" inputmode="numeric" class="num" id="' + id + '" value="' + v + '"></label>';
    if (st === "room") {
      tb.innerHTML = '<div class="glass c5 stack">' + inp("cv", "Cover amount, in rupees", "5,00,000") + inp("pc", "Room limit, % of cover a day", "1") + inp("rm", "Hospital room, rupees a day", "8,000") + inp("ot", "Other charges on the bill", "2,40,000") + "</div>" +
        '<div class="glass c7 stack l" data-tilt><p class="d3" id="hl"></p><div class="stack s"><div class="rowx" style="justify-content:space-between"><span>Share of other charges the insurer pays</span><b id="sh"></b></div><div class="hbar" style="height:16px;border-radius:8px"><i id="shb" style="border-radius:8px"></i></div></div>' +
        '<div class="cols3"><div class="fig"><span>Room limit a day</span><span class="v" id="el"></span></div><div class="fig"><span>Room offered</span><span class="v" id="ro"></span></div><div class="fig"><span>You may pay yourself</span><span class="v t-bad" id="yp"></span></div></div><a data-go="policy/p2">Check this in TeamCare Group</a></div>';
      const calc = () => { const el = num("#cv") * (parseFloat($("#pc", pg).value) || 0) / 100, rm = num("#rm"), ot = num("#ot"), ratio = rm > el && rm ? el / rm : 1, yp = ot * (1 - ratio) + Math.max(0, rm - el);
        roll($("#el", pg), el); roll($("#ro", pg), rm); roll($("#yp", pg), yp); $("#sh", pg).textContent = Math.round(ratio * 100) + "%"; $("#shb", pg).style.transform = "scaleX(" + ratio + ")";
        $("#hl", pg).textContent = !rm ? "Enter your cover and the room to see the result." : ratio < 1 ? "This room is above your limit. Other charges get cut too." : "This room is within your limit."; };
      $$("input", tb).forEach((i) => (i.oninput = calc)); calc();
    } else if (st === "exit") {
      const Q = [["HR", "On what date does my group cover end?"], ["HR", "Can I move to a personal policy, and by when?"], ["Insurer", "If I move, do the waiting periods I served carry over?"], ["Yourself", "Is a planned treatment due before the last day?"]];
      tb.innerHTML = '<div class="glass c7 stack" data-tilt><h2 class="d3">Group cover usually ends on your last working day.</h2><p class="md m">Ask these before you sign the exit papers.</p>' + Q.map((q, i) => '<label class="opt" style="align-items:start;padding:8px 0"><input class="ck" type="checkbox" style="margin-top:3px"><span><b>' + q[0] + "</b><br>" + q[1] + "</span></label>").join("") + '<div class="status" id="xs" role="status"></div></div>' +
        '<div class="c5 stack"><div class="glass stack"><span>If you left today</span><div class="fig"><span class="v t-bad num">Rs 5,00,000</span></div><span class="md m">of cover would end. Latha and Suresh would have none.</span><span class="hbar" style="height:16px;border-radius:8px"><i data-w="0.667" style="border-radius:8px"></i></span><span>Shield One stays: Rs 10,00,000, for you only.</span></div></div>';
      kick(tb); tb.onchange = () => { const n = $$(".ck:checked", tb).length; say($("#xs", pg), n === 4 ? "All four asked. You are ready to sign." : n + " of 4 asked", n === 4 ? "ok" : ""); };
    } else {
      tb.innerHTML = '<div class="glass c5 stack"><div class="stack s"><span class="m">Your tax regime</span><div>' + seg("rg", ["Old regime", "New regime"]) + "</div></div>" + inp("sf", "Premium for you, spouse and children", "24,860") + inp("pr", "Premium you pay for your parents", "0") +
        '<label class="rowx m" style="gap:12px;cursor:pointer"><input class="sw" type="checkbox" id="sr">A parent is 60 or older</label>' + '<div class="stack s"><span class="m">Your tax slab</span><div>' + seg("sl", ["5%", "20%", "30%"], 2) + "</div></div></div>" +
        '<div class="glass c7 stack l" data-tilt><div class="stack s"><span class="md m">You can declare under 80D</span><span class="d1 num acc" id="td" style="font-family:var(--sans);font-weight:600"></span><p class="md m" id="tn"></p></div>' +
        '<div class="stack"><div class="stack s"><div class="rowx" style="justify-content:space-between"><span>You, spouse, children · limit Rs 25,000</span><b id="t1"></b></div><div class="hbar"><i id="b1"></i></div></div><div class="stack s"><div class="rowx" style="justify-content:space-between"><span id="pl"></span><b id="t2"></b></div><div class="hbar"><i id="b2"></i></div></div></div>' +
        '<div class="fig"><span>Tax saved</span><span class="v" id="ts"></span></div></div>';
      let old = true, slab = 0.3;
      const calc = () => { const cap = $("#sr", pg).checked ? 50000 : 25000, a = Math.min(num("#sf"), 25000), b = Math.min(num("#pr"), cap), t = old ? a + b : 0;
        roll($("#td", pg), t); roll($("#ts", pg), t * slab); $("#t1", pg).textContent = rs(old ? a : 0); $("#t2", pg).textContent = rs(old ? b : 0); $("#pl", pg).textContent = "Parents · limit " + rs(cap);
        $("#b1", pg).style.transform = "scaleX(" + (old ? a / 25000 : 0) + ")"; $("#b2", pg).style.transform = "scaleX(" + (old ? b / cap : 0) + ")";
        $("#tn", pg).textContent = !old ? "Section 80D is not available under the new regime." : num("#sf") > 25000 ? rs(num("#sf") - 25000) + " of your premium is above the limit." : "Premiums your employer pays do not count."; };
      segOn(pg, "#rg", (t) => { old = t === "Old regime"; calc(); }); segOn(pg, "#sl", (t) => { slab = parseInt(t) / 100; calc(); }); $$("input", tb).forEach((i) => (i.oninput = calc)); calc();
    }
  } });

reg("emergency", { name: "Emergency", group: "Help", crumb: ["Help", "Emergency"], nodock: true, know: ["sos", "cashless"],
  render(pg) {
    pg.style.animation = "none";
    pg.innerHTML = '<div class="bento"><a class="glass c6 stack" href="tel:112" style="text-decoration:none"><span class="md b">Any emergency</span><span class="sos">112</span><span class="md m">Call now</span></a>' +
      '<a class="glass c6 stack" href="tel:108" style="text-decoration:none"><span class="md b">Ambulance</span><span class="sos warm">108</span><span class="md m">Call now</span></a>' +
      '<section class="glass c7 stack"><h2 class="h">Nearest cashless hospitals to 560038</h2><table><tbody>' + HOSP.filter((h) => h[3]).slice(0, 3).map((h) => '<tr><td class="b md">' + h[0] + "</td><td>" + h[1] + '</td><td class="r b">' + h[2] + "</td></tr>").join("") + '</tbody></table><a data-go="hospitals/results">All network hospitals</a></section>' +
      '<section class="glass c5 stack"><h2 class="h">At the hospital desk</h2><ol class="stack md" style="gap:12px"><li><b>1</b>&ensp;Show a policy number and a photo ID.</li><li><b>2</b>&ensp;Ask for cashless and note the request time.</li><li><b>3</b>&ensp;The insurer has one hour to decide.</li></ol><dl class="kv" style="grid-template-columns:auto 1fr"><dt>Shield One</dt><dd>' + P[0].no + "</dd><dt>TeamCare Group</dt><dd>" + P[1].no + "</dd></dl></section></div>";
    $$(".page > *", dev).forEach((x) => (x.style.animation = "none"));
  } });

reg("settings", { name: "Settings", group: "Account", crumb: ["Account", "Settings"],
  render(pg, st, me) {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const row = (t, d, c) => '<div class="rowx" style="justify-content:space-between;flex-wrap:nowrap;padding:14px 0;border-top:1px solid var(--rule)"><span><b class="md">' + t + "</b><br>" + d + '</span><span class="rowx" style="flex-wrap:nowrap"><span class="status" data-s></span>' + c + "</span></div>";
    pg.innerHTML = '<h1 class="d2">Settings</h1><div class="bento"><section class="glass c7 stack s"><h2 class="h" style="padding-bottom:10px">Display</h2>' +
      row("Reduce motion", "Fades only, no movement", '<input class="sw" type="checkbox" id="rm"' + (document.documentElement.dataset.motion === "off" ? " checked" : "") + ">") +
      '<h2 class="h" style="padding:22px 0 10px">Reminders</h2>' + row("Renewal and premium dates", "By email, 30 and 7 days before", '<input class="sw" type="checkbox" checked>') + row("Waiting period ends", "By email, on the day", '<input class="sw" type="checkbox" checked>') +
      '<h2 class="h" style="padding:22px 0 10px">Sharing</h2>' + row("Family view", "People you add can see what you share with them", '<input class="sw" type="checkbox">') + "</section>" +
      '<section class="glass c5 stack" data-tilt><h2 class="h">Account</h2><div class="rowx" style="flex-wrap:nowrap"><span class="av">A</span><span><b class="md">' + HH.name + "</b><br>" + HH.email + '</span></div><div class="rowx"><button class="btn line" id="so" type="button">Sign out</button><a data-go="profile">Your profile</a></div></section></div>';
    $("#rm", pg).onchange = (e) => { document.documentElement.dataset.motion = e.target.checked ? "off" : "on"; };
    pg.addEventListener("change", async (e) => { const w = e.target.closest(".rowx"), s = w && $("[data-s]", w); if (!s) return; s.textContent = "Saving…"; await wait(600); if (me === RUN) say(s, "Saved", "ok"); });
    $("#so", pg).onclick = async (e) => { busy(e.target, "Signing out…"); await wait(800); if (me === RUN) go("signin"); };
  } });

reg("profile", { name: "Your profile", group: "Account", crumb: ["Account", "Your profile"],
  states: [["view", "View"], ["edit", "Editing address"]],
  render(pg, st, me) {
    pg.innerHTML = '<div class="rowx" style="flex-wrap:nowrap;gap:22px"><span class="av" style="width:76px;height:76px;font-size:30px">A</span><div><h1 class="d2">' + HH.name + '</h1><p class="md m">' + HH.email + " · " + HH.work + ", " + HH.city + "</p></div></div>" +
      '<div class="bento"><section class="glass c6 stack" id="adr"></section><section class="glass c6 stack"><h2 class="h">Location</h2><div class="rowx" style="justify-content:space-between"><span><b class="md" id="ls">Not allowed</b><br>Used to find the nearest cashless hospital</span><button class="btn line" id="lb" type="button">Allow location</button></div>' +
      '<h2 class="h" style="margin-top:14px">Places</h2><dl class="kv" style="grid-template-columns:auto 1fr auto"><dt>Home</dt><dd>Indiranagar, 560038</dd><dd><a>Edit</a></dd><dt>Work</dt><dd style="font-weight:400">Not set</dd><dd><a>Add</a></dd></dl></section></div>';
    const adr = $("#adr", pg);
    const view = (saved) => { adr.innerHTML = '<div class="rowx" style="justify-content:space-between"><h2 class="h">Address</h2>' + (saved ? '<span class="ok">' + TICK + "Saved</span>" : "") + '</div><p class="md">14, 3rd Cross, Indiranagar<br>Bengaluru, Karnataka 560038</p><div><button class="btn line" id="ed" type="button">Edit</button></div>'; $("#ed", pg).onclick = edit; };
    const edit = () => { adr.innerHTML = '<h2 class="h">Address</h2><label class="field"><span>Address line 1</span><input type="text" value="14, 3rd Cross, Indiranagar"></label><div class="cols3" style="grid-template-columns:1fr 1fr;gap:16px"><label class="field"><span>City</span><input type="text" value="Bengaluru"></label><label class="field"><span>Pincode</span><input type="text" id="pc" class="num" value="560038" maxlength="6"></label></div><div class="status" id="es" role="status"></div><div class="rowx"><button class="btn" id="sv" type="button">Save address</button><button class="btn txt" id="cn" type="button">Cancel</button></div>';
      $("#cn", pg).onclick = () => view(); $("#sv", pg).onclick = async (e) => { const pc = $("#pc", pg); if (!/^[1-9]\d{5}$/.test(pc.value)) { pc.classList.add("bad"); say($("#es", pg), "Enter a 6-digit pincode that does not start with 0.", "err"); return; } busy(e.target, "Saving…"); await wait(800); if (me === RUN) view(true); }; };
    st === "edit" ? edit() : view();
    $("#lb", pg).onclick = async (e) => { const b = e.target; if (b.textContent === "Turn off") { $("#ls", pg).textContent = "Not allowed"; b.textContent = "Allow location"; return; } busy(b, "Asking your browser…"); await wait(1000); if (me !== RUN) return; idle(b, "Turn off"); $("#ls", pg).textContent = "Allowed · about 1 km, kept for 24 hours"; };
  } });

reg("pay", { name: "Pay Rs 199", group: "Second policy", focus: 0,
  states: [["idle", "Before paying"], ["paid", "Paid"], ["declined", "Bank declines"], ["closed", "Window closed"], ["slow", "Slow to confirm"], ["down", "Razorpay down"]],
  render(pg, st, me) {
    pg.innerHTML = '<div class="bento" style="align-items:center"><div class="glass c7 stack l" data-tilt><span class="pill"><i></i>Your first policy was free</span><h1 class="d1">Add another policy for <span class="acc">Rs 199</span>.</h1><p class="lg m">Paid once, by card or UPI, through Razorpay.</p>' +
      '<div class="rowx"><button class="btn big" id="pb" type="button">Pay Rs 199</button></div><div class="status md" id="ps" role="status"></div></div><div class="c5 float">' + ART.pay + "</div></div>";
    const b = $("#pb", pg), s = $("#ps", pg);
    const finish = async (k) => { const w = $(".rzp-dim", dev); if (w) w.remove(); if (me !== RUN) return;
      if (k === "closed") { idle(b, "Pay Rs 199"); say(s, "Payment window closed.", ""); return; }
      if (k === "declined") { idle(b, "Try again"); say(s, "Your bank declined this card. Use another card or UPI.", "err"); return; }
      busy(b, "Confirming…"); if (k === "slow") { s.innerHTML = '<p class="rowx" style="gap:12px"><span class="pulse"></span>Your bank is taking longer than usual. Checking again.</p>'; await wait(2600); if (me !== RUN) return; }
      await wait(900); if (me !== RUN) return; done(b, "Paid"); say(s, "Rs 199 paid. Opening the upload.", "ok"); await wait(1400); if (me === RUN && curId() === "pay") go("add", "start"); };
    const open = async (auto) => { busy(b, "Opening Razorpay…"); s.innerHTML = ""; await wait(900); if (me !== RUN) return;
      if (st === "down") { idle(b, "Try again"); say(s, "Razorpay did not answer.", "err"); return; }
      b.innerHTML = "Waiting for Razorpay…"; const d = document.createElement("div"); d.className = "rzp-dim";
      d.innerHTML = '<div class="rzp" role="dialog" aria-label="Razorpay"><div class="rowx" style="justify-content:space-between"><b>Razorpay</b><button type="button" id="rx" aria-label="Close" style="border:0;background:none;font-size:22px;cursor:pointer;color:inherit">×</button></div><div style="font:600 34px/1 var(--sans)">₹199</div><div class="rowx" style="flex-wrap:nowrap;gap:20px"><div class="qr"></div><div>Scan with any UPI app, or pay by card.</div></div><button type="button" id="rp" style="height:46px;border:0;border-radius:8px;background:#0d1b3e;color:#fff;font:600 16px var(--sans);cursor:pointer">Pay ₹199</button></div>';
      $(".main", dev).appendChild(d); $("#rx", d).onclick = () => finish("closed"); $("#rp", d).onclick = async (e) => { e.target.textContent = "Processing…"; await wait(1000); finish(st === "declined" ? "declined" : st === "slow" ? "slow" : "ok"); };
      if (auto) { await wait(1300); if (me !== RUN) return; st === "closed" ? finish("closed") : $("#rp", d).click(); } };
    b.onclick = () => open(false); if (st !== "idle") open(true);
  } });

reg("palette", { name: "Search and jump (⌘K)", group: "Everywhere", nav: "home", crumb: ["My cover", "Overview"],
  render(pg, st, me) { SC.home.render(pg, "ready", me); setTimeout(() => { if (me === RUN) palette(); }, 500); } });

reg("system", { name: "When things go wrong", group: "Everywhere", shell: false,
  states: [["down", "Not answering"], ["crash", "Page did not load"], ["expired", "Signed out"], ["phone", "On a phone"]],
  render(el, st) {
    const T = { down: ["Knowvia is not answering.", "Nothing is lost. This page will load when the service is back.", "Try again"], crash: ["This page did not load.", "The rest of Knowvia is working.", "Try again"], expired: ["Sign in again.", "You were signed out after a long break.", "Sign in"], phone: ["Open Knowvia on a laptop.", "Sign in there with the same account. Your cover is waiting.", ""] }[st];
    el.innerHTML = '<div class="solo"><a class="brand"><i></i>Knowvia</a><div class="bento" style="align-items:center;width:100%"><div class="glass c7 stack l"><h1 class="d1">' + T[0] + '</h1><p class="lg m">' + T[1] + "</p>" + (T[2] ? '<div class="rowx"><button class="btn big" id="tb" type="button">' + T[2] + '</button><a data-go="home">Go to my cover</a></div><div class="status" id="ts" role="status"></div>' : "") + '</div><div class="c5 float">' + ART.lap + "</div></div></div>";
    const b = $("#tb", el); if (b) { let n = 0; b.onclick = async () => { const me = RUN; if (st === "expired") return go("signin"); busy(b, "Trying…"); $("#ts", el).innerHTML = ""; await wait(1300); if (me !== RUN) return; if (!n++) { idle(b, "Try again"); say($("#ts", el), "Still no answer.", "err"); } else go("home"); }; }
  } });

const legal = (id, name, body) => reg(id, { name: name, group: "Public text", shell: false, render(el) {
  el.innerHTML = '<div style="padding:44px 72px;max-width:1100px;margin:0 auto" class="stack l"><div class="rowx" style="justify-content:space-between"><a class="brand" data-go="signin"><i></i>Knowvia</a><a data-go="signin">Back</a></div><article class="glass prose" style="max-width:none;padding:48px 56px"><h1 class="d1">' + name + "</h1>" + body + '</article><p class="rowx"><span>© 2026 Knowvia</span><a data-go="privacy">Privacy</a><a data-go="terms">Terms</a><a data-go="contact">Contact</a></p></div>'; } });
legal("privacy", "Privacy", "<h2>What we read</h2><p>The policy files you add, and the answers you give about your family.</p><h2>Who else sees it</h2><p>The services that read and search your documents, named here in full.</p><h2>Leaving</h2><p>Withdraw your go-ahead at any time and what was read is erased.</p><p>The full text for this page comes from the legal review.</p>");
legal("terms", "Terms", "<h2>Using Knowvia</h2><p>Who can use it and what it does.</p><h2>Paying</h2><p>The first policy is free. Each further policy is Rs 199, paid once. Payments are not refunded.</p><h2>Your insurer decides claims</h2><p>Knowvia reads your policy. Your insurer’s wording governs what is paid.</p><p>The full text for this page comes from the legal review.</p>");
legal("contact", "Contact", "<p>Write to us at <a>hello@knowvia.example</a>. A person replies within one working day.</p>");
