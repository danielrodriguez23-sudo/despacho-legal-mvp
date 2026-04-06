import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, CheckSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import TareaDialog from "../components/tareas/TareaDialog";

type Prioridad = "baja" | "media" | "alta" | "urgente";
type Estado = "pendiente" | "completada";

type EstadoFiltro = "todos" | Estado;
type PrioridadFiltro = "todas" | Prioridad;

interface TareaRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  expediente_id: string | null;
  prioridad: Prioridad | null;
  estado: Estado | null;
  fecha_vencimiento: string | null;
  fecha_completada: string | null;
  expedientes: {
    id: string;
    numero_expediente: string;
    titulo: string;
    clientes: { id: string; nombre: string; apellidos: string | null } | null;
  } | null;
}

const prioridadBadge: Record<Prioridad, string> = {
  baja: "bg-gray-100 text-gray-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

const prioridadLabel: Record<Prioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

const estadoBadge: Record<Estado, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  completada: "bg-green-100 text-green-700",
};

const estadoLabel: Record<Estado, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isVencida = (t: TareaRow) => {
  if (t.estado === "completada") return false;
  if (!t.fecha_vencimiento) return false;
  return new Date(t.fecha_vencimiento).getTime() < Date.now();
};

type Semaforo = "vencida" | "hoy" | "semana" | "futura" | "sin_fecha";

const getSemaforo = (t: TareaRow): Semaforo => {
  if (t.estado === "completada") return "futura";
  if (!t.fecha_vencimiento) return "sin_fecha";
  const f = new Date(t.fecha_vencimiento).getTime();
  const ahora = Date.now();
  if (f < ahora) return "vencida";
  const finHoy = new Date();
  finHoy.setHours(23, 59, 59, 999);
  if (f <= finHoy.getTime()) return "hoy";
  const en7 = ahora + 7 * 24 * 60 * 60 * 1000;
  if (f <= en7) return "semana";
  return "futura";
};

const semaforoRow: Record<Semaforo, string> = {
  vencida: "bg-red-50 hover:bg-red-100",
  hoy: "bg-orange-50 hover:bg-orange-100",
  semana: "bg-yellow-50 hover:bg-yellow-100",
  futura: "hover:bg-gray-50",
  sin_fecha: "hover:bg-gray-50",
};

export default function Tareas() {
  const [rows, setRows] = useState<TareaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [prioridadFiltro, setPrioridadFiltro] = useState<PrioridadFiltro>("todas");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const fetchTareas = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("tareas")
      .select(
        `id, titulo, descripcion, expediente_id, prioridad, estado,
         fecha_vencimiento, fecha_completada,
         expedientes(id, numero_expediente, titulo,
           clientes(id, nombre, apellidos))`
      )
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as TareaRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTareas();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (estadoFiltro !== "todos" && r.estado !== estadoFiltro) return false;
      if (prioridadFiltro !== "todas" && r.prioridad !== prioridadFiltro)
        return false;
      if (!term) return true;
      const exp = r.expedientes;
      const haystack = [
        r.titulo,
        r.descripcion ?? "",
        exp?.numero_expediente ?? "",
        exp?.titulo ?? "",
        exp?.clientes
          ? [exp.clientes.nombre, exp.clientes.apellidos].filter(Boolean).join(" ")
          : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, estadoFiltro, prioridadFiltro]);

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, row: TareaRow) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la tarea "${row.titulo}"?`)) return;
    const { error } = await supabase.from("tareas").delete().eq("id", row.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchTareas();
  };

  const handleToggleEstado = async (row: TareaRow) => {
    const nuevoEstado: Estado =
      row.estado === "completada" ? "pendiente" : "completada";
    const { error } = await supabase
      .from("tareas")
      .update({
        estado: nuevoEstado,
        fecha_completada:
          nuevoEstado === "completada" ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    fetchTareas();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tareas</h1>
          <p className="text-sm text-gray-600 mt-1">
            {rows.length} {rows.length === 1 ? "tarea" : "tareas"} en total
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, descripción, expediente..."
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
          <option value="completada">Completadas</option>
        </select>
        <select
          value={prioridadFiltro}
          onChange={(e) => setPrioridadFiltro(e.target.value as PrioridadFiltro)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todas">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando tareas...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CheckSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {rows.length === 0
                ? "Aún no hay tareas. Crea la primera."
                : "No hay tareas que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Título
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Expediente / Cliente
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Prioridad
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Estado
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Vencimiento
                  </th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const vencida = isVencida(r);
                  const sem = getSemaforo(r);
                  const completada = r.estado === "completada";
                  const cliente = r.expedientes?.clientes
                    ? [
                        r.expedientes.clientes.nombre,
                        r.expedientes.clientes.apellidos,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : null;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleToggleEstado(r)}
                      className={`cursor-pointer ${completada ? "hover:bg-gray-50" : semaforoRow[sem]}`}
                    >
                      <td
                        className="px-4 py-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleEstado(r);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={completada}
                          readOnly
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 pointer-events-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`font-medium ${
                            completada
                              ? "text-gray-400 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {r.titulo}
                        </div>
                        {r.descripcion && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {r.descripcion}
                          </div>
                        )}
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
                            {cliente && (
                              <div className="text-xs text-gray-500">{cliente}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.prioridad ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${prioridadBadge[r.prioridad]}`}
                          >
                            {prioridadLabel[r.prioridad]}
                          </span>
                        ) : (
                          "—"
                        )}
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
                      <td
                        className={`px-4 py-3 ${
                          vencida ? "text-red-700 font-medium" : "text-gray-700"
                        }`}
                      >
                        {formatDateTime(r.fecha_vencimiento)}
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
            </table>
          </div>
        )}
      </div>

      <TareaDialog
        isOpen={dialogOpen}
        tareaId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchTareas}
      />
    </div>
  );
}
