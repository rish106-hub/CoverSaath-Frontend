"use client";

// The "Who is in your family?" screen of the add-a-policy wizard. It exists as its own component because it is the only step with
// its own data (household members) and its own form; it returns the middle and bottom rows of the wizard frame so the wizard view
// stays a plain switch. Nothing is linked to the policy: the backend stores household members only.
import { useEffect, useState } from "react";
import { adapters } from "@/adapters";
import type { MemberRecord } from "@/adapters/scenarios";
import { Button, Field, InlineStatus } from "@/components/ui";
import s from "./wizard.module.css";

const RELATIONS = ["Spouse", "Son", "Daughter", "Father", "Mother", "Other"] as const;
const SHOWN_ROWS = 4;

export function PeopleStep({ onDone }: { onDone: () => void }) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [listFailed, setListFailed] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<string>("Spouse");
  const [adding, setAdding] = useState(false);
  const [addFailed, setAddFailed] = useState(false);

  useEffect(() => {
    let live = true;
    adapters.members.list().then(
      (list) => { if (live) setMembers(list); },
      () => { if (live) setListFailed(true); },
    );
    return () => { live = false; };
  }, []);

  // The signed-in person is already the policy holder; only the others are listed.
  const others = members.filter((m) => !m.isOwner && !m.isYou);

  async function addPerson() {
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setAddFailed(false);
    try {
      const added = await adapters.members.add({ name: trimmed, relation });
      setMembers((cur) => [...cur, added]);
      setName("");
    } catch {
      // The typed name stays so the person can try again without retyping.
      setAddFailed(true);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className={s.middle}>
        <h1 className={s.h1}>Who is in your family?</h1>
        {listFailed ? <InlineStatus kind="error">We could not load your family. Add people later from Family.</InlineStatus> : null}
        {others.length > 0 ? (
          <ul className={s.people}>
            {others.slice(0, 4).map((m) => (
              <li key={m.id} className={s.person}><b>{m.name}</b>{m.relation ? <span>{m.relation}</span> : null}</li>
            ))}
          </ul>
        ) : null}
        {others.length > SHOWN_ROWS ? <p className={s.note}>and {others.length - SHOWN_ROWS} more</p> : null}
        <div className={s.formRow}>
          <Field label="Name">
            <input type="text" value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Relation">
            <select value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Button variant="outline" size="lg" state={adding ? "busy" : "idle"} busyLabel="Adding" disabled={!name.trim()} onClick={() => void addPerson()}>Add person</Button>
        </div>
        {addFailed ? <InlineStatus kind="error">We could not save that. Try again.</InlineStatus> : null}
      </div>
      <div className={s.bottom}>
        <Button variant="outline" size="lg" onClick={onDone}>Skip for now</Button>
        <Button variant="primary" size="lg" onClick={onDone}>Continue</Button>
      </div>
    </>
  );
}
