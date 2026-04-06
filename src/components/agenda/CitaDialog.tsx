import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

interface CitaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  citaId?: string;
}

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

const emptyForm = () => ({
  titulo: "",
  tipo: "primera_consulta" as Tipo,
  cliente_id: "",
  abogado_id: "",
  fecha_inicio: "",
  fecha_fin: "",
  ubicacion: "",
  modalidad: "",
  estado: "programada" as Estado,
  descripcion: "",
  notas: "",
});

export default function CitaDialog({
  isOpen,
  onClose,
  onSaved,
  citaId,
}: CitaDialogProps) {
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
      .then(({ data }) => setClientes((data ?? []) as ClienteOption[]));

    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true })
      .then(({ data }) => setAbogados((data ?? []) as AbogadoOption[]));

    if (citaId) {
      supabase
        .from("citas")
        .select("*")
        .eq("id", citaId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setError("Error al cargar cita");
            return;
          }
          if (data) {
            setFormData({
              titulo: data.titulo ?? "",
              tipo: (data.tipo as Tipo) ?? "primera_consulta",
              cliente_id: data.cliente_id ?? "",
              abogado_id: data.abogado_id ?? "",
              fecha_inicio: toLocalInput(data.fecha_inicio),
              fecha_fin: toLocalInput(data.fecha_fin),
              ubicacion: data.ubicacion ?? "",
              modalidad: data.modalidad ?? "",
              estado: (data.estado as Estado) ?? "programada",
              descripcion: data.descripcion ?? "",
              notas: data.notas ?? "",
            });
          }
        });
    } else {
      setFormData(emptyForm());
    }
  }, [isOpen, citaId]);

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
    if (!formData.fecha_inicio) {
      setError("La fecha de inicio es obligatoria");
      return;
    }
    if (!formData.fecha_fin) {
      setError("La fecha de fin es obligatoria");
      return;
    }
    if (new Date(formData.fecha_fin) <= new Date(formData.fecha_inicio)) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }

    setLoading(true);

    const payload = {
      titulo: formData.titulo.trim(),
      tipo: formData.tipo,
      cliente_id: formData.cliente_id || null,
      abogado_id: formData.abogado_id || null,
      fecha_inicio: fromLocalInput(formData.fecha_inicio),
      fecha_fin: fromLocalInput(formData.fecha_fin),
      ubicacion: formData.ubicacion.trim() || null,
      modalidad: formData.modalidad.trim() || null,
      estado: formData.estado,
      descripcion: formData.descripcion.trim() || null,
      notas: formData.notas.trim() || null,
    };

    try {
      if (citaId) {
        const { error } = await supabase
          .from("citas")
          .update(payload)
          .eq("id", citaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("citas").insert([payload]);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar cita");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {citaId ? "Editar cita" : "Nueva cita"}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => set("tipo", e.target.value as Tipo)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="primera_consulta">Primera consulta</option>
                <option value="reunion_cliente">Reunión con cliente</option>
                <option value="vista_judicial">Vista judicial</option>
                <option value="reunion_interna">Reunión interna</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={formData.estado}
                onChange={(e) => set("estado", e.target.value as Estado)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="programada">Programada</option>
                <option value="confirmada">Confirmada</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
                <option value="no_presentado">No presentado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <select
              value={formData.cliente_id}
              onChange={(e) => set("cliente_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Sin cliente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.nombre, c.apellidos].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Abogado asignado
            </label>
            <select
              value={formData.abogado_id}
              onChange={(e) => set("abogado_id", e.target.value)}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inicio *
              </label>
              <input
                type="datetime-local"
                value={formData.fecha_inicio}
                onChange={(e) => set("fecha_inicio", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fin *
              </label>
              <input
                type="datetime-local"
                value={formData.fecha_fin}
                onChange={(e) => set("fecha_fin", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ubicación
              </label>
              <input
                type="text"
                value={formData.ubicacion}
                onChange={(e) => set("ubicacion", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modalidad
              </label>
              <select
                value={formData.modalidad}
                onChange={(e) => set("modalidad", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Sin especificar --</option>
                <option value="presencial">Presencial</option>
                <option value="videoconferencia">Videoconferencia</option>
                <option value="telefono">Teléfono</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={2}
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
                : citaId
                ? "Guardar cambios"
                : "Crear cita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
