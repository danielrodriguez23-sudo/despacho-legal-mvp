import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface ExpedienteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  expedienteId?: string;
}

type Estado = "abierto" | "cerrado" | "archivado";

interface ClienteOption {
  id: string;
  nombre: string;
  apellidos: string | null;
}

interface AbogadoOption {
  id: string;
  full_name: string | null;
  email: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  cliente_id: "",
  abogado_responsable_id: "",
  titulo: "",
  materia: "",
  tipo_procedimiento: "",
  juzgado: "",
  numero_procedimiento: "",
  parte_contraria: "",
  abogado_contrario: "",
  estado: "abierto" as Estado,
  fecha_inicio: today(),
  fecha_cierre: "",
  descripcion: "",
});

export default function ExpedienteDialog({
  isOpen,
  onClose,
  onSaved,
  expedienteId,
}: ExpedienteDialogProps) {
  const [formData, setFormData] = useState(emptyForm());
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [abogados, setAbogados] = useState<AbogadoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");

    supabase
      .from("clientes")
      .select("id, nombre, apellidos")
      .order("nombre", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(`Error al cargar clientes: ${error.message}`);
        else setClientes((data ?? []) as ClienteOption[]);
      });

    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        setAbogados((data ?? []) as AbogadoOption[]);
      });

    if (expedienteId) {
      supabase
        .from("expedientes")
        .select("*")
        .eq("id", expedienteId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setError("Error al cargar expediente");
            return;
          }
          if (data) {
            setFormData({
              cliente_id: data.cliente_id ?? "",
              abogado_responsable_id: data.abogado_responsable_id ?? "",
              titulo: data.titulo ?? "",
              materia: data.materia ?? "",
              tipo_procedimiento: data.tipo_procedimiento ?? "",
              juzgado: data.juzgado ?? "",
              numero_procedimiento: data.numero_procedimiento ?? "",
              parte_contraria: data.parte_contraria ?? "",
              abogado_contrario: data.abogado_contrario ?? "",
              estado: data.estado ?? "abierto",
              fecha_inicio: data.fecha_inicio ?? today(),
              fecha_cierre: data.fecha_cierre ?? "",
              descripcion: data.descripcion ?? "",
            });
          }
        });
    } else {
      setFormData(emptyForm());
    }
  }, [isOpen, expedienteId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.cliente_id) {
      setError("Selecciona un cliente");
      return;
    }
    if (!formData.titulo.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!formData.materia.trim()) {
      setError("La materia es obligatoria");
      return;
    }

    setLoading(true);

    const basePayload = {
      cliente_id: formData.cliente_id,
      abogado_responsable_id: formData.abogado_responsable_id || null,
      titulo: formData.titulo.trim(),
      materia: formData.materia.trim(),
      tipo_procedimiento: formData.tipo_procedimiento.trim() || null,
      juzgado: formData.juzgado.trim() || null,
      numero_procedimiento: formData.numero_procedimiento.trim() || null,
      parte_contraria: formData.parte_contraria.trim() || null,
      abogado_contrario: formData.abogado_contrario.trim() || null,
      estado: formData.estado,
      fecha_inicio: formData.fecha_inicio,
      fecha_cierre: formData.fecha_cierre || null,
      descripcion: formData.descripcion.trim() || null,
    };

    try {
      if (expedienteId) {
        const { error } = await supabase
          .from("expedientes")
          .update(basePayload)
          .eq("id", expedienteId);
        if (error) throw error;
      } else {
        const { data: numero, error: rpcError } = await supabase.rpc(
          "generar_numero_expediente"
        );
        if (rpcError) throw rpcError;

        const { error } = await supabase
          .from("expedientes")
          .insert([{ ...basePayload, numero_expediente: numero as unknown as string }]);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar expediente");
    } finally {
      setLoading(false);
    }
  };

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) => setFormData((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {expedienteId ? "Editar expediente" : "Nuevo expediente"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente *
            </label>
            <select
              value={formData.cliente_id}
              onChange={(e) => set("cliente_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Selecciona un cliente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.nombre, c.apellidos].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Abogado responsable
            </label>
            <select
              value={formData.abogado_responsable_id}
              onChange={(e) => set("abogado_responsable_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Sin asignar --</option>
              {abogados.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Materia *
              </label>
              <input
                type="text"
                value={formData.materia}
                onChange={(e) => set("materia", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej. Civil, Penal, Laboral..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo procedimiento
              </label>
              <input
                type="text"
                value={formData.tipo_procedimiento}
                onChange={(e) => set("tipo_procedimiento", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Juzgado
              </label>
              <input
                type="text"
                value={formData.juzgado}
                onChange={(e) => set("juzgado", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número procedimiento
              </label>
              <input
                type="text"
                value={formData.numero_procedimiento}
                onChange={(e) => set("numero_procedimiento", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parte contraria
              </label>
              <input
                type="text"
                value={formData.parte_contraria}
                onChange={(e) => set("parte_contraria", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Abogado contrario
              </label>
              <input
                type="text"
                value={formData.abogado_contrario}
                onChange={(e) => set("abogado_contrario", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={formData.estado}
                onChange={(e) => set("estado", e.target.value as Estado)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="abierto">Abierto</option>
                <option value="cerrado">Cerrado</option>
                <option value="archivado">Archivado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha inicio *
              </label>
              <input
                type="date"
                value={formData.fecha_inicio}
                onChange={(e) => set("fecha_inicio", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha cierre
              </label>
              <input
                type="date"
                value={formData.fecha_cierre}
                onChange={(e) => set("fecha_cierre", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Guardando..."
                : expedienteId
                ? "Guardar cambios"
                : "Crear expediente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
