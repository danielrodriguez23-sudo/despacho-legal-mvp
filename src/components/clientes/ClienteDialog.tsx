import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface ClienteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  clienteId?: string;
}

export default function ClienteDialog({ isOpen, onClose, onSaved, clienteId }: ClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    tipo: "particular" as "particular" | "empresa",
    dni_nif: "",
    nombre: "",
    apellidos: "",
    email: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    codigo_postal: "",
    notas: "",
  });

  useEffect(() => {
    if (clienteId && isOpen) {
      loadCliente();
    } else if (!isOpen) {
      resetForm();
    }
  }, [clienteId, isOpen]);

  const loadCliente = async () => {
    if (!clienteId) return;
    
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .single();

    if (error) {
      setError("Error al cargar cliente");
      return;
    }

    if (data) {
      setFormData({
        tipo: data.tipo,
        dni_nif: data.dni_nif || "",
        nombre: data.nombre,
        apellidos: data.apellidos || "",
        email: data.email || "",
        telefono: data.telefono || "",
        direccion: data.direccion || "",
        ciudad: data.ciudad || "",
        codigo_postal: data.codigo_postal || "",
        notas: data.notas || "",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: "particular",
      dni_nif: "",
      nombre: "",
      apellidos: "",
      email: "",
      telefono: "",
      direccion: "",
      ciudad: "",
      codigo_postal: "",
      notas: "",
    });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (clienteId) {
        // Update
        const { error } = await supabase
          .from("clientes")
          .update(formData)
          .eq("id", clienteId);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("clientes")
          .insert([formData]);

        if (error) throw error;
      }

      onSaved();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || "Error al guardar cliente");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {clienteId ? "Editar cliente" : "Nuevo cliente"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="particular">Particular</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NIF / CIF
              </label>
              <input
                type="text"
                value={formData.dni_nif}
                onChange={(e) => setFormData({ ...formData, dni_nif: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apellidos
              </label>
              <input
                type="text"
                value={formData.apellidos}
                onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <input
              type="text"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ciudad
              </label>
              <input
                type="text"
                value={formData.ciudad}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código postal
              </label>
              <input
                type="text"
                value={formData.codigo_postal}
                onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
