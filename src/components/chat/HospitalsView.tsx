"use client";

import Link from "next/link";
import { useState } from "react";
import { adapters } from "@/adapters";
import { errorText } from "@/adapters/documents-contract";
import { PINCODE, type HospitalView } from "@/adapters/chat-contract";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { codeOf, useHoldings } from "@/components/covers/use-holdings";
import s from "./chat.module.css";

/** Network hospitals of one cover, by pincode. The list is the insurer's network as the backend gives it; nothing here ranks or recommends. */
export function HospitalsView({ holding, pincode }: { holding?: string; pincode?: string }) {
  const { holdings, current, select, error: listError } = useHoldings(holding);
  const [pin, setPin] = useState(pincode && PINCODE.test(pincode) ? pincode : "");
  const [found, setFound] = useState<{ pincode: string; list: HospitalView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = current?.id;
  const valid = PINCODE.test(pin);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      setFound({ pincode: pin, list: await adapters.covers.hospitals(id, pin) });
    } catch (err) {
      setFound(null);
      setError(codeOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>Network hospitals</PageTitle>
      </div>

      {holdings && holdings.length > 1 ? (
        <label className={s.field}>Cover
          <select value={id} onChange={(e) => { setFound(null); select(e.target.value); }}>
            {holdings.map((h, i) => <option key={h.id} value={h.id}>{`Cover ${i + 1}`}</option>)}
          </select>
        </label>
      ) : null}
      {listError || error ? <p className={s.alert} role="alert">{errorText(error ?? listError ?? "")}</p> : null}

      {holdings && holdings.length === 0 && !listError ? (
        <SectionHeading title="No cover yet">
          <p className={s.quiet}>Add your policy and we can show the hospitals in its network.</p>
          <div className={s.row}><Link className="k-btn" href="/covers/add">Add a cover</Link></div>
        </SectionHeading>
      ) : null}

      {id ? (
        <SectionHeading title="Search by pincode" description="Six digits, as on a postal address.">
          <form className={s.search} onSubmit={(e) => void search(e)}>
            <label className={s.field}>Pincode
              <input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} aria-invalid={pin.length > 0 && !valid} />
            </label>
            <button type="submit" className="k-btn" disabled={!valid || busy}>{busy ? "Searching" : "Find hospitals"}</button>
          </form>
        </SectionHeading>
      ) : null}

      {found ? (
        <SectionHeading title={`Hospitals near ${found.pincode}`}>
          {found.list.length === 0 ? (
            <p className={s.quiet}>No network hospital is listed for this pincode. Try a nearby one.</p>
          ) : (
            <ul className={s.hospitals} aria-label="Hospitals">
              {found.list.map((h) => (
                <li key={h.id} className={s.hospital}>
                  <b>{h.name}</b>
                  {h.address ? <span>{h.address}</span> : null}
                  {h.city || h.pincode ? <span>{[h.city, h.pincode].filter(Boolean).join(" ")}</span> : null}
                  <span data-cashless={h.cashless}>{h.cashless ? "Cashless" : "Cashless not listed"}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionHeading>
      ) : null}

      <div className={s.row}>
        <Link className="k-btn k-btn--secondary" href="/chat">Ask about your cover</Link>
      </div>
    </div>
  );
}
