"use strict";
/* No-scroll pass: one-screen wizard for adding a policy (source, reading, people, result), a symmetric Home, a short review. */
window.knowStrip = () => { if (dev) $$(".know,.nextbar", dev).forEach((o) => o.remove()); };
SC.declarations.focus = null; SC.declarations.nav = "family"; SUB.family.push(["declarations", "Health details"]);
SC.compare.states = [["diff", "Differences only"], ["all", "Every row"], ["one", "Only one policy"]];
const lg = (k, s) => '<span class="lg0" style="width:' + (s || 44) + "px;height:" + (s || 44) + 'px">' + LOGO[k] + "</span>";
const foot = (back, next) => '<div class="wzf">' + (back ? '<button class="btn line noarrow" data-go="' + back + '" type="button">← Back</button>' : "<span></span>") + '<span class="rowx">' + (next || "") + "</span></div>";
const TIPS = ["An insurer has to decide a cashless request within one hour.", "After five unbroken years, a claim cannot be refused for non-disclosure.", "Group cover from your job usually ends on your last working day."];

reg("add", { name: "Add a policy", group: "First policy",
  focus: (st) => ({ reading: 1, guide: 1, people: 2, done: 3 })[st] || 0,
  states: [["source", "Where is it"], ["drop", "Upload a PDF"], ["gmail", "From Gmail"], ["digilocker", "From DigiLocker"], ["reading", "Reading live"], ["guide", "Locked PDF"], ["people", "Your people"], ["done", "Your cover"]],
  render(pg, st, me) {
    const file = "teamcare-policy-schedule.pdf";
    if (st === "source" || st === "start") {
      const S = [["drop", "pdf", "Upload a PDF", "From this laptop"], ["gmail", "gmail", "Find it in Gmail", "We look only at emails from insurers"], ["digilocker", "digilocker", "Fetch from DigiLocker", "Policies issued to your account"]];
      pg.innerHTML = '<div class="wzb"><h1 class="d1">Where is your policy?</h1><div class="tri">' + S.map((s) => '<button class="src" type="button" data-go="add/' + s[0] + '">' + lg(s[1], 64) + '<b class="d3">' + s[2] + "</b><span>" + s[3] + '</span><span class="go">→</span></button>').join("") + "</div></div>" + foot("home");
    } else if (st === "drop") {
      pg.innerHTML = '<div class="wzb"><h1 class="d1">Drop the policy PDF here.</h1><div class="dropz" id="dz">' + lg("pdf", 72) + '<p class="lg" id="dt">Drag it anywhere on this screen, or</p><button class="btn big" id="ch" type="button">Choose a PDF</button></div><p><a data-go="privacy">How Knowvia handles your file</a></p></div>' + foot("add/source");
      const dz = $("#dz", pg), picked = () => { dz.classList.remove("over-it"); dz.innerHTML = lg("pdf", 72) + '<p class="lg b">' + file + '</p><p>2.1 MB · 24 pages</p><button class="btn big" id="rd" type="button">Read this policy</button>';
        $("#rd", pg).onclick = async (e) => { busy(e.target, "Starting…"); await wait(700); if (me === RUN) go("add", "reading"); }; };
      $("#ch", pg).onclick = picked; ["dragenter", "dragover"].forEach((ev) => pg.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over-it"); }));
      pg.addEventListener("dragleave", () => dz.classList.remove("over-it")); pg.addEventListener("drop", (e) => { e.preventDefault(); picked(); });
    } else if (st === "gmail" || st === "digilocker") {
      const g = st === "gmail", name = g ? "Gmail" : "DigiLocker";
      const rows = g ? [["p2", "Your TeamCare Group policy schedule", "Northlight Health · 3 Aug 2026", file], ["p1", "Shield One renewal: policy document", "Sahyadri General · 12 Mar 2026", "shield-one-policy.pdf"], ["p2", "TeamCare Group e-cards for your family", "Northlight Health · 4 Aug 2026", "e-cards.pdf"]]
        : [["p1", "Shield One health policy", "Sahyadri General · issued 15 Mar 2026", "Insurance policy"], ["p2", "TeamCare Group health policy", "Northlight Health · issued 3 Aug 2026", "Insurance policy"]];
      pg.innerHTML = '<div class="wzb"><div class="rowx" style="gap:18px">' + lg(st, 56) + '<h1 class="d1" id="hh">Connecting to ' + name + '</h1></div><div class="picks" id="pk"><p class="rowx lg"><span class="spin"></span>Opening ' + name + " in a small window</p></div></div>" + foot("add/source", '<button class="btn big" id="nx" type="button" disabled hidden>Read this policy</button>');
      (async () => { await wait(1500); if (me !== RUN) return; $("#hh", pg).textContent = (g ? "3 policy emails" : "2 policies") + " found in " + name; $("#nx", pg).hidden = false;
        $("#pk", pg).innerHTML = rows.map((r, i) => '<label class="pick" style="animation-delay:' + i * 70 + 'ms"><input class="ck" type="radio" name="pk" style="border-radius:50%"' + (i ? "" : " checked") + ">" + lg(r[0], 48) + '<span style="flex:1"><b class="md">' + r[1] + "</b><br>" + r[2] + '</span><span class="b">' + r[3] + "</span></label>").join("");
        $("#nx", pg).disabled = false; $("#nx", pg).onclick = async (e) => { busy(e.target, "Fetching the file…"); await wait(900); if (me === RUN) go("add", "reading"); }; })();
    } else if (st === "reading") {
      const T = ["Uploading your file", "Checking the file is safe", "Reading the pages", "Finding your insurer and plan", "Finding the people covered", "Working out what it pays"];
      pg.innerHTML = '<div class="wzb"><div class="bento" style="align-items:center;gap:56px"><div class="c5">' + ART.doc + '</div><div class="c7 stack l"><div class="stack s"><p class="lg b"><span id="pc">0</span>% · about a minute</p><h1 class="d1" id="now" style="min-height:2.1em">' + T[0] + '</h1><div class="bar" style="height:10px;border-radius:5px"><i id="fill"></i></div></div>' +
        '<div class="stack s"><p class="b">Found so far</p><div class="rowx" id="fnd" style="min-height:112px;align-content:start"></div></div></div></div></div>' +
        '<div class="wzf"><p class="md" id="tip"><b>While you wait.</b> ' + TIPS[0] + "</p><span></span></div>";
      const now = $("#now", pg), fill = $("#fill", pg), fnd = $("#fnd", pg), pc = $("#pc", pg);
      const found = (html) => fnd.insertAdjacentHTML("beforeend", '<span class="chipf">' + html + "</span>");
      const set = (i, p) => { now.textContent = T[i]; now.style.animation = "none"; void now.offsetWidth; now.style.animation = "rise 240ms var(--enter) both"; fill.style.transform = "scaleX(" + p / 100 + ")"; roll(pc, p, 600, (v) => Math.round(v)); };
      (async () => { set(0, 8); await wait(900); if (me !== RUN) return; set(1, 18); await wait(900); if (me !== RUN) return; set(2, 30);
        for (let p = 1; p <= 24; p += 1) { if (me !== RUN) return; now.textContent = "Reading page " + p + " of 24"; fill.style.transform = "scaleX(" + (0.3 + p / 24 * 0.3) + ")"; pc.textContent = Math.round(30 + p / 24 * 30); await wait(90); }
        set(3, 68); await wait(800); if (me !== RUN) return; found(lg("p2", 30) + "Northlight Health"); await wait(350); found("TeamCare Group"); $("#tip", pg).innerHTML = "<b>While you wait.</b> " + TIPS[1];
        await wait(700); if (me !== RUN) return; set(4, 82); await wait(800); if (me !== RUN) return; found("3 people"); await wait(600); if (me !== RUN) return;
        set(5, 94); await wait(700); if (me !== RUN) return; found("Rs 5,00,000 cover"); await wait(350); found("Valid to 2 Aug 2027"); await wait(800); if (me !== RUN) return;
        set(5, 100); now.innerHTML = TICK + " Done"; await wait(800); if (me === RUN) go("add", "people"); })();
    } else if (st === "guide") {
      const G = [["1", "Open the PDF", "Type the password. It is often your date of birth or policy number."], ["2", "Print, then Save as PDF", "This makes a new copy with no lock."], ["3", "Add the new copy here", "Knowvia reads it straight away."]];
      pg.innerHTML = '<div class="wzb"><div class="stack s"><span class="sig warn">One quick fix</span><h1 class="d1">This PDF has a password on it.</h1></div><div class="tri">' + G.map((g) => '<div class="src" style="cursor:default"><span class="n0">' + g[0] + '</span><b class="d3">' + g[1] + "</b><span>" + g[2] + "</span></div>").join("") + "</div></div>" +
        foot("add/source", '<button class="btn line" data-go="add/digilocker" type="button">Fetch it from DigiLocker</button><button class="btn big" data-go="add/drop" type="button">Add the new copy</button>');
    } else if (st === "people") {
      const PP = [["Aarav Menon", "29", "You", "Matches your sign-in name", 1], ["Suresh Menon", "61", "Father", "Same surname, 32 years older", 0], ["Latha Menon", "58", "Mother", "Same surname, 29 years older", 0]], REL = ["You", "Spouse", "Father", "Mother", "Son", "Daughter", "Sibling", "Other"];
      pg.innerHTML = '<div class="wzb"><div class="stack s"><h1 class="d1">3 people are on this policy.</h1><p class="lg">Who are they to you? We guessed. Change any that are wrong.</p></div><div class="stack" style="gap:14px">' +
        PP.map((p, i) => '<div class="prow" data-i="' + i + '"><span class="av" style="width:52px;height:52px;font-size:20px">' + p[0][0] + '</span><span style="width:250px"><b class="md">' + p[0] + "</b><br>Age " + p[1] + " · " + (i ? "Insured member" : "Policyholder") + '</span><span class="rel">' +
          (p[4] ? '<span class="ok b" style="animation:none">' + TICK + "This is you</span>" : REL.slice(1).map((r) => '<button type="button" aria-pressed="' + (r === p[2]) + '">' + r + "</button>").join("")) + '</span><span class="why">' + p[3] + "</span></div>").join("") + "</div></div>" +
        foot("add/source", '<span class="status" id="ps" role="status"></span><button class="btn big" id="sv" type="button">Looks right, save</button>');
      pg.addEventListener("click", (e) => { const b = e.target.closest(".rel button"); if (!b) return; $$("button", b.parentNode).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); b.closest(".prow").querySelector(".why").textContent = "You chose " + b.textContent.toLowerCase(); });
      $("#sv", pg).onclick = async (e) => { busy(e.target, "Saving your family…"); await wait(900); if (me !== RUN) return; done(e.target, "Saved to Family"); await wait(600); if (me === RUN) go("add", "done"); };
    } else {
      pg.innerHTML = '<div class="wzb"><div class="rowx" style="gap:20px">' + lg("p2", 72) + '<div><p class="ok lg" style="animation:none">' + TICK + '<span>Added</span></p><h1 class="d1">TeamCare Group is in.</h1></div></div>' +
        '<div class="quad">' + [["Cover", "Rs 5,00,000"], ["People", "You, Suresh, Latha"], ["Valid to", "2 Aug 2027"], ["You pay on a claim", "10% for parents"]].map((f) => '<div class="fig"><span>' + f[0] + '</span><span class="v">' + f[1] + "</span></div>").join("") + "</div>" +
        '<p class="md">43 details read. Two differed between your schedule and the insurer’s wording, so we used the stricter one. <a data-go="review">See both</a></p></div>' +
        foot("", '<button class="btn line" data-go="add/source" type="button">Add another policy</button><button class="btn big" data-go="home" type="button">Go to my cover</button>');
    }
  } });

reg("review", { name: "Where documents disagreed", group: "First policy", nav: "policies",
  states: [["two", "Two differences"]],
  render(pg, st, me) {
    const D = [["Room rent limit", "1% of sum insured a day", "Insurer’s wording, page 12", "Single private room", "Your schedule, page 3"], ["Co-pay for parents", "10% of each claim", "Insurer’s wording, page 9", "None", "Your schedule, page 2"]];
    pg.innerHTML = '<div class="stack s"><h1 class="d2">Two details differed. We used the stricter one.</h1><p class="lg">41 other details matched. Nothing here needs you unless you know better.</p></div><div class="duo">' +
      D.map((d, i) => '<div class="glass face0 stack" data-d="' + i + '"><b class="md">' + d[0] + '</b><div class="stack s"><span class="rowx" style="gap:10px"><i class="dot ok"></i><span class="d3" data-use>' + d[1] + '</span></span><span data-src>' + d[2] + '</span></div><div class="rowx" style="justify-content:space-between;border-top:1.5px solid var(--rule);padding-top:18px"><span><b data-alt>' + d[3] + "</b><br><span data-asrc>" + d[4] + '</span></span><button class="btn line noarrow" type="button">Use this instead</button></div></div>').join("") + '</div><div class="rowx"><button class="btn big" data-go="policy/p2" type="button">Open the policy</button><a data-go="home">Home</a></div>';
    pg.addEventListener("click", async (e) => { const b = e.target.closest(".duo button"); if (!b) return; const c = b.closest("[data-d]"), sw = (a, z) => { const t = $(a, c).textContent; $(a, c).textContent = $(z, c).textContent; $(z, c).textContent = t; };
      busy(b, "Saving…"); await wait(700); if (me !== RUN) return; sw("[data-use]", "[data-alt]"); sw("[data-src]", "[data-asrc]"); idle(b, "Use this instead"); });
  } });

reg("home", { name: "Home", group: "My cover",
  states: [["ready", "Ready"], ["loading", "Loading"], ["empty", "No policy yet"], ["error", "Not answering"]],
  async render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<div class="halves"><div class="stack l"><p class="lg">Good evening, ' + HH.first + '.</p><h1 class="d1">Start with one policy.</h1><p class="lg">Knowvia reads it and shows what it pays. It takes about a minute.</p><div><button class="btn big" data-go="add/source" type="button">Add a policy</button></div></div><div class="statp"><span class="big0">1 min</span><p class="lg">from a PDF, an email or DigiLocker to a clear answer.</p></div></div>'; return; }
    if (st === "error") return retryView(pg, "Knowvia is not answering.", "Your cover could not be loaded just now.", "home");
    if (st === "loading") { pg.innerHTML = SK(3); await wait(1600); if (me !== RUN) return; }
    pg.innerHTML = '<div class="halves"><div class="stack l" style="align-content:center"><p class="lg">Good evening, ' + HH.first + '.</p><h1 class="d1">You have <span class="acc num" id="tot"></span> of health cover.</h1></div>' +
      '<div class="statp"><span class="big0">4 in 100</span><p class="lg">Indians hold a health policy of their own. You are one of them, and you have a second from your job.</p><p class="b">IRDAI annual report, 2022-23</p></div></div>' +
      '<div class="thirds">' + P.map((p) => '<a class="pcard" data-go="policy/' + p.id + '">' + '<span class="rowx" style="flex-wrap:nowrap;gap:14px">' + lg(p.id, 52) + '<span><b class="md">' + p.plan + "</b><br>" + p.ins + '</span></span><span class="v num">' + rs(p.si) + '</span><span class="rowx" style="gap:10px"><i class="dot ok"></i>Renews ' + p.to + '</span><span class="go">→</span></a>').join("") +
      '<a class="pcard next" data-go="stress/within"><span class="b">Your next step</span><span class="d3">See who pays a Rs 4,50,000 hospital bill.</span><span class="btn" style="align-self:start">Try a bill</span></a></div>';
    if (st === "loading") $("#tot", pg).textContent = rs(1500000); else roll($("#tot", pg), 1500000, 900);
  } });

/* keep long lists inside one screen */
HOSP.length = 5;
