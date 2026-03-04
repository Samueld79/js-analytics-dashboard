import type { ClientMetrics } from "../utils/calculations";
import { formatCop, formatInteger, formatRoas } from "../utils/calculations";
import { StatusPill } from "./StatusPill";

type RankingTableProps = {
  clients: ClientMetrics[];
};

export function RankingTable({ clients }: RankingTableProps) {
  return (
    <section className="card section-block ranking-table">
      <div className="section-heading">
        <h2>Ranking de Rentabilidad por Cliente</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="num-col">Inversión</th>
              <th className="num-col">Ventas</th>
              <th className="num-col">ROAS</th>
              <th className="num-col">Utilidad</th>
              <th className="num-col">Mensajes</th>
              <th className="num-col">Costo promedio por conversación</th>
              <th className="num-col">Alcance</th>
              <th className="num-col">Impresiones</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <tr key={client.name} className={index === 0 ? "is-top-row" : undefined}>
                <td>{client.name}</td>
                <td className="num-col">{formatCop(client.investment)}</td>
                <td className="num-col">{formatCop(client.sales)}</td>
                <td className="num-col">{formatRoas(client.roas)}</td>
                <td className="num-col">{formatCop(client.estimatedProfit)}</td>
                <td className="num-col">{formatInteger(client.messages)}</td>
                <td className="num-col">{formatCop(client.cpr)}</td>
                <td className="num-col">{formatInteger(client.reach)}</td>
                <td className="num-col">{formatInteger(client.impressions)}</td>
                <td>
                  <StatusPill status={client.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
