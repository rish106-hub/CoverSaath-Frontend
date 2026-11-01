"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adapters, type DocumentItem, type Household } from "@/adapters";
import { GROUPS, PAGES } from "@/lib/ia";
import { useAgent } from "@/components/agent/AgentProvider";
import { useTheme } from "@/components/theme";
import styles from "./palette.module.css";

/** Cmd K / Ctrl K. Go to, Ask Knowvia, Tools, People, Documents, Actions. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, open, submit } = useAgent();
  const router = useRouter();
  const { toggle } = useTheme();
  const [people, setPeople] = useState<Household["members"]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!paletteOpen) return;
    let live = true;
    adapters.household.household().then((h) => live && setPeople(h.members)).catch(() => {});
    adapters.document.list().then((d) => live && setDocs(d)).catch(() => {});
    return () => { live = false; };
  }, [paletteOpen]);

  if (!paletteOpen) return null;
  const go = (href: string) => { setPaletteOpen(false); setQuery(""); router.push(href); };
  const ask = (text: string) => { setPaletteOpen(false); setQuery(""); open(document.querySelector<HTMLElement>("[data-ask-trigger]"), { mode: "text" }); if (text) submit(text); };
  const nav = PAGES.filter((p) => !p.route.includes("["));

  return (
    <div className={styles.scrim} onClick={() => setPaletteOpen(false)}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <Command label="Command palette" loop>
          <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Go to a page, ask, or do something" className={styles.input} />
          <Command.List className={styles.list}>
            <Command.Empty className={styles.empty}>Nothing matches. Press Enter to ask Knowvia.</Command.Empty>
            {GROUPS.map((g) => (
              <Command.Group key={g.id} heading={`Go to · ${g.label}`}>
                {nav.filter((p) => p.group === g.id).map((p) => (
                  <Command.Item key={p.href} value={`go ${g.label} ${p.tab}`} onSelect={() => go(p.href)}>{p.tab}</Command.Item>
                ))}
              </Command.Group>
            ))}
            <Command.Group heading="Go to · More">
              {nav.filter((p) => p.group === null).map((p) => <Command.Item key={p.href} value={`go ${p.tab}`} onSelect={() => go(p.href)}>{p.tab}</Command.Item>)}
            </Command.Group>
            <Command.Group heading="Ask Knowvia">
              <Command.Item value="ask knowvia talk type" onSelect={() => ask("")}>Ask Knowvia</Command.Item>
              {query.trim() ? <Command.Item value={`ask ${query}`} forceMount onSelect={() => ask(query)}>Ask: “{query}”</Command.Item> : null}
            </Command.Group>
            <Command.Group heading="Tools">
              <Command.Item value="tool section 80d calculator" onSelect={() => go("/tools")}>Section 80D calculator</Command.Item>
              <Command.Item value="tool room rent calculator" onSelect={() => go("/tools")}>Room rent calculator</Command.Item>
              <Command.Item value="tool top-up finder" onSelect={() => go("/tools")}>Top-up finder</Command.Item>
              <Command.Item value="tool exit papers checklist" onSelect={() => go("/tools")}>Exit-papers checklist</Command.Item>
            </Command.Group>
            <Command.Group heading="People">
              {people.map((m) => <Command.Item key={m.id} value={`person ${m.name} ${m.relation}`} onSelect={() => go("/family")}>{m.name}</Command.Item>)}
            </Command.Group>
            <Command.Group heading="Documents">
              {docs.map((d) => <Command.Item key={d.id} value={`document ${d.name}`} onSelect={() => go("/policies")}>{d.name}</Command.Item>)}
            </Command.Group>
            <Command.Group heading="Actions">
              <Command.Item value="action add document policy" onSelect={() => go("/welcome/add")}>Add a document</Command.Item>
              <Command.Item value="action emergency" onSelect={() => go("/emergency")}>Emergency</Command.Item>
              <Command.Item value="action switch theme dark light" onSelect={() => { setPaletteOpen(false); toggle(); }}>Switch light and dark</Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
