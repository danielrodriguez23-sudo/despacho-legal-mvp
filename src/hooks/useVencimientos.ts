import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface VencimientoTarea {
  id: string;
  titulo: string;
  prioridad: "baja" | "media" | "alta" | "urgente" | null;
  fecha_vencimiento: string | null;
  estado: string | null;
  expedientes: {
    id: string;
    numero_expediente: string;
    titulo: string;
  } | null;
}

export interface VencimientosData {
  vencidas: VencimientoTarea[];
  hoy: VencimientoTarea[];
  proximos7: VencimientoTarea[];
}

export function useVencimientos() {
  const [data, setData] = useState<VencimientosData>({
    vencidas: [],
    hoy: [],
    proximos7: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const ahora = new Date();
      const finHoy = new Date(ahora);
      finHoy.setHours(23, 59, 59, 999);
      const en7dias = new Date(ahora);
      en7dias.setDate(en7dias.getDate() + 7);
      en7dias.setHours(23, 59, 59, 999);

      const { data: rows, error } = await supabase
        .from("tareas")
        .select(
          `id, titulo, prioridad, fecha_vencimiento, estado,
           expedientes(id, numero_expediente, titulo)`
        )
        .neq("estado", "completada")
        .not("fecha_vencimiento", "is", null)
        .lte("fecha_vencimiento", en7dias.toISOString())
        .order("fecha_vencimiento", { ascending: true });

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const list = (rows ?? []) as unknown as VencimientoTarea[];
      const vencidas: VencimientoTarea[] = [];
      const hoy: VencimientoTarea[] = [];
      const proximos7: VencimientoTarea[] = [];

      list.forEach((t) => {
        if (!t.fecha_vencimiento) return;
        const f = new Date(t.fecha_vencimiento);
        if (f.getTime() < ahora.getTime()) {
          vencidas.push(t);
        } else if (f.getTime() <= finHoy.getTime()) {
          hoy.push(t);
        } else {
          proximos7.push(t);
        }
      });

      setData({ vencidas, hoy, proximos7 });
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, error };
}
