import { ClientCards } from "./components/ClientCards";
import { KpiCard } from "./components/KpiCard";
import { RankingTable } from "./components/RankingTable";
import { clients } from "./data/clients";
import { buildClientMetrics, formatCop, formatRoas, sortByRoasDesc } from "./utils/calculations";

function App() {
  const metrics = clients.map(buildClientMetrics);
  const rankedClients = sortByRoasDesc(metrics);

  const totalInvestment = metrics.reduce((acc, client) => acc + client.investment, 0);
  const totalReportedSales = metrics.reduce((acc, client) => acc + (client.sales ?? 0), 0);
  const globalRoas = totalReportedSales / totalInvestment;

  const profitableCount = metrics.filter((client) => client.roas !== null && client.roas > 1).length;
  const lossCount = metrics.filter((client) => client.roas !== null && client.roas <= 1).length;
  const noDataCount = metrics.filter((client) => client.roas === null).length;

  return (
    <div className="page-shell">
      <div className="page-bg" />
      <main className="layout">
        <header className="topbar card">
          <div>
            <p className="brand">J&S Analytics</p>
            <h1>Performance &amp; ROAS Dashboard — Febrero 2026</h1>
          </div>
          <span className="premium-badge">Dark Premium</span>
        </header>

        <section className="card section-block overview-section">
          <div className="section-heading">
            <h2>Overview Agencia</h2>
          </div>
          <div className="kpi-grid">
            <KpiCard label="Inversión total gestionada" value={formatCop(totalInvestment)} />
            <KpiCard label="Ventas totales reportadas" value={formatCop(totalReportedSales)} />
            <KpiCard label="ROAS general" value={formatRoas(globalRoas)} />
            <KpiCard
              label="Estado de cuentas"
              value={`${profitableCount} rentables · ${lossCount} en pérdida`}
              hint={`${noDataCount} sin data`}
            />
          </div>
        </section>

        <section className="card section-block insight">
          <div className="section-heading">
            <h2>Insight estratégico general</h2>
          </div>
          <p>
            Febrero mostró cuentas con retorno muy fuerte y otras que requieren corrección. La
            prioridad para marzo es clara: escalar lo rentable, optimizar lo mejorable y corregir lo
            que hoy pierde dinero.
          </p>
        </section>

        <RankingTable clients={rankedClients} />
        <ClientCards clients={rankedClients} />
      </main>
    </div>
  );
}

export default App;
