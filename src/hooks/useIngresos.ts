import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface FacturasResumen {
  pagadasCount: number;
  pagadasTotal: number;
  pendientesCount: number;
  pendientesTotal: number;
  vencidasCount: number;
  vencidasTotal: number;
}

export interface MesIngreso {
  key: string; // YYYY-MM
  label: string; // "Ene 2026"
  facturas: number;
  efectivo: number;
  total: number;
}

export interface IngresosData {
  resumen: FacturasResumen;
  meses: MesIngreso[]; // últimos 6, más reciente primero
}

const MESES_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM

const buildLastMonths = (n: number) => {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    out.push({ key, label: `${MESES_ES[m]} ${y}` });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};

export function useIngresos() {
  const [data, setData] = useState<IngresosData>({
    resumen: {
      pagadasCount: 0,
      pagadasTotal: 0,
      pendientesCount: 0,
      pendientesTotal: 0,
      vencidasCount: 0,
      vencidasTotal: 0,
    },
    meses: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const ventana = buildLastMonths(24);
      const mesMasAntiguo = ventana[ventana.length - 1].key + "-01";

      const [fRes, pRes] = await Promise.all([
        supabase
          .from("facturas")
          .select("id, estado, total, fecha_emision, fecha_pago, fecha_vencimiento"),
        supabase
          .from("pagos_efectivo")
          .select("id, fecha, importe")
          .gte("fecha", mesMasAntiguo),
      ]);

      if (cancelled) return;
      if (fRes.error) {
        setError(fRes.error.message);
        setLoading(false);
        return;
      }
      if (pRes.error) {
        setError(pRes.error.message);
        setLoading(false);
        return;
      }

      const facturas = fRes.data ?? [];
      const pagos = pRes.data ?? [];
      const ahora = Date.now();

      const resumen: FacturasResumen = {
        pagadasCount: 0,
        pagadasTotal: 0,
        pendientesCount: 0,
        pendientesTotal: 0,
        vencidasCount: 0,
        vencidasTotal: 0,
      };

      const facturasMensual = new Map<string, number>();

      facturas.forEach((f: any) => {
        const total = Number(f.total) || 0;
        const estado = f.estado as string | null;
        const vencidaImplicita =
          estado === "pendiente" &&
          f.fecha_vencimiento &&
          new Date(f.fecha_vencimiento).getTime() < ahora;

        if (estado === "pagada") {
          resumen.pagadasCount += 1;
          resumen.pagadasTotal += total;
          const fechaRef = f.fecha_pago || f.fecha_emision;
          if (fechaRef) {
            const key = monthKey(fechaRef);
            facturasMensual.set(
              key,
              (facturasMensual.get(key) ?? 0) + total
            );
          }
        } else if (estado === "vencida" || vencidaImplicita) {
          resumen.vencidasCount += 1;
          resumen.vencidasTotal += total;
        } else if (estado === "pendiente") {
          resumen.pendientesCount += 1;
          resumen.pendientesTotal += total;
        }
      });

      const efectivoMensual = new Map<string, number>();
      pagos.forEach((p: any) => {
        if (!p.fecha) return;
        const key = monthKey(p.fecha);
        efectivoMensual.set(
          key,
          (efectivoMensual.get(key) ?? 0) + (Number(p.importe) || 0)
        );
      });

      const meses: MesIngreso[] = ventana.map((m) => {
        const f = facturasMensual.get(m.key) ?? 0;
        const e = efectivoMensual.get(m.key) ?? 0;
        return {
          key: m.key,
          label: m.label,
          facturas: f,
          efectivo: e,
          total: f + e,
        };
      });

      setData({ resumen, meses });
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, error };
}
