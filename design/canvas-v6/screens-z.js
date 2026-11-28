"use strict";
/* Calmer pass: five places in the rail, one next step on Home, one fact per screen. */
["compare", "stress", "hospitals", "policy"].forEach((id) => (SC[id].nav = "policies")); SC.memory.nav = "family"; SC.tools.nav = "money";
Object.values(SC).forEach((s) => { if (s.know) s.know = s.know.slice(0, 1); });
SC.chat.name = "Ask"; SC.family.name = "Family"; SC.money.name = "Money"; SC.home.name = "Home";

reg("home", { name: "Home", group: "My cover",
  states: [["ready", "Ready"], ["done", "All set up"], ["loading", "Loading"], ["empty", "No policy yet"], ["error", "Not answering"]],
  async render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<div class="bento" style="align-items:center"><div class="c7 stack l"><p class="lg">Good evening, ' + HH.first + '.</p><h1 class="d1">Start with one policy.</h1><p class="lg">Knowvia reads it and shows what it pays. It takes about a minute.</p><div><button class="btn big" data-go="add" type="button">Add a policy</button></div></div><div class="c5">' + ART.doc + "</div></div>"; return; }
    if (st === "error") return retryView(pg, "Knowvia is not answering.", "Your cover could not be loaded just now.", "home");
    if (st === "loading") { pg.innerHTML = SK(3); await wait(1600); if (me !== RUN) return; }
    pg.innerHTML = '<div class="bento" style="align-items:center"><div class="c7 stack l"><p class="lg">Good evening, ' + HH.first + '.</p><h1 class="d1">You have <span class="acc num" id="tot"></span> of health cover.</h1></div>' +
      '<div class="c5 scene" style="height:280px" aria-label="Your cover as two layers"><div class="stack3d" style="animation:none"><div class="slab" style="--i:0;--c:var(--mint)"><b>TeamCare Group</b><span class="num">Rs 5,00,000 · from your job</span></div><div class="slab" style="--i:1;--c:var(--lime)"><b>Shield One</b><span class="num">Rs 10,00,000 · yours</span></div></div></div></div>' +
      (st === "done" ? '<div class="step1" style="box-shadow:inset 0 0 0 2px var(--rule)"><p class="ok lg" style="animation:none">' + TICK + '<span>Everything is set up. Nothing needs you today.</span></p><button class="btn line" data-go="stress" type="button">Try a hospital bill</button></div>'
        : '<div class="step1"><div class="stack s"><span class="sig warn">Needs you · step 3 of 5</span><span class="d3">Decide the room rent limit</span><span>Your schedule and the insurer’s terms say different things. Pick the right one.</span></div><button class="btn big" data-go="review" type="button">Decide now</button></div>') +
      '<div class="cols3"><div class="rowx" style="flex-wrap:nowrap;gap:18px">' + ring(71, "106", "ok") + '<span class="stack s"><span>Days to renewal</span><b class="md">14 Mar 2027</b><span class="sig ok">Nothing to do yet</span></span></div>' +
      '<div class="rowx" style="flex-wrap:nowrap;gap:18px">' + ring(90, "90%") + '<span class="stack s"><span>Pre-existing wait served</span><b class="md">Ends 14 Mar 2027</b><span class="sig warn">Still running</span></span></div>' +
      '<div class="fig"><span>Next premium</span><span class="v num">Rs 24,860</span><span class="sig orange">Due in 93 days</span></div></div>' +
      '<section class="stack"><h2 class="h">Your policies</h2><div class="rows">' + P.map((p) => '<a class="rowb" data-go="policy/' + p.id + '"><span><span class="ttl">' + p.plan + "</span><span>" + p.kind + " · covers " + p.who + '</span></span><span class="num b md">' + rs(p.si) + '</span><span class="go">→</span></a>').join("") + "</div></section>";
    if (st === "loading") $("#tot", pg).textContent = rs(1500000); else roll($("#tot", pg), 1500000, 900); kick(pg);
  } });
