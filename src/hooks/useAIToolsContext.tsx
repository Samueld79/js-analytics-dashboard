import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { type BrandKit, getBrandKitByClient } from '../services/aiToolsService';
import { useClients } from './useClients';
import type { Client } from '../lib/supabase';

type AIToolsContextValue = {
  clients: Client[];
  clientsLoading: boolean;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  kit: BrandKit | null;
  kitLoading: boolean;
  reloadKit: () => Promise<void>;
};

const AIToolsContext = createContext<AIToolsContextValue | null>(null);

export function AIToolsProvider({ children }: { children: ReactNode }) {
  const { clients, loading: clientsLoading } = useClients();
  const [selectedClientId, setSelectedClientIdRaw] = useState<string | null>(() => {
    try { return window.localStorage.getItem('aitools:clientId') ?? null; } catch { return null; }
  });
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [kitLoading, setKitLoading] = useState(false);

  const setSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientIdRaw(id);
    try {
      if (id) window.localStorage.setItem('aitools:clientId', id);
      else window.localStorage.removeItem('aitools:clientId');
    } catch { /* ignore */ }
  }, []);

  const reloadKit = useCallback(async () => {
    if (!selectedClientId) { setKit(null); return; }
    setKitLoading(true);
    try {
      const data = await getBrandKitByClient(selectedClientId);
      setKit(data);
    } finally {
      setKitLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => { void reloadKit(); }, [reloadKit]);

  // Auto-select first client if none stored and clients are loaded
  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId, setSelectedClientId]);

  return (
    <AIToolsContext.Provider value={{
      clients,
      clientsLoading,
      selectedClientId,
      setSelectedClientId,
      kit,
      kitLoading,
      reloadKit,
    }}>
      {children}
    </AIToolsContext.Provider>
  );
}

export function useAITools(): AIToolsContextValue {
  const ctx = useContext(AIToolsContext);
  if (!ctx) throw new Error('useAITools must be used inside AIToolsProvider');
  return ctx;
}
