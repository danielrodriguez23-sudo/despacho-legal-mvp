import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Download,
  FileImage,
  File as FileIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import DocumentoDialog from "../components/documentos/DocumentoDialog";

type Categoria =
  | "contrato"
  | "escrito"
  | "sentencia"
  | "poder"
  | "factura"
  | "otro";

type CategoriaFiltro = "todas" | Categoria;
type ClienteFiltro = "todos" | string;
type ExpedienteFiltro = "todos" | string;

interface DocumentoRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  storage_path: string;
  tipo_mime: string | null;
  tamanio_bytes: number | null;
  cliente_id: string | null;
  expediente_id: string | null;
  categoria: Categoria | null;
  etiquetas: string[] | null;
  notas: string | null;
  created_at: string | null;
  clientes: { id: string; nombre: string; apellidos: string | null } | null;
  expedientes: {
    id: string;
    numero_expediente: string;
    titulo: string;
  } | null;
}

const BUCKET = "Documentos";

const categoriaBadge: Record<Categoria, string> = {
  contrato: "bg-blue-100 text-blue-700",
  escrito: "bg-green-100 text-green-700",
  sentencia: "bg-red-100 text-red-700",
  poder: "bg-purple-100 text-purple-700",
  factura: "bg-orange-100 text-orange-700",
  otro: "bg-gray-100 text-gray-700",
};

const categoriaLabel: Record<Categoria, string> = {
  contrato: "Contrato",
  escrito: "Escrito",
  sentencia: "Sentencia",
  poder: "Poder",
  factura: "Factura",
  otro: "Otro",
};

const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatFecha = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

export default function Documentos() {
  const [rows, setRows] = useState<DocumentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] =
    useState<CategoriaFiltro>("todas");
  const [clienteFiltro, setClienteFiltro] = useState<ClienteFiltro>("todos");
  const [expedienteFiltro, setExpedienteFiltro] =
    useState<ExpedienteFiltro>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchDocumentos = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("documentos")
      .select(
        `id, nombre, descripcion, storage_path, tipo_mime, tamanio_bytes,
         cliente_id, expediente_id, categoria, etiquetas, notas, created_at,
         clientes(id, nombre, apellidos),
         expedientes(id, numero_expediente, titulo)`
      )
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as DocumentoRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocumentos();
  }, []);

  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.clientes) {
        const nombre = [r.clientes.nombre, r.clientes.apellidos]
          .filter(Boolean)
          .join(" ");
        map.set(r.clientes.id, nombre);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const expedientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.expedientes) {
        map.set(
          r.expedientes.id,
          `${r.expedientes.numero_expediente} · ${r.expedientes.titulo}`
        );
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoriaFiltro !== "todas" && r.categoria !== categoriaFiltro)
        return false;
      if (clienteFiltro !== "todos" && r.cliente_id !== clienteFiltro)
        return false;
      if (expedienteFiltro !== "todos" && r.expediente_id !== expedienteFiltro)
        return false;
      if (!term) return true;
      const etiquetasStr = (r.etiquetas ?? []).join(" ");
      const haystack = [
        r.nombre,
        r.categoria ?? "",
        r.descripcion ?? "",
        r.notas ?? "",
        etiquetasStr,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, categoriaFiltro, clienteFiltro, expedienteFiltro]);

  const handleNew = () => {
    setEditingId(undefined);
    setDroppedFile(null);
    setDialogOpen(true);
  };

  // Drag & drop a nivel de página
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      depth++;
      setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      depth--;
      if (depth <= 0) {
        depth = 0;
        setIsDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      setEditingId(undefined);
      setDroppedFile(file);
      setDialogOpen(true);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDownload = async (row: DocumentoRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60);
    if (error || !data) {
      alert(`Error al generar enlace: ${error?.message ?? "desconocido"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (row: DocumentoRow) => {
    if (!confirm(`¿Eliminar el documento "${row.nombre}"?`)) return;

    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .remove([row.storage_path]);
    if (storageErr) {
      console.warn("Storage remove error:", storageErr.message);
    }

    const { error: dbErr } = await supabase
      .from("documentos")
      .delete()
      .eq("id", row.id);
    if (dbErr) {
      alert(`Error al eliminar: ${dbErr.message}`);
      return;
    }
    fetchDocumentos();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-sm text-gray-600 mt-1">
            {rows.length} {rows.length === 1 ? "documento" : "documentos"} en total
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Subir documento
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, etiquetas, notas..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value as CategoriaFiltro)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todas">Todos los tipos</option>
          <option value="contrato">Contrato</option>
          <option value="escrito">Escrito</option>
          <option value="sentencia">Sentencia</option>
          <option value="poder">Poder</option>
          <option value="factura">Factura</option>
          <option value="otro">Otro</option>
        </select>
        <select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los clientes</option>
          {clientesUnicos.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <select
          value={expedienteFiltro}
          onChange={(e) => setExpedienteFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="todos">Todos los expedientes</option>
          {expedientesUnicos.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando documentos...</div>
        ) : error ? (
          <div className="p-6 text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {rows.length === 0
                ? "Aún no hay documentos. Sube el primero."
                : "No hay documentos que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Nombre
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Cliente / Expediente
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Tamaño
                  </th>
                  <th className="text-left font-semibold text-gray-700 px-4 py-3">
                    Subido
                  </th>
                  <th className="text-right font-semibold text-gray-700 px-4 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const Icon = getFileIcon(r.tipo_mime, r.nombre);
                  const cliente = r.clientes
                    ? [r.clientes.nombre, r.clientes.apellidos]
                        .filter(Boolean)
                        .join(" ")
                    : null;
                  const cat = r.categoria ?? "otro";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleDownload(r)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate max-w-xs">
                              {r.nombre}
                            </div>
                            {r.etiquetas && r.etiquetas.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.etiquetas.map((t, i) => (
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
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${categoriaBadge[cat]}`}
                        >
                          {categoriaLabel[cat]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.expedientes ? (
                          <div>
                            <div className="text-xs font-mono text-gray-500">
                              {r.expedientes.numero_expediente}
                            </div>
                            <div className="truncate max-w-xs">
                              {r.expedientes.titulo}
                            </div>
                            {cliente && (
                              <div className="text-xs text-gray-500">{cliente}</div>
                            )}
                          </div>
                        ) : cliente ? (
                          <div>{cliente}</div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatBytes(r.tamanio_bytes)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatFecha(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(r);
                            }}
                            className="p-2 rounded-md hover:bg-green-50 text-green-600"
                            title="Ver / Descargar"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(r.id);
                            }}
                            className="p-2 rounded-md hover:bg-blue-50 text-blue-600"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(r);
                            }}
                            className="p-2 rounded-md hover:bg-red-50 text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentoDialog
        isOpen={dialogOpen}
        documentoId={editingId}
        initialFile={droppedFile}
        onClose={() => {
          setDialogOpen(false);
          setDroppedFile(null);
        }}
        onSaved={fetchDocumentos}
      />

      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-600/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white border-4 border-dashed border-blue-600 rounded-2xl px-12 py-10 text-center shadow-2xl">
            <FileText className="w-14 h-14 mx-auto text-blue-600 mb-3" />
            <p className="text-lg font-semibold text-gray-900">
              Suelta el archivo para subirlo
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PDF, DOCX, DOC, JPG o PNG (máx. 10 MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
