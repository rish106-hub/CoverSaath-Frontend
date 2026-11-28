"use strict";
/* First policy: sign in, welcome, add a policy, what we found, declarations. */

reg("signin", { name: "Sign in", group: "First policy", shell: false,
  states: [["start", "Start"], ["busy", "Signing in"], ["failed", "Google fails"], ["bademail", "Bad email"], ["in", "Signed in"]],
  render(el, st, me) {
    el.innerHTML = '<div class="entry"><div class="l"><a class="brand"><i></i>Knowvia</a>' +
      '<div class="stack l"><p class="d1">Know what your health policy pays, before the bill comes.</p>' +
      '<div class="stack" style="min-height:150px"><p class="q" id="eq"></p><p class="lg m" id="ea" style="max-width:34ch"></p></div></div>' +
      '<p class="rowx"><a data-go="privacy">Privacy</a><a data-go="terms">Terms</a><a data-go="contact">Contact</a></p></div>' +
      '<div class="r glass" data-tilt><h1 class="d2">Sign in</h1>' +
      '<div class="stack"><button class="btn big" id="g" type="button">Continue with Google</button><div class="status" id="gs" role="status"></div></div>' +
      '<form class="stack" id="f" novalidate><label class="field"><span>Your name</span><input type="text" name="n" autocomplete="off"></label>' +
      '<label class="field"><span>Email</span><input type="email" name="e" autocomplete="off"></label><div class="status" id="fs" role="status"></div>' +
      '<div><button class="btn line big" type="submit">Continue with email</button></div></form></div></div>';
    const g = $("#g", el), gs = $("#gs", el), f = $("#f", el), fs = $("#fs", el);
    const google = async (fail) => { busy(g, "Signing in…"); gs.innerHTML = ""; await wait(1300); if (me !== RUN) return;
      if (fail) { idle(g, "Try Google again"); say(gs, "Google sign-in did not finish.", "err"); return; }
      done(g, "Signed in"); say(gs, "You’re in, " + HH.first + ".", "ok"); await wait(900); if (me === RUN) go("welcome"); };
    g.onclick = () => google(false);
    f.onsubmit = async (e) => { e.preventDefault(); const b = $("button", f), em = f.e, nm = f.n;
      if (nm.value.trim().length < 2) { nm.classList.add("bad"); say(fs, "Tell us your name.", "err"); nm.focus(); return; } nm.classList.remove("bad");
      if (!/^\S+@\S+\.\S+$/.test(em.value)) { em.classList.add("bad"); say(fs, "Enter an email like name@company.com.", "err"); em.focus(); return; }
      em.classList.remove("bad"); fs.innerHTML = ""; busy(b, "Signing in…"); await wait(1100); if (me !== RUN) return; done(b, "Signed in"); await wait(700); if (me === RUN) go("welcome"); };
    $$("input", f).forEach((i) => i.addEventListener("input", () => { i.classList.remove("bad"); fs.innerHTML = ""; }));
    if (st === "busy") busy(g, "Signing in…");
    if (st === "failed") google(true);
    if (st === "in") { done(g, "Signed in"); say(gs, "You’re in, " + HH.first + ".", "ok"); }
    if (st === "bademail") { f.n.value = "Aarav"; f.e.value = "aarav@menon"; f.requestSubmit(); }
    const ex = [["Is knee replacement covered?", "Yes. The two-year wait ended on 14 March 2026. Policy terms, page 14."], ["Who pays for a Rs 4,50,000 bill?", "Your insurer pays all of it. You pay nothing."], ["Which hospitals near 560038 are cashless?", "Six within five kilometres. Lakeside Multispeciality is the nearest."], ["I am switching jobs. What happens to my cover?", "TeamCare Group ends on your last day. Shield One stays, with all waiting periods served."]];
    (async () => { let i = 0; const q = $("#eq", el), a = $("#ea", el); while (me === RUN && q.isConnected) { q.textContent = ex[i][0]; q.style.animation = "none"; void q.offsetWidth; q.style.animation = ""; a.textContent = "";
      await wait(500); if (!(await stream(a, ex[i][1], me, 46))) return; await wait(2600); i = (i + 1) % ex.length; if (reduce()) return; } })();
  } });

reg("welcome", { name: "Welcome", group: "First policy", shell: false,
  render(el) {
    el.innerHTML = '<div class="solo page" style="padding:60px"><a class="brand"><i></i>Knowvia</a><div class="bento" style="align-items:center"><div class="c7 stack l"><h1 class="d1">You’re in, ' + HH.first + '.</h1>' +
      '<p class="lg m measure">Add your policy and Knowvia reads it for you. It takes about a minute.</p>' +
      '<div class="rowx"><button class="btn big" data-go="add" type="button">Add my policy</button></div>' +
      '<ol class="rowx md" style="gap:14px 44px;margin-top:28px"><li><b class="acc">1</b>&ensp;Add your policy</li><li><b>2</b>&ensp;Add your family</li><li><b>3</b>&ensp;See what you would pay</li></ol></div><div class="c5 float">' + ART.doc + '</div></div></div>';
  } });

const ADD_STEPS = ["Sending your PDF", "Safety check", "Reading the pages", "Pulling out cover details", "Finding your plan"];
reg("add", { focus: 0, name: "Add a policy", group: "First policy", crumb: ["My cover", "Add a policy"], nodock: true,
  states: [["start", "Drop a PDF"], ["drag", "File over the page"], ["allow", "Allow reading"], ["reading", "Reading"], ["failed", "Reading fails"], ["plan", "Which plan"], ["done", "Added"]],
  render(pg, st, me) {
    const file = "sahyadri-policy-schedule.pdf";
    if (st === "start" || st === "drag") {
      pg.innerHTML = '<h1 class="d2">Add a policy</h1>' +
        '<div class="stack"><p class="h">Type of policy</p><div class="seg" id="ty">' + ["Personal health", "Group health", "Term life", "Other"].map((t, i) => '<button type="button" aria-pressed="' + (i === 0) + '">' + t + "</button>").join("") + "</div></div>" +
        '<div class="drop glass bento" id="dz" style="margin:0;padding:40px;align-items:center"><div class="c7 stack"><p class="d3">Drop the policy schedule anywhere on this page.</p><p class="md">PDF, up to 4 MB. The schedule is the page that lists who is covered, the sum insured and the dates.</p>' +
        '<div class="rowx"><button class="btn big" id="ch" type="button">Choose a PDF</button></div><div class="status" id="s" role="status"></div></div><div class="c5 float">' + ART.doc + '</div></div>';
      $("#ty", pg).onclick = (e) => { const b = e.target.closest("button"); if (b) $$("button", $("#ty", pg)).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); };
      const dz = $("#dz", pg);
      $("#ch", pg).onclick = () => go("add", "allow");
      if (st === "drag") { dz.classList.add("over-it"); $(".d3", dz).textContent = "Let go to add " + file; }
      ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over-it"); }));
      dz.addEventListener("dragleave", () => dz.classList.remove("over-it")); dz.addEventListener("drop", (e) => { e.preventDefault(); go("add", "allow"); });
    } else if (st === "allow") {
      pg.innerHTML = '<p class="md m">' + file + ' · 2.1 MB · 24 pages</p><h1 class="d1" style="max-width:16ch">Read this policy and find my cover.</h1>' +
        '<div class="rowx"><button class="btn big" id="ok" type="button">Read my policy</button><button class="btn txt" data-go="add/start" type="button">Choose another PDF</button></div>' +
        '<div class="status" id="s" role="status"></div><p><a data-go="privacy">How Knowvia handles your file</a></p>';
      $("#ok", pg).onclick = async (e) => { busy(e.target, "Starting…"); await wait(800); if (me === RUN) go("add", "reading"); };
    } else if (st === "reading" || st === "failed") {
      pg.innerHTML = '<div class="stack"><p class="md m">' + file + '</p><h1 class="d2" id="hd">Reading your policy</h1></div>' +
        '<div class="stack glass" style="max-width:760px"><div class="bar"><i id="fill"></i></div>' +
        '<ol class="steps" id="st">' + ADD_STEPS.map((t) => '<li class="wait"><span class="mk"></span><span>' + t + "</span></li>").join("") + '</ol><div class="status" id="s" role="status"></div><div class="rowx" id="acts"></div></div>';
      const li = $$("#st li", pg), fill = $("#fill", pg), s = $("#s", pg);
      (async () => { for (let i = 0; i < li.length; i++) { if (me !== RUN) return; li[i].className = "now"; $(".mk", li[i]).innerHTML = '<span class="pulse"></span>'; fill.style.transform = "scaleX(" + (i + 0.6) / 5 + ")";
          await wait(i === 2 ? 1700 : 950); if (me !== RUN) return;
          if (st === "failed" && i === 2) { fill.style.background = "var(--fail)"; $(".mk", li[i]).innerHTML = '<b style="color:var(--fail)">!</b>'; $("#hd", pg).textContent = "This PDF could not be read";
            say(s, "It is password protected. Remove the password and add it again.", "err");
            $("#acts", pg).innerHTML = '<button class="btn" data-go="add/start" type="button">Choose another PDF</button><button class="btn txt" data-go="add/reading" type="button">Try again</button>'; return; }
          if (i === 2 && st === "reading") { s.textContent = ""; }
          li[i].className = ""; $(".mk", li[i]).innerHTML = TICK; }
        fill.style.transform = "scaleX(1)"; await wait(500); if (me === RUN) go("add", "plan"); })();
      if (st === "reading") setTimeout(() => { if (me === RUN && s.isConnected && !s.textContent) s.textContent = "A long policy can take a minute or two."; }, 2300);
    } else if (st === "plan") {
      pg.innerHTML = '<div class="stack"><p class="md m">Sahyadri General Insurance</p><h1 class="d1">Is this Shield One?</h1></div>' +
        '<div class="rowx"><button class="btn big" id="yes" type="button">Yes, it is Shield One</button><button class="btn txt" id="no" type="button">Something else</button></div>' +
        '<div class="status" id="s" role="status"></div><div id="more"></div>';
      $("#yes", pg).onclick = async (e) => { busy(e.target, "Checking the insurer’s terms…"); await wait(1500); if (me === RUN) go("add", "done"); };
      $("#no", pg).onclick = () => { $("#more", pg).innerHTML = '<div class="beside" style="max-width:620px"><label class="field"><span>Insurer or plan name</span><input type="search" id="sq" placeholder="For example Family Shield"></label><div class="stack s" id="res"></div></div>';
        const res = $("#res", pg), all = ["Shield One · Sahyadri General", "Family Shield Basic · Sahyadri General", "Individual Shield · Sahyadri General", "TeamCare Group · Northlight Health"];
        const draw = (q) => { const m = all.filter((x) => x.toLowerCase().includes(q.toLowerCase())); res.innerHTML = m.length ? m.map((x, i) => '<label class="opt"><input class="ck" type="radio" name="pl" style="border-radius:50%"' + (i ? "" : " checked") + ">" + x + "</label>").join("") + '<div><button class="btn" data-go="add/done" type="button">Choose this plan</button></div>' : '<p class="err">Nothing matched. Try fewer words.</p>'; };
        draw(""); $("#sq", pg).oninput = (e) => draw(e.target.value); $("#sq", pg).focus(); };
    } else {
      pg.innerHTML = '<div class="stack"><p class="ok md">' + TICK + '<span>Added</span></p><h1 class="d1">Shield One is in.</h1></div>' +
        '<div class="cols3 glass"><div class="fig"><span>Sum insured</span><span class="v" id="si"></span></div><div class="fig"><span>People covered</span><span class="v">1</span></div><div class="fig"><span>Renews</span><span class="v">14 Mar 2027</span></div></div>' +
        '<div class="rowx"><button class="btn big" data-go="review" type="button">Next: confirm what we found</button></div>';
      roll($("#si", pg), 1000000, 900);
    }
  } });

reg("review", { focus: 1, name: "What we found", group: "First policy", crumb: ["My cover", "What we found"],
  states: [["open", "One to decide"], ["settled", "All settled"], ["loading", "Loading"], ["empty", "No policy"]],
  async render(pg, st, me) {
    if (st === "empty") { pg.innerHTML = '<h1 class="d1" style="max-width:18ch">Add your policy and we read it for you.</h1><div><button class="btn big" data-go="add" type="button">Add a policy</button></div>'; return; }
    if (st === "loading") { pg.innerHTML = SK(5); await wait(1600); if (me !== RUN) return; pg.innerHTML = ""; }
    const rows = [["Limits", [["Sum insured", "Rs 10,00,000", "Schedule, page 1", 1], ["Room rent limit", "", "", 2], ["Co-pay", "None", "Terms, page 9", 0], ["Ambulance", "Rs 3,000 per admission", "Terms, page 11", 0]]],
      ["Waiting", [["Initial wait", "30 days", "Terms, page 13", 1], ["Joint, hernia, cataract", "2 years", "Terms, page 14", 0], ["Pre-existing conditions", "3 years", "Schedule, page 2", 0]]],
      ["Money", [["Premium", "Rs 24,860 a year", "Schedule, page 1", 1], ["No-claim bonus", "10% a year, up to 50%", "Terms, page 18", 0]]]];
    const open = st !== "settled";
    pg.innerHTML = '<div class="stack"><h1 class="d2">What we found in your policy</h1><p class="md m" id="cnt"></p></div>' +
      '<section class="glass stack l" id="dec"><span class="sig bad" style="justify-self:start">Two readings do not match</span><h2 class="h">Which room rent limit is right?</h2><div class="cols3" style="grid-template-columns:1fr 1fr" id="sides">' +
      [["Your schedule, page 3", "Single private room", "Room category: Single Private A/C Room"], ["Insurer terms, page 12", "1% of sum insured a day", "Room rent up to 1% of the Sum Insured per day"]].map((x, i) =>
        '<div class="stack" data-side="' + i + '"><p class="m">' + x[0] + '</p><p class="d3">' + x[1] + '</p><p class="quote">“' + x[2] + '”</p><div><button class="btn line" type="button" data-pick="' + i + '">This one is right</button></div></div>').join("") + '</div><div class="status" id="ds" role="status"></div></section>' +
      rows.map(([g, list]) => '<section class="glass stack"><h2 class="h">' + g + '</h2><div class="kv3">' + list.map(([k, v, src, s]) =>
        "<span>" + k + '</span><span class="stack s" style="align-items:start;justify-content:center;gap:2px"><span class="' + (s === 1 || (s === 2 && !open) ? "sure" : "unsure") + '" data-val="' + k + '">' + (s === 2 ? (open ? "Two readings" : "Single private room") : v) + '</span><span class="sm">' + (s === 2 ? (open ? "" : "You chose this") : src) + "</span></span>" +
        "<span>" + (s === 1 || (s === 2 && !open) ? TICK : s === 2 ? '<a href="#" data-top>Decide above</a>' : '<button class="btn txt acc" type="button" data-cf>Confirm</button>') + "</span>").join("") + "</div></section>").join("") +
      '<div class="rowx"><button class="btn big" data-go="declarations" type="button">Next: about your family</button><button class="btn txt" data-go="home" type="button">Skip to my cover</button></div>';
    const count = () => { const n = $$(".unsure", pg).length; $("#cnt", pg).textContent = n ? n + (n === 1 ? " detail is" : " details are") + " waiting for you to confirm." : "Every detail is confirmed."; };
    if (!open) $("#dec", pg).remove(); count();
    pg.addEventListener("click", async (e) => { const c = e.target.closest("[data-cf]"), p = e.target.closest("[data-pick]");
      if (e.target.closest("[data-top]")) { e.preventDefault(); $(".scroll", dev).scrollTop = 0; }
      if (c) { c.disabled = true; c.textContent = "Confirming…"; await wait(520); const cell = c.parentNode, v = cell.previousElementSibling.firstChild; v.className = "sure"; cell.innerHTML = TICK; count(); }
      if (p) { const i = +p.dataset.pick, sides = $$("[data-side]", pg); busy(p, "Saving…"); await wait(700); if (me !== RUN) return; done(p, "Chosen");
        sides[1 - i].style.transition = "opacity 240ms"; sides[1 - i].style.opacity = "0.35"; $$("button", sides[1 - i]).forEach((b) => (b.disabled = true));
        say($("#ds", pg), "Room rent limit settled.", "ok"); const v = $('[data-val="Room rent limit"]', pg); v.textContent = i ? "1% of sum insured a day" : "Single private room"; v.className = "sure"; v.nextSibling.textContent = "You chose this"; v.parentNode.nextElementSibling.innerHTML = TICK; count(); } });
  } });

reg("declarations", { focus: 2, name: "Declarations and money", group: "First policy", crumb: ["My cover", "Declarations and money"],
  render(pg, st, me) {
    const sel = (label, opts, id) => '<label class="field"><span>' + label + '</span><select class="in" id="' + id + '">' + opts.map((o) => "<option>" + o + "</option>").join("") + "</select></label>";
    pg.innerHTML = '<div class="stack"><h1 class="d2">Declarations and money</h1><p class="md m measure">Skip this and come back any time. With it, answers about waiting periods and claims fit your family.</p></div>' +
      '<div class="cols3" style="grid-template-columns:1fr 1fr;gap:96px"><form class="stack glass" id="fd"><h2 class="h">What you told the insurer</h2>' +
      sel("Person", HH.people.slice(0, 3).map((p) => p[0]), "dp") + sel("Kind", ["Pre-existing condition", "Past condition", "Habit", "Occupation", "Nominee", "Something else"], "dk") +
      '<label class="field"><span>Details</span><textarea id="dd" rows="3" placeholder="For example thyroid, on medicine since 2019"></textarea></label>' +
      '<div class="stack s"><span class="m" style="font-size:15px">Told the insurer?</span><div class="seg" id="dt">' + ["Yes", "No", "Not sure"].map((t, i) => '<button type="button" aria-pressed="' + (i === 0) + '">' + t + "</button>").join("") + "</div></div>" +
      '<div class="rowx"><button class="btn line" type="submit">Save declaration</button><span class="status" id="ds" role="status"></span></div><table><tbody id="dl"></tbody></table></form>' +
      '<form class="stack glass" id="fp"><h2 class="h">Premium you paid</h2><label class="field"><span>Amount in rupees</span><input type="text" inputmode="numeric" id="pa" value="24860" class="num"></label>' +
      '<label class="field"><span>Paid on</span><input type="text" id="po" value="12 Mar 2026"></label>' + sel("How", ["UPI", "Card", "Net banking", "Cheque", "Cash", "Salary deduction"], "ph") + sel("Through", ["I paid directly", "Through an agent", "My employer", "My bank"], "pv") +
      '<div class="rowx"><button class="btn line" type="submit">Save premium</button><span class="status" id="ps" role="status"></span></div><table><tbody id="pl"></tbody></table></form></div>' +
      '<div class="rowx"><button class="btn big" data-go="home" type="button">Finish and see my cover</button><button class="btn txt" data-go="review" type="button">Back</button></div>';
    $("#dt", pg).onclick = (e) => { const b = e.target.closest("button"); if (b) $$("button", $("#dt", pg)).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); };
    const add = (tb, a, b) => { const tr = document.createElement("tr"); tr.className = "in"; tr.innerHTML = '<td class="b">' + a + "</td><td>" + b + '</td><td class="r"><button class="btn txt" type="button">Remove</button></td>'; tb.prepend(tr);
      $("button", tr).onclick = () => { tr.className = "out"; setTimeout(() => tr.remove(), 140); }; };
    $("#fd", pg).onsubmit = async (e) => { e.preventDefault(); const b = $("[type=submit]", e.target), d = $("#dd", pg), s = $("#ds", pg);
      if (!d.value.trim()) { d.classList.add("bad"); d.style.borderColor = "var(--fail)"; say(s, "Add a few words of detail.", "err"); d.focus(); return; } d.style.borderColor = "";
      s.innerHTML = ""; busy(b, "Saving…"); await wait(800); if (me !== RUN) return; idle(b); add($("#dl", pg), $("#dp", pg).value.split(" ")[0] + ": " + $("#dk", pg).value, d.value.trim()); d.value = ""; say(s, "Saved", "ok"); };
    $("#fp", pg).onsubmit = async (e) => { e.preventDefault(); const b = $("[type=submit]", e.target), a = $("#pa", pg), s = $("#ps", pg), n = +a.value.replace(/[^\d]/g, "");
      if (!n) { a.classList.add("bad"); say(s, "Enter the amount you paid.", "err"); a.focus(); return; } a.classList.remove("bad");
      s.innerHTML = ""; busy(b, "Saving…"); await wait(800); if (me !== RUN) return; idle(b); add($("#pl", pg), rs(n), $("#po", pg).value + " · " + $("#ph", pg).value); say(s, "Saved", "ok"); };
    add($("#dl", pg), "Suresh: Pre-existing condition", "Type 2 diabetes, on medicine since 2018");
  } });
