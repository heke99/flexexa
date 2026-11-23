import { customerPortalUrl } from "@/lib/customer-portal-entry";
import type { CustomerSession } from "@/lib/customer-sessions";
import { useEffect, useRef } from "react";

const statuses = {
  pending: "Väntar på start",
  uncertain: "Status behöver stämmas av",
  charging: "Laddar",
  stopping: "Väntar på stopp",
  completed: "Avslutad",
  failed: "Misslyckad",
} as const;
const date = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" });

export type SessionSelection = { accountId: string; accountName: string; sessionId: string | undefined } & (
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "list"; items: CustomerSession[] }
  | { status: "detail"; session: CustomerSession }
);

function SessionTime({ value }: { value: string }) {
  return <time dateTime={value}>{date.format(new Date(value))}</time>;
}

export function CustomerSessionsPanel({ selection, open }: {
  selection: SessionSelection; open: (sessionId?: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { heading.current?.focus(); }, [selection.accountId, selection.sessionId]);

  return <section id="account-sessions" aria-labelledby="account-sessions-title" aria-busy={selection.status === "loading"}>
    <h2 ref={heading} id="account-sessions-title" tabIndex={-1}>{selection.sessionId ? "Laddningsdetaljer" : "Senaste laddningar"}</h2>
    <p>{selection.accountName}</p>
    {selection.status === "loading" && <p role="status">Hämtar laddningar …</p>}
    {selection.status === "error" && <p role="status">{selection.message}</p>}
    {selection.status === "list" && (selection.items.length === 0 ? <p>Det finns inga laddningar att visa på kontot.</p> :
      <ul>{selection.items.map(session => <li key={session.id}>
        <p><strong>{statuses[session.status]}</strong> · <SessionTime value={session.createdAt} /></p>
        <small id={`session-reference-${session.id}`}>Referens {session.id}</small>
        <div><button type="button" className="button" aria-describedby={`session-reference-${session.id}`}
          onClick={() => open(session.id)}>Visa laddning</button></div>
      </li>)}</ul>)}
    {selection.status === "detail" && <dl>
      <dt>Status</dt><dd>{statuses[selection.session.status]}</dd>
      <dt>Registrerad</dt><dd><SessionTime value={selection.session.createdAt} /></dd>
      <dt>Senast uppdaterad</dt><dd><SessionTime value={selection.session.updatedAt} /></dd>
      <dt>Referens</dt><dd>{selection.session.id}</dd>
    </dl>}
    <div className="actions">
      <button type="button" className="button" aria-disabled={selection.status === "loading"}
        onClick={() => { if (selection.status !== "loading") open(selection.sessionId); }}>
        {selection.status === "error" ? "Försök igen" : selection.sessionId ? "Uppdatera laddning" : "Uppdatera laddningar"}
      </button>
      {selection.sessionId && <button type="button" className="button" onClick={() => open()}>Tillbaka till senaste laddningar</button>}
    </div>
    <p><a className="text-link" href={customerPortalUrl("laddhistorik")}>Öppna hela laddhistoriken i kundportalen</a></p>
  </section>;
}
