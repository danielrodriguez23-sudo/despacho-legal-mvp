import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import ExpedienteDialog from "../components/expedientes/ExpedienteDialog";
import CarpetasDocumentos from "../components/CarpetasDocumentos";

type Estado = "abierto" | "cerrado" | "archivado";

interface ExpedienteDetalle {
  id: string;
  numero_expediente: string;
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
  created_at: string;
  updated_at: string | null;
  clientes: {
    id: string;
    nombre: string;
    apellidos: string | null;
    email: string | null;
    telefono: string | null;
    dni_nif: string | null;
  } | null;
  abogado_responsable:
    | { id: string; full_name: string | null; email: string }
    | null;
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
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{children ?? "—"}</dd>
    </div>
  );
}

export default function ExpedienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expediente, setExpediente] = useState<ExpedienteDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchExpediente = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("expedientes")
      .select(
        `id, numero_expediente, titulo, materia, tipo_procedimiento, juzgado,
         numero_procedimiento, parte_contraria, abogado_contrario, estado,
         fecha_inicio, fecha_cierre, descripcion, created_at, updated_at,
         clientes(id, nombre, apellidos, email, telefono, dni_nif),
         abogado_responsable:profiles!expedientes_abogado_responsable_id_fkey(id, full_name, email)`
      )
      .eq("id", id)
      .single();

    if (error) {
      setError(error.message);
      setExpediente(null);
    } else {
      setExpediente(data as unknown as ExpedienteDetalle);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExpediente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    if (!expediente) return;
    if (
      !confirm(
        `¿Eliminar el expediente "${expediente.numero_expediente}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    const { error } = await supabase
      .from("expedientes")
      .delete()
      .eq("id", expediente.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    navigate("/expedientes");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Cargando expediente...</div>
      </div>
    );
  }

  if (error || !expediente) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate("/expedientes")}
          className="flex items-center gap-2 text-blue-600 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a expedientes
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error ?? "Expediente no encontrado"}
        </div>
      </div>
    );
  }

  const clienteNombre = expediente.clientes
    ? [expediente.clientes.nombre, expediente.clientes.apellidos]
        .filter(Boolean)
        .join(" ")
    : "—";

  return (
    <div className="p-6">
      <button
        onClick={() => navigate("/expedientes")}
        className="flex items-center gap-2 text-blue-600 hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a expedientes
      </button>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {expediente.titulo}
            </h1>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${estadoBadge[expediente.estado]}`}
            >
              {estadoLabel[expediente.estado]}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Expediente{" "}
            <span className="font-mono font-semibold">
              {expediente.numero_expediente}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Información general
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Materia">{expediente.materia}</Field>
              <Field label="Tipo procedimiento">
                {expediente.tipo_procedimiento}
              </Field>
              <Field label="Juzgado">{expediente.juzgado}</Field>
              <Field label="Número procedimiento">
                {expediente.numero_procedimiento}
              </Field>
              <Field label="Fecha inicio">
                {formatDate(expediente.fecha_inicio)}
              </Field>
              <Field label="Fecha cierre">
                {formatDate(expediente.fecha_cierre)}
              </Field>
              <Field label="Parte contraria">{expediente.parte_contraria}</Field>
              <Field label="Abogado contrario">
                {expediente.abogado_contrario}
              </Field>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Descripción
            </h2>
            {expediente.descripcion ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {expediente.descripcion}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin descripción</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Cliente
            </h2>
            {expediente.clientes ? (
              <dl className="space-y-3">
                <Field label="Nombre">
                  <button
                    onClick={() => navigate(`/clientes`)}
                    className="text-blue-600 hover:underline text-left"
                  >
                    {clienteNombre}
                  </button>
                </Field>
                <Field label="DNI / NIF">{expediente.clientes.dni_nif}</Field>
                <Field label="Email">{expediente.clientes.email}</Field>
                <Field label="Teléfono">{expediente.clientes.telefono}</Field>
              </dl>
            ) : (
              <p className="text-sm text-gray-400 italic">Cliente no encontrado</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Abogado responsable
            </h2>
            {expediente.abogado_responsable ? (
              <dl className="space-y-3">
                <Field label="Nombre">
                  {expediente.abogado_responsable.full_name ||
                    expediente.abogado_responsable.email}
                </Field>
                <Field label="Email">{expediente.abogado_responsable.email}</Field>
              </dl>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin asignar</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Metadatos
            </h2>
            <dl className="space-y-3">
              <Field label="Creado">{formatDate(expediente.created_at)}</Field>
              <Field label="Actualizado">
                {formatDate(expediente.updated_at)}
              </Field>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <CarpetasDocumentos
          expedienteId={expediente.id}
          clienteId={expediente.clientes?.id ?? null}
          numeroExpediente={expediente.numero_expediente}
          tituloExpediente={expediente.titulo}
        />
      </div>

      <ExpedienteDialog
        isOpen={dialogOpen}
        expedienteId={expediente.id}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchExpediente}
      />
    </div>
  );
}
