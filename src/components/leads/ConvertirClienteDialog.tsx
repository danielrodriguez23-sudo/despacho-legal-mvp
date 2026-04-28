import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface Lead {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  mensaje: string | null;
  asunto: string | null;
  estado: string;
  origen: string | null;
  fecha_contacto: string | null;
  created_at: string | null;
  convertido_cliente_id: string | null;
  notas: string | null;
}

interface Props {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConvertirClienteDialog({ lead, isOpen, onClose, onSuccess }: Props) {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState(lead.nombre);
  const [email, setEmail] = useState(lead.email);
  const [telefono, setTelefono] = useState(lead.telefono ?? '');
  const [dni, setDni] = useState('');
  const [direccion, setDireccion] = useState('');
  const [crearExpediente, setCrearExpediente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  if (!isOpen) return null;

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async () => {
    if (!nombre.trim() || !email.trim()) {
      showToast('error', 'El nombre y el email son obligatorios');
      return;
    }

    setLoading(true);
    try {
      // 1. Crear cliente
      const { data: cliente, error: clienteErr } = await supabase
        .from('clientes')
        .insert({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim() || null,
          dni_nif: dni.trim() || null,
          direccion: direccion.trim() || null,
        })
        .select('id')
        .single();

      if (clienteErr) {
        if (clienteErr.code === '23505') {
          showToast('error', 'Ya existe un cliente con ese email');
        } else {
          showToast('error', `Error al crear cliente: ${clienteErr.message}`);
        }
        setLoading(false);
        return;
      }

      // 2. Actualizar lead a convertido
      const { error: leadErr } = await supabase
        .from('leads')
        .update({ estado: 'convertido', convertido_cliente_id: cliente.id })
        .eq('id', lead.id);

      if (leadErr) {
        console.error('Error actualizando lead:', leadErr);
      }

      showToast('success', '✅ Cliente creado correctamente');

      setTimeout(() => {
        if (crearExpediente) {
          navigate('/expedientes', {
            state: {
              abrirNuevoExpediente: true,
              clienteId: cliente.id,
            },
          });
        } else {
          onSuccess();
          onClose();
        }
      }, 1200);
    } catch (err) {
      console.error(err);
      showToast('error', 'Error inesperado. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-60 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Convertir lead a cliente</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            Se creará un nuevo cliente con los datos del lead. Puedes editarlos antes de confirmar.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIF</label>
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Checkbox crear expediente */}
          <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            <input
              type="checkbox"
              checked={crearExpediente}
              onChange={(e) => setCrearExpediente(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">
              Crear expediente también después de crear el cliente
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Creando...' : 'Convertir a Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
