import type { AccountStatus } from "../utils/calculations";

type StatusPillProps = {
  status: AccountStatus;
};

const statusClass: Record<AccountStatus, string> = {
  "Sin Data": "status-gray",
  "Sin Ventas Reportadas": "status-gray",
  "Alto Rendimiento": "status-green",
  "Rentable - Optimizable": "status-blue",
  "Margen Bajo": "status-amber",
  "No Rentable": "status-red",
};

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill ${statusClass[status]}`}>{status}</span>;
}
