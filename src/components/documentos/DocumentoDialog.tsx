import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

type Categoria =
  | "contrato"
  | "escrito"
  | "sentencia"
  | "poder"
  | "factura"
  | "otro";

interface DocumentoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  documentoId?: string;
  defaultExpedienteId?: string;
  defaultClienteId?: string;
  initialFile?: File | null;
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
}

const BUCKET = "Documentos";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = ["pdf", "docx", "doc", "jpg", "jpeg", "png"];

interface CarpetaOption {
  id: string;
  nombre: string;
}

const emptyForm = () => ({
  nombre: "",
  categoria: "otro" as Categoria,
  cliente_id: "",
  expediente_id: "",
  carpeta_id: "",
  etiquetas: "",
  notas: "",
  descripcion: "",
});

const getExtension = (filename: string) =>
  filename.split(".").pop()?.toLowerCase() ?? "";

const sanitizeFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

export default function DocumentoDialog({
  isOpen,
  onClose,
  onSaved,
  documentoId,
  defaultExpedienteId,
  defaultClienteId,
  initialFile,
}: DocumentoDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(emptyForm());
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteOption[]>([]);
  const [carpetas, setCarpetas] = useState<CarpetaOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const isEdit = Boolean(documentoId);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setFile(initialFile ?? null);
    setProgress(0);

    supabase
      .from("clientes")
      .select("id, nombre, apellidos")
      .order("nombre", { ascending: true })
      .then(({ data }) => setClientes((data ?? []) as ClienteOption[]));

    supabase
      .from("expedientes")
      .select("id, numero_expediente, titulo")
      .order("fecha_inicio", { ascending: false })
      .then(({ data }) => setExpedientes((data ?? []) as ExpedienteOption[]));

    if (documentoId) {
      supabase
        .from("documentos")
        .select("*")
        .eq("id", documentoId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setError("Error al cargar documento");
            return;
          }
          if (data) {
            setFormData({
              nombre: data.nombre ?? "",
              categoria: (data.categoria as Categoria) ?? "otro",
              cliente_id: data.cliente_id ?? "",
              expediente_id: data.expediente_id ?? "",
              carpeta_id: data.carpeta_id ?? "",
              etiquetas: Array.isArray(data.etiquetas)
                ? data.etiquetas.join(", ")
                : "",
              notas: data.notas ?? "",
              descripcion: data.descripcion ?? "",
            });
          }
        });
    } else {
      setFormData({
        ...emptyForm(),
        nombre: initialFile ? initialFile.name.replace(/\.[^.]+$/, "") : "",
        expediente_id: defaultExpedienteId ?? "",
        cliente_id: defaultClienteId ?? "",
      });
    }
  }, [isOpen, documentoId, defaultExpedienteId, defaultClienteId, initialFile]);

  // Cargar carpetas cuando cambia el expediente seleccionado
  useEffect(() => {
    if (!formData.expediente_id) {
      setCarpetas([]);
      return;
    }
    supabase
      .from("carpetas_documentos")
      .select("id, nombre")
      .eq("expediente_id", formData.expediente_id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setCarpetas((data ?? []) as CarpetaOption[]));
  }, [formData.expediente_id]);

  if (!isOpen) return null;

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) => setFormData((f) => ({ ...f, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    const ext = getExtension(f.name);
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Formato no permitido. Usa: ${ALLOWED_EXT.join(", ")}`);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("El archivo supera el tamaño máximo de 10 MB");
      return;
    }
    setError("");
    setFile(f);
    if (!formData.nombre.trim()) {
      set("nombre", f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!isEdit && !file) {
      setError("Debes seleccionar un archivo");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const etiquetasArr = formData.etiquetas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const basePayload = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        cliente_id: formData.cliente_id || null,
        expediente_id: formData.expediente_id || null,
        carpeta_id:
          formData.expediente_id && formData.carpeta_id
            ? formData.carpeta_id
            : null,
        etiquetas: etiquetasArr.length > 0 ? etiquetasArr : null,
        notas: formData.notas.trim() || null,
        descripcion: formData.descripcion.trim() || null,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("documentos")
          .update(basePayload)
          .eq("id", documentoId);
        if (error) throw error;
      } else {
        if (!file) throw new Error("Archivo no seleccionado");

        const ext = getExtension(file.name);
        const safeName = sanitizeFilename(file.name);
        const path = `${crypto.randomUUID()}/${safeName}`;

        setProgress(25);

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
        if (upErr) throw upErr;

        setProgress(75);

        const insertPayload = {
          ...basePayload,
          storage_path: path,
          tipo_mime: file.type || `application/${ext}`,
          tamanio_bytes: file.size,
          uploaded_by: user?.id ?? null,
        };

        const { error: insErr } = await supabase
          .from("documentos")
          .insert([insertPayload]);
        if (insErr) {
          // Rollback: borra el archivo subido
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }

        setProgress(100);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar documento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? "Editar documento" : "Subir documento"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo *
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Máx. 10 MB. Formatos: PDF, DOCX, DOC, JPG, PNG.
              </p>
              {file && (
                <p className="text-xs text-gray-700 mt-1">
                  <span className="font-medium">{file.name}</span> ·{" "}
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={formData.categoria}
              onChange={(e) => set("categoria", e.target.value as Categoria)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="contrato">Contrato</option>
              <option value="escrito">Escrito</option>
              <option value="sentencia">Sentencia</option>
              <option value="poder">Poder</option>
              <option value="factura">Factura</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                Expediente
              </label>
              <select
                value={formData.expediente_id}
                onChange={(e) => {
                  set("expediente_id", e.target.value);
                  set("carpeta_id", "");
                }}
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
          </div>

          {formData.expediente_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carpeta del expediente
              </label>
              <select
                value={formData.carpeta_id}
                onChange={(e) => set("carpeta_id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={carpetas.length === 0}
              >
                <option value="">
                  {carpetas.length === 0
                    ? "-- El expediente no tiene carpetas --"
                    : "-- Sin carpeta --"}
                </option>
                {carpetas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Etiquetas
            </label>
            <input
              type="text"
              value={formData.etiquetas}
              onChange={(e) => set("etiquetas", e.target.value)}
              placeholder="laboral, urgente, revisar (separadas por comas)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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

          {loading && !isEdit && (
            <div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Subiendo... {progress}%</p>
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
                : isEdit
                ? "Guardar cambios"
                : "Subir documento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
