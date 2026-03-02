import { useMemo, useState } from "react";
import type { AccountStatus, ClientMetrics } from "../utils/calculations";
import { formatCop, formatRoas } from "../utils/calculations";
import { StatusPill } from "./StatusPill";

type ClientCardsProps = {
  clients: ClientMetrics[];
};

const copyByStatus: Record<AccountStatus, { diagnosis: string; direction: string }> = {
  "Sin Data": {
    diagnosis:
      "No hay reporte de ventas este mes, así que no podemos medir retorno real. Con datos incompletos, cualquier decisión es una apuesta, no estrategia.",
    direction:
      "Implementar reporte diario/semana de ventas (aunque sea simple). Sin ventas reportadas no hay ROAS, y sin ROAS no se puede optimizar con precisión.",
  },
  "Alto Rendimiento": {
    diagnosis:
      "Cuenta altamente rentable, con señal clara de tracción comercial y una base real para escalar con menor riesgo.",
    direction:
      "Escalar progresivo, refresh creativos y reforzar remarketing para capturar demanda caliente sin deteriorar eficiencia.",
  },
  "Rentable - Optimizable": {
    diagnosis:
      "Rentable y estable, con desempeño sólido y margen claro para mejorar eficiencia y elevar retorno.",
    direction:
      "Redistribuir presupuesto, probar hooks de mayor intención y fortalecer remarketing con oferta y urgencia.",
  },
  "Margen Bajo": {
    diagnosis:
      "Retorno bajo para el esfuerzo invertido; hay señales de desalineación entre objetivo, público y mensaje.",
    direction:
      "Reestructurar por temperatura de audiencia (frío/tibio/caliente), ajustar intención y ejecutar pruebas A/B enfocadas.",
  },
  "No Rentable": {
    diagnosis:
      "No está siendo rentable en el estado actual y requiere corrección inmediata para evitar más pérdida de eficiencia.",
    direction:
      "Pausar escalamiento, revisar objetivo/audiencias/mensaje, aplicar estructura simple 1+1 y validar resultados en 72h.",
  },
};

const namedCopy: Partial<Record<string, { diagnosis: string; direction: string }>> = {
  "Tienda de la Platería": {
    diagnosis:
      "Tienda de la Platería mantiene un retorno sobresaliente y consistente; hay espacio para crecer con disciplina sin deteriorar resultados.",
    direction:
      "Aplicar escalamiento controlado por tramos y mantener eficiencia con seguimiento semanal de costo por resultado y calidad de tráfico.",
  },
  "Libell Joyería": {
    diagnosis:
      "Libell Joyería lidera en volumen y rentabilidad, con señales claras para sostener crecimiento de forma ordenada.",
    direction:
      "Priorizar escalamiento controlado en campañas ganadoras y mantener eficiencia con refresh creativo y remarketing de alta intención.",
  },
  "Empaques y Suministros": {
    diagnosis:
      "Empaques y Suministros es rentable, pero aún por debajo de su potencial por fricción en estructura y mensaje comercial.",
    direction:
      "Ejecutar optimización de estructura y mensaje para mejorar conversión, concentrando presupuesto en los conjuntos con mejor respuesta.",
  },
  "Platería Rossy 2": {
    diagnosis:
      "Platería Rossy 2 requiere corrección inmediata: el retorno actual no sostiene escalamiento sin afectar rentabilidad.",
    direction:
      "No escalar hasta estabilizar. Reordenar campaña con propuesta clara, audiencias de mayor intención y validación en ciclos cortos.",
  },
  Ivalent: {
    diagnosis:
      "Ivalent muestra un desempeño fuerte, impulsado por un contexto de evento comercial favorable para capturar demanda activa.",
    direction:
      "Diseñar continuidad post-evento con remarketing con incentivo para recuperar interesados y sostener ventas en marzo.",
  },
  "Dulce María Collection": {
    diagnosis:
      "Dulce María Collection no cuenta con reporte de ventas y, sin ese dato, no es posible evaluar retorno real ni tomar decisiones sólidas.",
    direction:
      "Prioridad absoluta: implementar reporte de ventas diario/semanal. Sin reporte de ventas no hay base para optimización ni escalamiento.",
  },
};

function getClientCopy(client: ClientMetrics): { diagnosis: string; direction: string } {
  return namedCopy[client.name] ?? copyByStatus[client.status];
}

export function ClientCards({ clients }: ClientCardsProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleClients = useMemo(
    () =>
      clients.filter((client) => client.name.toLowerCase().includes(normalizedSearch)),
    [clients, normalizedSearch],
  );

  return (
    <section className="section-block">
      <div className="section-heading section-row">
        <h2>Vista por cliente</h2>
        <span className="visible-chip">{visibleClients.length} visibles</span>
      </div>
      <div className="client-toolbar card">
        <label htmlFor="clientSearch" className="sr-only">
          Buscar cliente
        </label>
        <input
          id="clientSearch"
          type="search"
          placeholder="Buscar cliente por nombre..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="clients-grid">
        {visibleClients.map((client) => {
          const copy = getClientCopy(client);
          return (
            <article key={client.name} className="card client-card">
              <div className="client-head">
                <h3>{client.name}</h3>
                <p>Febrero 2026</p>
              </div>
              <StatusPill status={client.status} />
              <div className="mini-kpis">
                <div>
                  <span>Inversión</span>
                  <strong>{formatCop(client.investment)}</strong>
                </div>
                <div>
                  <span>Ventas</span>
                  <strong>{formatCop(client.sales)}</strong>
                </div>
                <div>
                  <span>ROAS</span>
                  <strong>{formatRoas(client.roas)}</strong>
                </div>
                <div>
                  <span>Utilidad</span>
                  <strong>{formatCop(client.estimatedProfit)}</strong>
                </div>
              </div>
              <div className="client-copy">
                <h4>Diagnóstico ejecutivo</h4>
                <p>{copy.diagnosis}</p>
                <h4>Dirección para marzo</h4>
                <p>{copy.direction}</p>
              </div>
            </article>
          );
        })}
        {visibleClients.length === 0 ? (
          <article className="card empty-state">
            <h3>Sin coincidencias</h3>
            <p>Prueba con otro nombre de cliente para visualizar su ficha ejecutiva.</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
