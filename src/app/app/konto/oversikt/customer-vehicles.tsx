import type { CustomerVehiclePage } from "@/lib/customer-vehicles";

export type VehicleSelection = { accountId: string; accountName: string } & (
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; vehicles: CustomerVehiclePage }
);

export function CustomerVehiclesPanel({ selection, retry, loadMore }: {
  selection: VehicleSelection;
  retry: () => void;
  loadMore: (page: CustomerVehiclePage) => void;
}) {
  return <section id="account-vehicles" aria-labelledby="account-vehicles-title" aria-busy={selection.status === "loading"}>
    <h2 id="account-vehicles-title">Mina fordon</h2>
    <p>{selection.accountName}</p>
    {selection.status === "loading" && <p role="status">Hämtar fordon …</p>}
    {selection.status === "error" && <>
      <p role="status">{selection.message}</p>
      <button type="button" className="button" onClick={retry}>Försök igen</button>
    </>}
    {selection.status === "ready" && (selection.vehicles.items.length === 0 ? <p>Det finns inga fordon att visa på kontot.</p> : <>
      <ul>{selection.vehicles.items.map(vehicle => <li key={vehicle.id}>
        <strong>{vehicle.plate}</strong> · {vehicle.country} · {vehicle.verified_at ? "Verifierad" : "Behöver verifieras"}
      </li>)}</ul>
      {selection.vehicles.nextCursor && <button type="button" className="button" onClick={() => loadMore(selection.vehicles)}>
        Visa fler fordon
      </button>}
    </>)}
  </section>;
}
