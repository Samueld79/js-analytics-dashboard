import { useState } from 'react';
import { DueSoonList } from './DueSoonList';
import { UpcomingTimeline } from './UpcomingTimeline';
import type { DueItem } from './types';

interface Props {
  dueNowItems: DueItem[];
  next7Items: DueItem[];
  todayIso: string;
  onRequestInvoice: (item: DueItem) => void;
}

type Tab = 'now' | 'week';

// Una sola tarjeta con pestañas para "Por cobrar ahora" y "Próximos 7
// días" — antes eran dos tarjetas separadas.
export function DueTabsCard({ dueNowItems, next7Items, todayIso, onRequestInvoice }: Props) {
  const [tab, setTab] = useState<Tab>('now');

  return (
    <div className="card-glass card-padded" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <button
          className={tab === 'now' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.66rem', padding: '5px 10px' }}
          onClick={() => setTab('now')}
        >
          Por cobrar ahora
        </button>
        <button
          className={tab === 'week' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.66rem', padding: '5px 10px' }}
          onClick={() => setTab('week')}
        >
          Próximos 7 días
        </button>
      </div>
      <p style={{ margin: '6px 0 12px', fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
        Mes actual, independiente del selector de arriba
      </p>

      <div style={{ flex: 1 }}>
        {tab === 'now' ? (
          <DueSoonList items={dueNowItems} todayIso={todayIso} onRequestInvoice={onRequestInvoice} />
        ) : (
          <UpcomingTimeline items={next7Items} todayIso={todayIso} />
        )}
      </div>
    </div>
  );
}
