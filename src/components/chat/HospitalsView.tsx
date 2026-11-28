"use client";

import { useRef, useState } from "react";
import { adapters } from "@/adapters";
import { errorText } from "@/adapters/documents-contract";
import { PINCODE, type HospitalView } from "@/adapters/chat-contract";
import { PageTitle } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button, Card, Field, Signal } from "@/components/ui";
import { useFit } from "@/components/cover-real/use-fit";
import { codeOf, useHoldings } from "@/components/covers/use-holdings";
import { CoverOptions } from "@/components/covers/holding-label";
import t from "@/components/cover-real/tools.module.css";

/** Network hospitals of one cover, by pincode. The list is the insurer's network as the backend gives it; nothing here ranks or recommends. */
export function HospitalsView({ holding, pincode }: { holding?: string; pincode?: string }) {
  const { holdings, current, select, error: listError } = useHoldings(holding);
  const [pin, setPin] = useState(pincode && PINCODE.test(pincode) ? pincode : "");
  const [found, setFound] = useState<{ pincode: string; list: HospitalView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  // Each row is 62px; as many as the list is tall enough for, between two and eight, so no row is cut by the box.
  const perPage = useFit(listRef, 62, 2, 8);
  const id = current?.id;
  const valid = PINCODE.test(pin);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !valid || busy) return;
    setBusy(true);
    setError(null);
    setPage(0);
    try {
      setFound({ pincode: pin, list: await adapters.covers.hospitals(id, pin) });
    } catch (err) {
      setFound(null);
      setError(codeOf(err));
    } finally {
      setBusy(false);
    }
  }

  const noPolicy = holdings !== null && holdings.length === 0 && !listError;
  const hospitals = found?.list ?? [];
  const pages = Math.max(1, Math.ceil(hospitals.length / perPage));
  // A resize can make pages fewer than the current one; clamp instead of showing an empty list.
  const at = Math.min(page, pages - 1);
  const cashlessCount = hospitals.filter((h) => h.cashless).length;
  return (
    <div className={t.page}>
      <PageTitle>Network hospitals</PageTitle>

      {noPolicy ? <EmptyState title="No policy yet" body="Add your policy and we can show the hospitals in its network." cta="Add a policy" href="/covers/add" /> : null}

      {!noPolicy && id ? (
        <Card style={{ padding: 24 }}>
          <form className={t.find} onSubmit={(e) => void search(e)}>
            <div className={t.pincode}>
              <Field label="Pincode">
                <input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} aria-invalid={pin.length > 0 && !valid} />
              </Field>
            </div>
            {holdings && holdings.length > 1 ? (
              <div className={t.cover}>
                <Field label="Cover">
                  <select value={id} onChange={(e) => { setFound(null); select(e.target.value); }}>
                    <CoverOptions holdings={holdings} />
                  </select>
                </Field>
              </div>
            ) : null}
            <Button type="submit" state={busy ? "busy" : "idle"} busyLabel="Searching" disabled={!valid || busy}>Find hospitals</Button>
          </form>
        </Card>
      ) : null}

      {listError || error ? <p className={t.alert} role="alert">{errorText(error ?? listError ?? "")}</p> : null}

      {!noPolicy && !found && !error && !listError ? <p className={t.lead}>Type a pincode to see which hospitals take your policy without cash.</p> : null}

      {found && hospitals.length === 0 ? <p className={t.line}>No network hospital is listed for this pincode. Try a nearby one.</p> : null}

      {found && hospitals.length > 0 ? (
        <>
          <p className={t.count} data-testid="hospital-count">
            {hospitals.length === 1 ? "1 hospital" : `${hospitals.length} hospitals`} near {found.pincode} · {cashlessCount} cashless
          </p>
          <ul ref={listRef} aria-label="Hospitals" className={t.hlist}>
            {hospitals.slice(at * perPage, at * perPage + perPage).map((h) => {
              const address = [h.address, h.city, h.pincode].filter(Boolean).join(", ");
              return (
                <li key={h.id} className={t.hrow}>
                  <b className={t.hname} data-truncate title={h.name}>{h.name}</b>
                  <span className={t.haddress} data-truncate title={address}>{address}</span>
                  <span data-cashless={h.cashless}>{h.cashless ? <Signal kind="ok">Cashless</Signal> : <Signal kind="warn">Cashless not listed</Signal>}</span>
                </li>
              );
            })}
          </ul>
          {hospitals.length > perPage ? (
            <div className={`${t.pager} ${t.pagerEnd}`}>
              <button type="button" className={t.outline} disabled={at === 0} onClick={() => setPage(at - 1)}>Back</button>
              <p className={t.pageText} role="status">Page {at + 1} of {pages}</p>
              <button type="button" className={t.outline} disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Next</button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
