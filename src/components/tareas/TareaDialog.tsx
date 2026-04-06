import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Prioridad = "baja" | "media" | "alta" | "urgente";
type Estado = "pendiente" | "completada";

interface TareaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  tareaId?: string;
}

interface ExpedienteOption {
  id: string;
  numero_expediente: string;
  titulo: string;
}

const emptyForm = () => ({
  titulo: "",
  descripcion: "",
  expediente_id: "",
  prioridad: "media" as Prioridad,
  fecha_vencimiento: "",
  estado: "pendiente" as Estado,
});

// Convierte un timestamptz ISO a valor para <input type="datetime-local">
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (local: string) => {
  if (!local) return null;
  return new Date(local).toISOString();
};

export default function TareaDialog({
  isOpen,
  onClose,
  onSaved,
  tareaId,
}: TareaDialogProps) {
  const [formData, setFormData] = useState(emptyForm());
  const [expedientes, setExpedientes] = useState<ExpedienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");

    supabase
      .from("expedientes")
      .select("id, numero_expediente, titulo")
      .order("fecha_inicio", { ascending: false })
      .then(({ data }) => {
        setExpedientes((data ?? []) as ExpedienteOption[]);
      });

    if (tareaId) {
      supabase
        .from("tareas")
        .select("*")
        .eq("id", tareaId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setError("Error al cargar tarea");
            return;
          }
          if (data) {
            setFormData({
              titulo: data.titulo ?? "",
              descripcion: data.descripcion ?? "",
              expediente_id: data.expediente_id ?? "",
              prioridad: (data.prioridad as Prioridad) ?? "media",
              fecha_vencimiento: toLocalInput(data.fecha_vencimiento),
              estado: (data.estado as Estado) ?? "pendiente",
            });
          }
        });
    } else {
      setFormData(emptyForm());
    }
  }, [isOpen, tareaId]);

  if (!isOpen) return null;

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) => setFormData((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.titulo.trim()) {
      setError("El título es obligatorio");
      return;
    }

    setLoading(true);

    const payload = {
      titulo: formData.titulo.trim(),
      descripcion: formData.descripcion.trim() || null,
      expediente_id: formData.expediente_id || null,
      prioridad: formData.prioridad,
      fecha_vencimiento: fromLocalInput(formData.fecha_vencimiento),
      estado: formData.estado,
      fecha_completada:
        formData.estado === "completada" ? new Date().toISOString() : null,
    };

    try {
      if (tareaId) {
        const { error } = await supabase
          .from("tareas")
          .update(payload)
          .eq("id", tareaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tareas").insert([payload]);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {tareaId ? "Editar tarea" : "Nueva tarea"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expediente relacionado
            </label>
            <select
              value={formData.expediente_id}
              onChange={(e) => set("expediente_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Sin expediente --</option>
              {expedientes.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.numero_expediente} · {exp.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad
              </label>
              <select
                value={formData.prioridad}
                onChange={(e) => set("prioridad", e.target.value as Prioridad)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de vencimiento
              </label>
              <input
                type="datetime-local"
                value={formData.fecha_vencimiento}
                onChange={(e) => set("fecha_vencimiento", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {tareaId && (
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.estado === "completada"}
                  onChange={(e) =>
                    set("estado", e.target.checked ? "completada" : "pendiente")
                  }
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Marcar como completada
              </label>
            </div>
          )}

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
                : tareaId
                ? "Guardar cambios"
                : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
