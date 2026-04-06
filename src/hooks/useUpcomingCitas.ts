import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface UpcomingCita {
  id: string;
  titulo: string | null;
  tipo: string | null;
  fecha_inicio: string;
  clientes: { id: string; nombre: string; apellidos: string | null } | null;
}

export function useUpcomingCitas(limit = 5) {
  const [citas, setCitas] = useState<UpcomingCita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("citas")
        .select(
          "id, titulo, tipo, fecha_inicio, clientes(id, nombre, apellidos)"
        )
        .gte("fecha_inicio", nowIso)
        .order("fecha_inicio", { ascending: true })
        .limit(limit);

      if (cancelled) return;
      if (error) setError(error.message);
      else setCitas((data ?? []) as unknown as UpcomingCita[]);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { citas, loading, error };
}
