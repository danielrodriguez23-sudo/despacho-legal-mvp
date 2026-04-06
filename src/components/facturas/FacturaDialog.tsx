import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

type Estado = "pendiente" | "pagada" | "vencida" | "cancelada";

const IVA_PORCENTAJE = 21;

interface FacturaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  facturaId?: string;
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

interface LineaForm {
  id?: string;
  concepto: string;
  cantidad: string;
  precio_unitario: string;
}

const hoyISO = () => new Date().toISOString().split("T")[0];
const en30diasISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
};

const emptyLinea = (): LineaForm => ({
  concepto: "",
  cantidad: "1",
  precio_unitario: "0",
});

const emptyForm = () => ({
  numero_factura: "",
  cliente_id: "",
  expediente_id: "",
  fecha_emision: hoyISO(),
  fecha_vencimiento: en30diasISO(),
  estado: "pendiente" as Estado,
  concepto: "",
  notas: "",
});

const formatEuro = (n: number) =>
  n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function FacturaDialog({
  isOpen,
  onClose,
  onSaved,
  facturaId,
}: FacturaDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(emptyForm());
  const [lineas, setLineas] = useState<LineaForm[]>([emptyLinea()]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(facturaId);

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

    if (facturaId) {
      (async () => {
        const { data: fact, error: fErr } = await supabase
          .from("facturas")
          .select("*")
          .eq("id", facturaId)
          .single();
        if (fErr || !fact) {
          setError("Error al cargar factura");
          return;
        }
        setFormData({
          numero_factura: fact.numero_factura ?? "",
          cliente_id: fact.cliente_id ?? "",
          expediente_id: fact.expediente_id ?? "",
          fecha_emision: fact.fecha_emision ?? hoyISO(),
          fecha_vencimiento: fact.fecha_vencimiento ?? en30diasISO(),
          estado: (fact.estado as Estado) ?? "pendiente",
          concepto: fact.concepto ?? "",
          notas: fact.notas ?? "",
        });

        const { data: lins } = await supabase
          .from("lineas_factura")
          .select("*")
          .eq("factura_id", facturaId)
          .order("created_at", { ascending: true });

        if (lins && lins.length > 0) {
          setLineas(
            lins.map((l: any) => ({
              id: l.id,
              concepto: l.concepto ?? "",
              cantidad: String(l.cantidad ?? 1),
              precio_unitario: String(l.precio_unitario ?? 0),
            }))
          );
        } else {
          setLineas([emptyLinea()]);
        }
      })();
    } else {
      setFormData(emptyForm());
      setLineas([emptyLinea()]);
    }
  }, [isOpen, facturaId]);

  const expedientesFiltrados = useMemo(
    () =>
      formData.cliente_id
        ? expedientes.filter((e) => e.cliente_id === formData.cliente_id)
        : expedientes,
    [expedientes, formData.cliente_id]
  );

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((acc, l) => {
      const cant = parseFloat(l.cantidad) || 0;
      const precio = parseFloat(l.precio_unitario) || 0;
      return acc + cant * precio;
    }, 0);
    const iva = subtotal * (IVA_PORCENTAJE / 100);
    const total = subtotal + iva;
    return { subtotal, iva, total };
  }, [lineas]);

  if (!isOpen) return null;

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) => setFormData((f) => ({ ...f, [key]: value }));

  const updateLinea = (
    idx: number,
    key: keyof Omit<LineaForm, "id">,
    value: string
  ) => {
    setLineas((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, [key]: value } : l))
    );
  };

  const addLinea = () =>
    setLineas((ls) => [...ls, emptyLinea()]);

  const removeLinea = (idx: number) =>
    setLineas((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.cliente_id) {
      setError("Selecciona un cliente");
      return;
    }
    if (lineas.length === 0) {
      setError("Debe haber al menos una línea");
      return;
    }
    for (const [i, l] of lineas.entries()) {
      if (!l.concepto.trim()) {
        setError(`Línea ${i + 1}: falta el concepto`);
        return;
      }
      const p = parseFloat(l.precio_unitario);
      if (!p || p <= 0) {
        setError(`Línea ${i + 1}: el precio debe ser mayor que 0`);
        return;
      }
    }

    setLoading(true);

    try {
      // Obtener número de factura si es nueva
      let numero = formData.numero_factura;
      if (!isEdit) {
        const { data: numData, error: numErr } = await supabase.rpc(
          "generar_numero_factura"
        );
        if (numErr) throw numErr;
        numero = numData as string;
      }

      const facturaPayload = {
        numero_factura: numero,
        cliente_id: formData.cliente_id,
        expediente_id: formData.expediente_id || null,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        estado: formData.estado,
        concepto: formData.concepto.trim() || null,
        notas: formData.notas.trim() || null,
        base_imponible: Number(totales.subtotal.toFixed(2)),
        iva_porcentaje: IVA_PORCENTAJE,
        iva_importe: Number(totales.iva.toFixed(2)),
        total: Number(totales.total.toFixed(2)),
      };

      let facturaIdFinal = facturaId;

      if (isEdit) {
        const { error: upErr } = await supabase
          .from("facturas")
          .update(facturaPayload)
          .eq("id", facturaId);
        if (upErr) throw upErr;

        // Borrar líneas previas y reinsertar
        const { error: delErr } = await supabase
          .from("lineas_factura")
          .delete()
          .eq("factura_id", facturaId);
        if (delErr) throw delErr;
      } else {
        const insertPayload = {
          ...facturaPayload,
          created_by: user?.id ?? null,
        };
        const { data: inserted, error: insErr } = await supabase
          .from("facturas")
          .insert([insertPayload])
          .select("id")
          .single();
        if (insErr) throw insErr;
        facturaIdFinal = inserted.id;
      }

      const lineasPayload = lineas.map((l) => {
        const cant = parseFloat(l.cantidad) || 1;
        const precio = parseFloat(l.precio_unitario) || 0;
        return {
          factura_id: facturaIdFinal,
          concepto: l.concepto.trim(),
          cantidad: cant,
          precio_unitario: precio,
          subtotal: Number((cant * precio).toFixed(2)),
        };
      });

      const { error: linErr } = await supabase
        .from("lineas_factura")
        .insert(lineasPayload);
      if (linErr) throw linErr;

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar factura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? `Editar factura ${formData.numero_factura}` : "Nueva factura"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha emisión *
              </label>
              <input
                type="date"
                value={formData.fecha_emision}
                onChange={(e) => set("fecha_emision", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha vencimiento
              </label>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => set("fecha_vencimiento", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="vencida">Vencida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Concepto general
            </label>
            <input
              type="text"
              value={formData.concepto}
              onChange={(e) => set("concepto", e.target.value)}
              placeholder="Ej. Honorarios procedimiento laboral"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Líneas de factura *
              </label>
              <button
                type="button"
                onClick={addLinea}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Añadir línea
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left font-semibold text-gray-700 px-3 py-2">
                      Concepto
                    </th>
                    <th className="text-right font-semibold text-gray-700 px-3 py-2 w-20">
                      Cant.
                    </th>
                    <th className="text-right font-semibold text-gray-700 px-3 py-2 w-28">
                      Precio
                    </th>
                    <th className="text-right font-semibold text-gray-700 px-3 py-2 w-28">
                      Subtotal
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineas.map((l, idx) => {
                    const cant = parseFloat(l.cantidad) || 0;
                    const precio = parseFloat(l.precio_unitario) || 0;
                    const sub = cant * precio;
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={l.concepto}
                            onChange={(e) =>
                              updateLinea(idx, "concepto", e.target.value)
                            }
                            placeholder="Descripción"
                            className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.cantidad}
                            onChange={(e) =>
                              updateLinea(idx, "cantidad", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-right focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.precio_unitario}
                            onChange={(e) =>
                              updateLinea(idx, "precio_unitario", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-right focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                          {formatEuro(sub)}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => removeLinea(idx)}
                            disabled={lineas.length <= 1}
                            className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Eliminar línea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full md:w-72 bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span className="font-medium">{formatEuro(totales.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>IVA {IVA_PORCENTAJE}%</span>
                <span className="font-medium">{formatEuro(totales.iva)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 text-gray-900 text-base">
                <span className="font-semibold">TOTAL</span>
                <span className="font-bold">{formatEuro(totales.total)}</span>
              </div>
            </div>
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
                : "Crear factura"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
