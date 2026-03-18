import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, getClientByIdOrSlug, listClients } from '../services/clients';
import {
  isSupabaseConfigured,
  type Client,
  type ClientInput,
  type ServiceMutationResult,
} from '../lib/supabase';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevDataRef = useRef<Client[] | null>(null);

  const load = useCallback(async () => {
    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await listClients();
      prevDataRef.current = data;
      setClients(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los clientes.';
      setError(message);
      if (!prevDataRef.current) setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: ClientInput): Promise<ServiceMutationResult<Client>> => {
      setSaving(true);
      const result = await createClient(input);
      if (result.data) {
        await load();
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
      setSaving(false);
      return result;
    },
    [load],
  );

  return {
    clients,
    loading,
    saving,
    error,
    reload: load,
    createClient: create,
    isConfigured: isSupabaseConfigured,
  };
}

export function useClient(identifier?: string) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevDataRef = useRef<Client | null>(null);

  const load = useCallback(async () => {
    if (!identifier) {
      setClient(null);
      setLoading(false);
      return;
    }

    if (!prevDataRef.current) setLoading(true);
    try {
      const data = await getClientByIdOrSlug(identifier);
      prevDataRef.current = data;
      setClient(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el cliente.';
      setError(message);
      if (!prevDataRef.current) setClient(null);
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    client,
    loading,
    error,
    reload: load,
    isConfigured: isSupabaseConfigured,
  };
}
