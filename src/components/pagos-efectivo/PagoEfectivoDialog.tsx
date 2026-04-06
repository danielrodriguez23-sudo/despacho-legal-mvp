import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface PagoEfectivoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  pagoId?: string;
}

interface ClienteOption {
  id: string;
  nombre: string;
  apellidos: string | null;
}

interface ExpedienteOption {
  id: string;
  numero_expediente: string;
  titulo: string;
  cliente_id: string | null;
}

const hoyISO = () => new Date().toISOString().split("T")[0];

const emptyForm = () => ({
  cliente_id: "",
  expediente_id: "",
  fecha: hoyISO(),
  importe: "",
  concepto: "",
  notas: "",
});

export default function PagoEfectivoDialog({
  isOpen,
  onClose,
  onSaved,
  pagoId,
}: PagoEfectivoDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(emptyForm());
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(pagoId);

  useEffect(() => {
    if (!isOpen) return;
    setError("");

    supabase
      .from("clientes")
      .select("id, nombre, apellidos")
      .order("nombre", { ascending: true })
      .then(({ data }) => setClientes((data ?? []) as ClienteOption[]));

    supabase
      .from("expedientes")
      .select("id, numero_expediente, titulo, cliente_id")
      .order("fecha_inicio", { ascending: false })
      .then(({ data }) => setExpedientes((data ?? []) as ExpedienteOption[]));

    if (pagoId) {
      supabase
        .from("pagos_efectivo")
        .select("*")
        .eq("id", pagoId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setError("Error al cargar pago");
            return;
          }
          if (data) {
            setFormData({
              cliente_id: data.cliente_id ?? "",
              expediente_id: data.expediente_id ?? "",
              fecha: data.fecha ?? hoyISO(),
              importe: data.importe != null ? String(data.importe) : "",
              concepto: data.concepto ?? "",
              notas: data.notas ?? "",
            });
          }
        });
    } else {
      setFormData(emptyForm());
    }
  }, [isOpen, pagoId]);

  const expedientesFiltrados = useMemo(
    () =>
      formData.cliente_id
        ? expedientes.filter((e) => e.cliente_id === formData.cliente_id)
        : expedientes,
    [expedientes, formData.cliente_id]
  );

  if (!isOpen) return null;

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) => setFormData((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.cliente_id) {
      setError("Selecciona un cliente");
      return;
    }
    const importe = parseFloat(formData.importe);
    if (!importe || importe <= 0) {
      setError("El importe debe ser mayor que 0");
      return;
    }
    if (!formData.fecha) {
      setError("La fecha es obligatoria");
      return;
    }

    setLoading(true);

    const payload = {
      cliente_id: formData.cliente_id,
      expediente_id: formData.expediente_id || null,
      fecha: formData.fecha,
      importe: Number(importe.toFixed(2)),
      concepto: formData.concepto.trim() || null,
      notas: formData.notas.trim() || null,
    };

    try {
      if (isEdit) {
        const { error } = await supabase
          .from("pagos_efectivo")
          .update(payload)
          .eq("id", pagoId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pagos_efectivo")
          .insert([{ ...payload, created_by: user?.id ?? null }]);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? "Editar pago" : "Registrar pago en efectivo"}
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
              Cliente *
            </label>
            <select
              value={formData.cliente_id}
              onChange={(e) => {
                set("cliente_id", e.target.value);
                set("expediente_id", "");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Selecciona cliente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.nombre, c.apellidos].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expediente
            </label>
            <select
              value={formData.expediente_id}
              onChange={(e) => set("expediente_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Sin expediente --</option>
              {expedientesFiltrados.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.numero_expediente} · {exp.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Importe *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.importe}
                  onChange={(e) => set("importe", e.target.value)}
                  className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Concepto
            </label>
            <input
              type="text"
              value={formData.concepto}
              onChange={(e) => set("concepto", e.target.value)}
              placeholder="Ej. Provisión de fondos"
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
                : isEdit
                ? "Guardar cambios"
                : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
