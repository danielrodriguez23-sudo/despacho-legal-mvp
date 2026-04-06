import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Banknote } from "lucide-react";
import { supabase } from "../lib/supabase";
import PagoEfectivoDialog from "../components/pagos-efectivo/PagoEfectivoDialog";

interface PagoRow {
  id: string;
  cliente_id: string;
  expediente_id: string | null;
  fecha: string;
  importe: number;
  concepto: string | null;
  notas: string | null;
  clientes: { id: string; nombre: string; apellidos: string | null } | null;
  expedientes: { id: string; numero_expediente: string; titulo: string } | null;
}

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

export default function PagosEfectivo() {
  const [rows, setRows] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const fetchPagos = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("pagos_efectivo")
      .select(
        `id, cliente_id, expediente_id, fecha, importe, concepto, notas,
         clientes(id, nombre, apellidos),
         expedientes(id, numero_expediente, titulo)`
      )
      .order("fecha", { ascending: false });

    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as PagoRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPagos();
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
      if (clienteFiltro !== "todos" && r.cliente_id !== clienteFiltro)
        return false;
      if (fechaDesde && r.fecha < fechaDesde) return false;
      if (fechaHasta && r.fecha > fechaHasta) return false;
      if (!term) return true;
      const cliente = r.clientes
        ? [r.clientes.nombre, r.clientes.apellidos].filter(Boolean).join(" ")
        : "";
      const haystack = [
        cliente,
        r.concepto ?? "",
        r.notas ?? "",
        r.expedientes?.numero_expediente ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, clienteFiltro, fechaDesde, fechaHasta]);

  const totalFiltrado = useMemo(
    () => filtered.reduce((acc, r) => acc + (Number(r.importe) || 0), 0),
    [filtered]
  );
  const totalGlobal = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.importe) || 0), 0),
    [rows]
  );

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, row: PagoRow) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar el pago de ${formatEuro(row.importe)}?`)) return;
    const { error } = await supabase
      .from("pagos_efectivo")
      .delete()
      .eq("id", row.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchPagos();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos en efectivo</h1>
          <p className="text-sm text-gray-600 mt-1">
            {rows.length} {rows.length === 1 ? "pago" : "pagos"} registrados
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Registrar pago
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-white/70 text-green-600">
            <Banknote className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs text-green-700 font-semibold uppercase">
              Total acumulado
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {formatEuro(totalGlobal)}
            </p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-white/70 text-blue-600">
            <Banknote className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs text-blue-700 font-semibold uppercase">
              Total filtrado
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {formatEuro(totalFiltrado)}
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
            placeholder="Buscar por cliente, concepto, notas..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
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
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          title="Desde"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          title="Hasta"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando pagos...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {rows.length === 0
                ? "Aún no hay pagos registrados. Registra el primero."
                : "No hay pagos que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Fecha
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Cliente
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Expediente
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Concepto
                  </th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">
                    Importe
                  </th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const cliente = r.clientes
                    ? [r.clientes.nombre, r.clientes.apellidos]
                        .filter(Boolean)
                        .join(" ")
                    : "—";
                  return (
                    <tr
                      key={r.id}
                      onClick={(e) => handleEdit(e, r.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatFecha(r.fecha)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {cliente}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.expedientes ? (
                          <div>
                            <div className="text-xs font-mono text-gray-500">
                              {r.expedientes.numero_expediente}
                            </div>
                            <div className="truncate max-w-xs">
                              {r.expedientes.titulo}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.concepto || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatEuro(Number(r.importe) || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleEdit(e, r.id)}
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
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-right font-semibold text-gray-700"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatEuro(totalFiltrado)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <PagoEfectivoDialog
        isOpen={dialogOpen}
        pagoId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchPagos}
      />
    </div>
  );
}
