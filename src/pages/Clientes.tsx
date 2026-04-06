import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database.types";
import ClienteDialog from "../components/clientes/ClienteDialog";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
type TipoFiltro = "todos" | "particular" | "empresa";

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setClientes((data ?? []) as Cliente[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes.filter((c) => {
      if (tipoFiltro !== "todos" && c.tipo !== tipoFiltro) return false;
      if (!term) return true;
      const haystack = [
        c.nombre,
        c.apellidos,
        c.dni_nif,
        c.email,
        c.telefono,
        c.ciudad,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [clientes, search, tipoFiltro]);

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingId(cliente.id);
    setDialogOpen(true);
  };

  const handleDelete = async (cliente: Cliente) => {
    const nombre = [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ");
    if (!confirm(`¿Eliminar el cliente "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", cliente.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchClientes();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-600 mt-1">
            {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} en total
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, NIF, email, teléfono..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los tipos</option>
          <option value="particular">Particulares</option>
          <option value="empresa">Empresas</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando clientes...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {clientes.length === 0
                ? "Aún no hay clientes. Crea el primero."
                : "No hay clientes que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Nombre</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Tipo</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">NIF/CIF</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Email</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Teléfono</th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">Ciudad</th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {[c.nombre, c.apellidos].filter(Boolean).join(" ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.tipo === "empresa"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {c.tipo === "empresa" ? "Empresa" : "Particular"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.dni_nif ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c.ciudad ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-2 rounded-md hover:bg-blue-50 text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
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

      <ClienteDialog
        isOpen={dialogOpen}
        clienteId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchClientes}
      />
    </div>
  );
}
