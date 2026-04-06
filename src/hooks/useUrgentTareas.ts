import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface UrgentTarea {
  id: string;
  titulo: string;
  prioridad: "baja" | "media" | "alta" | "urgente" | null;
  fecha_vencimiento: string | null;
  estado: string | null;
  expedientes: {
    id: string;
    numero_expediente: string;
    titulo: string;
    clientes: { id: string; nombre: string; apellidos: string | null } | null;
  } | null;
}

export function useUrgentTareas(limit = 5) {
  const [tareas, setTareas] = useState<UrgentTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("tareas")
        .select(
          `id, titulo, prioridad, fecha_vencimiento, estado,
           expedientes(id, numero_expediente, titulo,
             clientes(id, nombre, apellidos))`
        )
        .neq("estado", "completada")
        .in("prioridad", ["alta", "urgente"])
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
        .limit(limit);

      if (cancelled) return;
      if (error) setError(error.message);
      else setTareas((data ?? []) as unknown as UrgentTarea[]);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { tareas, loading, error };
}
