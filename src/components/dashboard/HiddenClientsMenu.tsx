import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import type { Client } from '../../lib/supabase';

interface HiddenClientsMenuProps {
  hiddenClients: Client[];
  onShow: (clientId: string) => void;
}

export function HiddenClientsMenu({ hiddenClients, onShow }: HiddenClientsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (hiddenClients.length === 0) return null;

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}
      >
        <EyeOff size={13} />
        {hiddenClients.length} oculta{hiddenClients.length !== 1 ? 's' : ''}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' } as Transition}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30,
              width: 260, maxHeight: 320, overflowY: 'auto',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)',
              padding: 8,
            }}
          >
            <p style={{
              margin: '4px 8px 8px', fontSize: '0.56rem', fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700,
            }}>
              Empresas ocultas
            </p>
            {hiddenClients.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 8px', borderRadius: 8,
                }}
              >
                <span style={{
                  fontSize: '0.76rem', color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                }}>
                  {c.name}
                </span>
                <button
                  type="button"
                  onClick={() => onShow(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    padding: '5px 9px', borderRadius: 6,
                    background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)',
                    color: 'var(--cyan)', fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace',
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={11} />
                  Mostrar
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
