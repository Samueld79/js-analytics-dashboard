import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClients();
      setClients(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los clientes.';
      setError(message);
      setClients([]);
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

  const load = useCallback(async () => {
    if (!identifier) {
      setClient(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getClientByIdOrSlug(identifier);
      setClient(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el cliente.';
      setError(message);
      setClient(null);
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
