import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Calendar } from "lucide-react";
import { supabase } from "../lib/supabase";
import CitaDialog from "../components/agenda/CitaDialog";

type Tipo =
  | "primera_consulta"
  | "reunion_cliente"
  | "vista_judicial"
  | "reunion_interna"
  | "otro";
type Estado =
  | "programada"
  | "confirmada"
  | "completada"
  | "cancelada"
  | "no_presentado";

type TipoFiltro = "todos" | Tipo;
type AbogadoFiltro = "todos" | string;

interface CitaRow {
  id: string;
  titulo: string;
  tipo: Tipo | null;
  estado: Estado | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  ubicacion: string | null;
  modalidad: string | null;
  abogado_id: string | null;
  clientes: { id: string; nombre: string; apellidos: string | null } | null;
  abogado: { id: string; full_name: string | null; email: string } | null;
}

const tipoBadge: Record<Tipo, string> = {
  primera_consulta: "bg-blue-100 text-blue-700",
  reunion_cliente: "bg-green-100 text-green-700",
  vista_judicial: "bg-red-100 text-red-700",
  reunion_interna: "bg-purple-100 text-purple-700",
  otro: "bg-gray-100 text-gray-700",
};

const tipoLabel: Record<Tipo, string> = {
  primera_consulta: "Primera consulta",
  reunion_cliente: "Reunión cliente",
  vista_judicial: "Vista judicial",
  reunion_interna: "Reunión interna",
  otro: "Otro",
};

const estadoBadge: Record<Estado, string> = {
  programada: "bg-yellow-100 text-yellow-700",
  confirmada: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-gray-200 text-gray-600",
  no_presentado: "bg-red-100 text-red-700",
};

const estadoLabel: Record<Estado, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_presentado: "No presentado",
};

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

const isHoy = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  return (
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate()
  );
};

const isEstaSemana = (iso: string) => {
  const d = new Date(iso);
  const ahora = new Date();
  const diff = (d.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
};

const isPasada = (iso: string) => new Date(iso).getTime() < Date.now();

export default function Agenda() {
  const [rows, setRows] = useState<CitaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [abogadoFiltro, setAbogadoFiltro] = useState<AbogadoFiltro>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const fetchCitas = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("citas")
      .select(
        `id, titulo, tipo, estado, fecha_inicio, fecha_fin, ubicacion, modalidad, abogado_id,
         clientes(id, nombre, apellidos),
         abogado:profiles!citas_abogado_id_fkey(id, full_name, email)`
      )
      .order("fecha_inicio", { ascending: true });

    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as CitaRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchCitas();
  }, []);

  const abogadosUnicos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.abogado) {
        map.set(r.abogado.id, r.abogado.full_name || r.abogado.email);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipoFiltro !== "todos" && r.tipo !== tipoFiltro) return false;
      if (abogadoFiltro !== "todos" && r.abogado_id !== abogadoFiltro) return false;
      if (!term) return true;
      const cliente = r.clientes
        ? [r.clientes.nombre, r.clientes.apellidos].filter(Boolean).join(" ")
        : "";
      const haystack = [
        r.titulo,
        cliente,
        r.tipo ?? "",
        r.ubicacion ?? "",
        r.modalidad ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, tipoFiltro, abogadoFiltro]);

  const stats = useMemo(() => {
    const hoy = rows.filter((r) => isHoy(r.fecha_inicio)).length;
    const semana = rows.filter(
      (r) => isEstaSemana(r.fecha_inicio) && !isPasada(r.fecha_inicio)
    ).length;
    return { hoy, semana };
  }, [rows]);

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, row: CitaRow) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la cita "${row.titulo}"?`)) return;
    const { error } = await supabase.from("citas").delete().eq("id", row.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchCitas();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-600 mt-1">
            {rows.length} {rows.length === 1 ? "cita" : "citas"} · {stats.hoy} hoy ·{" "}
            {stats.semana} próximos 7 días
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva cita
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, tipo, ubicación..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los tipos</option>
          <option value="primera_consulta">Primera consulta</option>
          <option value="reunion_cliente">Reunión cliente</option>
          <option value="vista_judicial">Vista judicial</option>
          <option value="reunion_interna">Reunión interna</option>
          <option value="otro">Otro</option>
        </select>
        <select
          value={abogadoFiltro}
          onChange={(e) => setAbogadoFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los abogados</option>
          {abogadosUnicos.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando citas...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {rows.length === 0
                ? "Aún no hay citas. Crea la primera."
                : "No hay citas que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Fecha</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Hora</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Título / Tipo</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Cliente</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Ubicación</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Estado</th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const hoy = isHoy(r.fecha_inicio);
                  const pasada = isPasada(r.fecha_inicio);
                  const cliente = r.clientes
                    ? [r.clientes.nombre, r.clientes.apellidos].filter(Boolean).join(" ")
                    : "—";
                  const rowClass = hoy
                    ? "bg-yellow-50 hover:bg-yellow-100"
                    : pasada
                    ? "hover:bg-gray-50 text-gray-500"
                    : "hover:bg-gray-50";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleEdit(r.id)}
                      className={`cursor-pointer ${rowClass}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatFecha(r.fecha_inicio)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatHora(r.fecha_inicio)}
                        {r.fecha_fin ? ` - ${formatHora(r.fecha_fin)}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-medium ${pasada ? "text-gray-500" : "text-gray-900"}`}>
                          {r.titulo}
                        </div>
                        {r.tipo && (
                          <span
                            className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipoBadge[r.tipo]}`}
                          >
                            {tipoLabel[r.tipo]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{cliente}</td>
                      <td className="px-4 py-3">
                        {r.ubicacion || r.modalidad || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.estado ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge[r.estado]}`}
                          >
                            {estadoLabel[r.estado]}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
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

      <CitaDialog
        isOpen={dialogOpen}
        citaId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchCitas}
      />
    </div>
  );
}
