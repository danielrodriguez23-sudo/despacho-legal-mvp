import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, FolderOpen } from "lucide-react";
import { supabase } from "../lib/supabase";
import ExpedienteDialog from "../components/expedientes/ExpedienteDialog";

type Estado = "abierto" | "cerrado" | "archivado";
type EstadoFiltro = "todos" | Estado;

interface ExpedienteRow {
  id: string;
  numero_expediente: string;
  cliente_id: string;
  titulo: string;
  materia: string;
  tipo_procedimiento: string | null;
  juzgado: string | null;
  numero_procedimiento: string | null;
  parte_contraria: string | null;
  abogado_contrario: string | null;
  estado: Estado;
  fecha_inicio: string;
  fecha_cierre: string | null;
  descripcion: string | null;
  clientes: { id: string; nombre: string; apellidos: string | null } | null;
}

const estadoBadge: Record<Estado, string> = {
  abierto: "bg-green-100 text-green-700",
  cerrado: "bg-gray-200 text-gray-700",
  archivado: "bg-yellow-100 text-yellow-700",
};

const estadoLabel: Record<Estado, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
  archivado: "Archivado",
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function Expedientes() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ExpedienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const fetchExpedientes = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("expedientes")
      .select(
        "id, numero_expediente, cliente_id, titulo, materia, tipo_procedimiento, juzgado, numero_procedimiento, parte_contraria, abogado_contrario, estado, fecha_inicio, fecha_cierre, descripcion, clientes(id, nombre, apellidos)"
      )
      .order("numero_expediente", { ascending: true });

    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as ExpedienteRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchExpedientes();
  }, []);

  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.clientes) {
        const nombre = [r.clientes.nombre, r.clientes.apellidos]
          .filter(Boolean)
          .join(" ");
        map.set(r.clientes.id, nombre);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (estadoFiltro !== "todos" && r.estado !== estadoFiltro) return false;
      if (clienteFiltro !== "todos" && r.cliente_id !== clienteFiltro) return false;
      if (!term) return true;
      const clienteNombre = r.clientes
        ? [r.clientes.nombre, r.clientes.apellidos].filter(Boolean).join(" ")
        : "";
      const haystack = [
        r.numero_expediente,
        clienteNombre,
        r.titulo,
        r.materia,
        r.juzgado ?? "",
        r.numero_procedimiento ?? "",
        r.parte_contraria ?? "",
        r.abogado_contrario ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, estadoFiltro, clienteFiltro]);

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, row: ExpedienteRow) => {
    e.stopPropagation();
    if (
      !confirm(
        `¿Eliminar el expediente "${row.numero_expediente}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    const { error } = await supabase.from("expedientes").delete().eq("id", row.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchExpedientes();
  };

  const handleRowClick = (id: string) => {
    navigate(`/expedientes/${id}`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expedientes</h1>
          <p className="text-sm text-gray-600 mt-1">
            {rows.length} {rows.length === 1 ? "expediente" : "expedientes"} en total
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo expediente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, materia, juzgado, parte contraria..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los estados</option>
          <option value="abierto">Abiertos</option>
          <option value="cerrado">Cerrados</option>
          <option value="archivado">Archivados</option>
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
          <div className="p-12 text-center text-gray-500">Cargando expedientes...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {rows.length === 0
                ? "Aún no hay expedientes. Crea el primero."
                : "No hay expedientes que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Número</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Título</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Cliente</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Materia</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Estado</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Inicio</th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r.id)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {r.numero_expediente}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.titulo}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.clientes
                        ? [r.clientes.nombre, r.clientes.apellidos]
                            .filter(Boolean)
                            .join(" ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.materia}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge[r.estado]}`}
                      >
                        {estadoLabel[r.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(r.fecha_inicio)}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpedienteDialog
        isOpen={dialogOpen}
        expedienteId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchExpedientes}
      />
    </div>
  );
}
