import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface DashboardStats {
  totalClientes: number;
  expedientesAbiertos: number;
  tareasPendientes: number;
  facturasPendientes: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [clientesRes, expedientesRes, tareasRes, facturasRes] =
          await Promise.all([
            supabase.from("clientes").select("*", { count: "exact", head: true }),
            supabase
              .from("expedientes")
              .select("*", { count: "exact", head: true })
              .eq("estado", "abierto"),
            supabase
              .from("tareas")
              .select("*", { count: "exact", head: true })
              .neq("estado", "completada"),
            supabase
              .from("facturas")
              .select("*", { count: "exact", head: true })
              .eq("estado", "pendiente"),
          ]);

        if (cancelled) return;

        const firstError =
          clientesRes.error ||
          expedientesRes.error ||
          tareasRes.error ||
          facturasRes.error;
        if (firstError) throw firstError;

        setStats({
          totalClientes: clientesRes.count ?? 0,
          expedientesAbiertos: expedientesRes.count ?? 0,
          tareasPendientes: tareasRes.count ?? 0,
          facturasPendientes: facturasRes.count ?? 0,
        });
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Error al cargar estadísticas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading, error };
}
