import { useEffect, useMemo, useState, useCallback } from 'react';
import { Mail, RefreshCw, Search, ChevronDown, ChevronRight, Phone, UserPlus, PhoneCall, XCircle, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConvertirClienteDialog, { type Lead } from '../components/leads/ConvertirClienteDialog';

type EstadoFiltro = 'todos' | 'nuevo' | 'contactado' | 'convertido' | 'descartado';

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  nuevo:      { label: 'Nuevo',       cls: 'bg-blue-100 text-blue-700' },
  contactado: { label: 'Contactado',  cls: 'bg-yellow-100 text-yellow-700' },
  convertido: { label: 'Convertido',  cls: 'bg-green-100 text-green-700' },
  descartado: { label: 'Descartado',  cls: 'bg-gray-100 text-gray-500' },
};

function Badge({ estado }: { estado: string }) {
  const cfg = ESTADO_BADGE[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [convertirLead, setConvertirLead] = useState<Lead | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [, setTick] = useState(0);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('fecha_contacto', { ascending: false });
    if (error) {
      console.error('Error cargando leads:', error);
    } else {
      setLeads((data ?? []) as Lead[]);
    }
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Auto-refresh cada 30s
  useEffect(() => {
    const interval = setInterval(fetchLeads, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  // Tick para actualizar el "hace X minutos" sin refetch
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (estadoFiltro !== 'todos' && l.estado !== estadoFiltro) return false;
      if (!term) return true;
      return [l.nombre, l.email, l.telefono].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [leads, search, estadoFiltro]);

  const updateEstado = async (id: string, estado: string) => {
    // Optimistic update
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estado } : l)));
    const { error } = await supabase.from('leads').update({ estado }).eq('id', id);
    if (error) {
      showToast('error', 'Error al actualizar el estado');
      fetchLeads(); // revert
    } else {
      showToast('success', estado === 'contactado' ? '📞 Marcado como contactado' : '❌ Lead descartado');
    }
  };

  const handleDescartar = (lead: Lead) => {
    if (!confirm(`¿Descartar el lead de ${lead.nombre}? Podrás cambiar el estado después.`)) return;
    updateEstado(lead.id, 'descartado');
  };

  const eliminarLead = async (lead: Lead) => {
    const extra = lead.estado === 'convertido'
      ? '\n\nEste lead ya fue convertido a cliente. El cliente NO se eliminará, solo el registro del lead.'
      : '';
    if (!confirm(`¿Eliminar el lead de "${lead.nombre}"? Esta acción no se puede deshacer.${extra}`)) return;

    setLeads((prev) => prev.filter((l) => l.id !== lead.id)); // optimistic
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) {
      console.error('Error al eliminar lead:', error);
      showToast('error', 'Error al eliminar el lead');
      fetchLeads(); // revert
    } else {
      showToast('success', 'Lead eliminado correctamente');
    }
  };

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-600" />
            Leads / Contactos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Contactos recibidos desde el formulario web
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            Actualizado {timeAgo(lastUpdate)}
          </span>
          <button
            onClick={() => { setLoading(true); fetchLeads(); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los estados</option>
          <option value="nuevo">Nuevos</option>
          <option value="contactado">Contactados</option>
          <option value="convertido">Convertidos</option>
          <option value="descartado">Descartados</option>
        </select>
        <span className="text-sm text-gray-500">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          // Skeleton
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
                <div className="h-4 w-36 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Mail className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {leads.length === 0
                ? 'No hay leads todavía.'
                : 'No hay leads que coincidan con los filtros.'}
            </p>
            {leads.length === 0 && (
              <p className="text-sm text-gray-400 mt-1">
                Los contactos del formulario web aparecerán aquí automáticamente.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[120px_1fr_1fr_120px_140px_180px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>Estado</span>
              <span>Nombre</span>
              <span>Email</span>
              <span>Teléfono</span>
              <span>Fecha</span>
              <span className="text-right">Acciones</span>
            </div>

            <div className="divide-y divide-gray-100">
              {filtered.map((lead) => {
                const isExpanded = expandedId === lead.id;
                const fecha = lead.fecha_contacto ? new Date(lead.fecha_contacto) : null;

                return (
                  <div key={lead.id}>
                    {/* Main row */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_120px_140px_180px] gap-2 md:gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                      onClick={() => toggleRow(lead.id)}
                    >
                      {/* Estado */}
                      <div className="flex items-center gap-1.5">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        }
                        <Badge estado={lead.estado} />
                      </div>

                      {/* Nombre */}
                      <span className="font-medium text-gray-900 text-sm truncate">{lead.nombre}</span>

                      {/* Email */}
                      <span className="text-sm text-gray-600 truncate">{lead.email}</span>

                      {/* Teléfono */}
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        {lead.telefono
                          ? <><Phone className="w-3.5 h-3.5 flex-shrink-0" />{lead.telefono}</>
                          : <span className="text-gray-300">—</span>
                        }
                      </span>

                      {/* Fecha */}
                      <span className="text-sm text-gray-500">
                        {fecha
                          ? fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                          : '—'
                        }
                      </span>

                      {/* Acciones */}
                      <div
                        className="flex items-center gap-1 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.estado !== 'convertido' && (
                          <button
                            onClick={() => setConvertirLead(lead)}
                            title="Convertir a cliente"
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Convertir</span>
                          </button>
                        )}
                        {lead.estado === 'nuevo' && (
                          <button
                            onClick={() => updateEstado(lead.id, 'contactado')}
                            title="Marcar como contactado"
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Contactado</span>
                          </button>
                        )}
                        {lead.estado !== 'descartado' && lead.estado !== 'convertido' && (
                          <button
                            onClick={() => handleDescartar(lead)}
                            title="Descartar"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => eliminarLead(lead)}
                          title="Eliminar lead"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {isExpanded && (
                      <div className="px-6 pb-5 pt-0 bg-blue-50/40 border-t border-blue-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Mensaje</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {lead.mensaje || <span className="italic text-gray-400">Sin mensaje</span>}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Asunto</p>
                              <p className="text-sm text-gray-700">{lead.asunto || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Fecha completa</p>
                              <p className="text-sm text-gray-700">
                                {fecha
                                  ? fecha.toLocaleString('es-ES', {
                                      day: '2-digit', month: 'long', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit',
                                    })
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Origen</p>
                              <p className="text-sm text-gray-700 capitalize">{lead.origen || '—'}</p>
                            </div>
                            {lead.notas && (
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notas</p>
                                <p className="text-sm text-gray-700">{lead.notas}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal convertir */}
      {convertirLead && (
        <ConvertirClienteDialog
          lead={convertirLead}
          isOpen={true}
          onClose={() => setConvertirLead(null)}
          onSuccess={() => { setConvertirLead(null); fetchLeads(); }}
        />
      )}
    </div>
  );
}
