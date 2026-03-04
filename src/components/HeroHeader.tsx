interface HeroHeaderProps {
  monthLabel: string;
  dataSource: "remote" | "local";
  selectedMonth: string;
  monthOptions: string[];
  getMonthLabel: (month: string) => string;
  onMonthChange: (value: string) => void;
}

export function HeroHeader({
  monthLabel,
  dataSource,
  selectedMonth,
  monthOptions,
  getMonthLabel,
  onMonthChange,
}: HeroHeaderProps) {
  return (
    <header className="topbar card">
      <div className="hero-heading-group">
        <p className="brand">Growth and Strategy By: C&amp;S Company</p>
        <p className="sub-brand">C&amp;S Growth Lab</p>
        <h1>Panel Ejecutivo de Performance y Rentabilidad</h1>
        <p className="subtitle">Corte mensual: {monthLabel}</p>
        <p className="subtitle source-note">Fuente: {dataSource === "remote" ? "Remota" : "Local (fallback)"}</p>
      </div>
      <div className="month-selector-wrap">
        <label htmlFor="monthSelector">Mes de análisis</label>
        <select id="monthSelector" value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)}>
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {getMonthLabel(month)}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
