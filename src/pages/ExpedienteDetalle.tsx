import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Download,
  FileText,
  FileImage,
  File as FileIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import ExpedienteDialog from "../components/expedientes/ExpedienteDialog";
import DocumentoDialog from "../components/documentos/DocumentoDialog";

const BUCKET = "Documentos";

type CategoriaDoc =
  | "contrato"
  | "escrito"
  | "sentencia"
  | "poder"
  | "factura"
  | "otro";

interface DocumentoItem {
  id: string;
  nombre: string;
  storage_path: string;
  tipo_mime: string | null;
  tamanio_bytes: number | null;
  categoria: CategoriaDoc | null;
  etiquetas: string[] | null;
  created_at: string | null;
}

const categoriaBadgeDoc: Record<CategoriaDoc, string> = {
  contrato: "bg-blue-100 text-blue-700",
  escrito: "bg-green-100 text-green-700",
  sentencia: "bg-red-100 text-red-700",
  poder: "bg-purple-100 text-purple-700",
  factura: "bg-orange-100 text-orange-700",
  otro: "bg-gray-100 text-gray-700",
};

const categoriaLabelDoc: Record<CategoriaDoc, string> = {
  contrato: "Contrato",
  escrito: "Escrito",
  sentencia: "Sentencia",
  poder: "Poder",
  factura: "Factura",
  otro: "Otro",
};

const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mime: string | null, name: string) => {
  const m = (mime ?? "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (m.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext))
    return FileImage;
  if (m.includes("pdf") || ext === "pdf") return FileText;
  if (m.includes("word") || ["doc", "docx"].includes(ext)) return FileText;
  return FileIcon;
};

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
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);

  const fetchDocumentos = async () => {
    if (!id) return;
    setDocsLoading(true);
    const { data } = await supabase
      .from("documentos")
      .select(
        "id, nombre, storage_path, tipo_mime, tamanio_bytes, categoria, etiquetas, created_at"
      )
      .eq("expediente_id", id)
      .order("created_at", { ascending: false });
    setDocumentos((data ?? []) as DocumentoItem[]);
    setDocsLoading(false);
  };

  const handleDownloadDoc = async (doc: DocumentoItem) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      alert(`Error al generar enlace: ${error?.message ?? "desconocido"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeleteDoc = async (doc: DocumentoItem) => {
    if (!confirm(`¿Eliminar el documento "${doc.nombre}"?`)) return;
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await supabase.from("documentos").delete().eq("id", doc.id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }
    fetchDocumentos();
  };

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
    fetchDocumentos();
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Documentos ({documentos.length})
              </h2>
              <button
                onClick={() => setDocDialogOpen(true)}
                className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Subir documento
              </button>
            </div>
            {docsLoading ? (
              <p className="text-sm text-gray-500">Cargando documentos...</p>
            ) : documentos.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  Aún no hay documentos asociados a este expediente.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {documentos.map((doc) => {
                  const Icon = getFileIcon(doc.tipo_mime, doc.nombre);
                  const cat = doc.categoria ?? "otro";
                  return (
                    <li
                      key={doc.id}
                      className="py-3 flex items-start gap-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg cursor-pointer"
                      onClick={() => handleDownloadDoc(doc)}
                    >
                      <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">
                            {doc.nombre}
                          </span>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${categoriaBadgeDoc[cat]}`}
                          >
                            {categoriaLabelDoc[cat]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatBytes(doc.tamanio_bytes)}
                          {doc.created_at && ` · ${formatDate(doc.created_at)}`}
                        </div>
                        {doc.etiquetas && doc.etiquetas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.etiquetas.map((t, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDoc(doc);
                          }}
                          className="p-1.5 rounded-md hover:bg-green-50 text-green-600"
                          title="Ver / Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(doc);
                          }}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
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

      <ExpedienteDialog
        isOpen={dialogOpen}
        expedienteId={expediente.id}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchExpediente}
      />

      <DocumentoDialog
        isOpen={docDialogOpen}
        onClose={() => setDocDialogOpen(false)}
        onSaved={fetchDocumentos}
        defaultExpedienteId={expediente.id}
        defaultClienteId={expediente.clientes?.id}
      />
    </div>
  );
}
