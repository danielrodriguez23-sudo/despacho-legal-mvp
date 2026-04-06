import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import FacturaDialog from "../components/facturas/FacturaDialog";

type Estado = "pendiente" | "pagada" | "vencida" | "cancelada";
type EstadoFiltro = "todos" | Estado;
type ClienteFiltro = "todos" | string;

interface FacturaRow {
  id: string;
  numero_factura: string;
  cliente_id: string;
  expediente_id: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  base_imponible: number;
  iva_importe: number | null;
  total: number;
  estado: Estado | null;
  concepto: string | null;
  clientes: { id: string; nombre: string; apellidos: string | null } | null;
  expedientes: { id: string; numero_expediente: string; titulo: string } | null;
}

const estadoBadge: Record<Estado, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  pagada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-gray-200 text-gray-600",
};

const estadoLabel: Record<Estado, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const formatEuro = (n: number) =>
  n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatFecha = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

const isVencida = (r: FacturaRow) => {
  if (r.estado === "pagada" || r.estado === "cancelada") return false;
  if (!r.fecha_vencimiento) return false;
  return new Date(r.fecha_vencimiento).getTime() < Date.now();
};

export default function Facturas() {
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [clienteFiltro, setClienteFiltro] = useState<ClienteFiltro>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const fetchFacturas = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("facturas")
      .select(
        `id, numero_factura, cliente_id, expediente_id, fecha_emision,
         fecha_vencimiento, base_imponible, iva_importe, total, estado, concepto,
         clientes(id, nombre, apellidos),
         expedientes(id, numero_expediente, titulo)`
      )
      .order("fecha_emision", { ascending: false });

    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as FacturaRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchFacturas();
  }, []);

  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.clientes) {
        map.set(
          r.clientes.id,
          [r.clientes.nombre, r.clientes.apellidos].filter(Boolean).join(" ")
        );
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (estadoFiltro !== "todos" && r.estado !== estadoFiltro) return false;
      if (clienteFiltro !== "todos" && r.cliente_id !== clienteFiltro)
        return false;
      if (!term) return true;
      const cliente = r.clientes
        ? [r.clientes.nombre, r.clientes.apellidos].filter(Boolean).join(" ")
        : "";
      const haystack = [
        r.numero_factura,
        cliente,
        r.concepto ?? "",
        r.expedientes?.numero_expediente ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, estadoFiltro, clienteFiltro]);

  const stats = useMemo(() => {
    let totalPendiente = 0;
    let totalPagada = 0;
    let totalVencida = 0;
    rows.forEach((r) => {
      const t = Number(r.total) || 0;
      if (r.estado === "pagada") totalPagada += t;
      else if (r.estado === "vencida" || isVencida(r)) totalVencida += t;
      else if (r.estado === "pendiente") totalPendiente += t;
    });
    return { totalPendiente, totalPagada, totalVencida };
  }, [rows]);

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, row: FacturaRow) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la factura ${row.numero_factura}?`)) return;
    const { error } = await supabase.from("facturas").delete().eq("id", row.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchFacturas();
  };

  const handleTogglePagada = async (e: React.MouseEvent, row: FacturaRow) => {
    e.stopPropagation();
    const nuevoEstado: Estado = row.estado === "pagada" ? "pendiente" : "pagada";
    const { error } = await supabase
      .from("facturas")
      .update({
        estado: nuevoEstado,
        fecha_pago:
          nuevoEstado === "pagada" ? new Date().toISOString().split("T")[0] : null,
      })
      .eq("id", row.id);
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    fetchFacturas();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-600 mt-1">
            {rows.length} {rows.length === 1 ? "factura" : "facturas"} en total
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva factura
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-yellow-600" />
          <div>
            <p className="text-xs text-yellow-700 font-semibold uppercase">
              Pendiente
            </p>
            <p className="text-xl font-bold text-gray-900">
              {formatEuro(stats.totalPendiente)}
            </p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Receipt className="w-8 h-8 text-red-600" />
          <div>
            <p className="text-xs text-red-700 font-semibold uppercase">
              Vencido
            </p>
            <p className="text-xl font-bold text-gray-900">
              {formatEuro(stats.totalVencida)}
            </p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
          <div>
            <p className="text-xs text-green-700 font-semibold uppercase">
              Cobrado
            </p>
            <p className="text-xl font-bold text-gray-900">
              {formatEuro(stats.totalPagada)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, concepto..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="pagada">Pagadas</option>
          <option value="vencida">Vencidas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los clientes</option>
          {clientesUnicos.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando facturas...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {rows.length === 0
                ? "Aún no hay facturas. Crea la primera."
                : "No hay facturas que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Número
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Cliente / Expediente
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Emisión
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Vencimiento
                  </th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">
                    Total
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Estado
                  </th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const vencida = isVencida(r);
                  const cliente = r.clientes
                    ? [r.clientes.nombre, r.clientes.apellidos]
                        .filter(Boolean)
                        .join(" ")
                    : "—";
                  const estado = r.estado ?? "pendiente";
                  const rowCls = vencida
                    ? "bg-red-50 hover:bg-red-100"
                    : "hover:bg-gray-50";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleEdit(r.id)}
                      className={`cursor-pointer ${rowCls}`}
                    >
                      <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">
                        {r.numero_factura}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium text-gray-900">{cliente}</div>
                        {r.expedientes && (
                          <div className="text-xs text-gray-500">
                            {r.expedientes.numero_expediente} · {r.expedientes.titulo}
                          </div>
                        )}
                        {r.concepto && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {r.concepto}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatFecha(r.fecha_emision)}
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap ${
                          vencida ? "text-red-700 font-medium" : ""
                        }`}
                      >
                        {formatFecha(r.fecha_vencimiento)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatEuro(Number(r.total) || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge[estado]}`}
                        >
                          {estadoLabel[estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleTogglePagada(e, r)}
                            className={`p-2 rounded-md ${
                              r.estado === "pagada"
                                ? "text-gray-500 hover:bg-gray-100"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                            title={
                              r.estado === "pagada"
                                ? "Marcar como pendiente"
                                : "Marcar como pagada"
                            }
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(r.id);
                            }}
                            className="p-2 rounded-md hover:bg-blue-50 text-blue-600"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, r)}
                            className="p-2 rounded-md hover:bg-red-50 text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FacturaDialog
        isOpen={dialogOpen}
        facturaId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchFacturas}
      />
    </div>
  );
}
