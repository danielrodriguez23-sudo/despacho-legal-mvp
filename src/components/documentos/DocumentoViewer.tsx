import { useEffect, useState } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";
import mammoth from "mammoth";

const BUCKET = "Documentos";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nombre: string;
  storagePath: string;
  tipoMime: string | null;
}

export default function DocumentoViewer({
  isOpen,
  onClose,
  nombre,
  storagePath,
  tipoMime,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mime = (tipoMime ?? "").toLowerCase();
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  const isPdf = mime.includes("pdf") || ext === "pdf";
  const isImage =
    mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  const isDocx =
    mime.includes("officedocument.wordprocessingml") ||
    mime.includes("msword") ||
    ["docx", "doc"].includes(ext);

  useEffect(() => {
    if (!isOpen || !storagePath) return;
    setLoading(true);
    setError("");
    setUrl(null);
    setDownloadUrl(null);
    setDocxHtml(null);

    const load = async () => {
      // Generar URLs firmadas
      const [viewRes, dlRes] = await Promise.all([
        supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300),
        supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 300, { download: nombre }),
      ]);

      if (viewRes.error || !viewRes.data) {
        setError(viewRes.error?.message ?? "Error generando URL");
        setLoading(false);
        return;
      }

      setUrl(viewRes.data.signedUrl);
      if (dlRes.data) setDownloadUrl(dlRes.data.signedUrl);

      // Si es DOCX/DOC, descargar el blob y convertir a HTML con mammoth
      if (isDocx) {
        try {
          const response = await fetch(viewRes.data.signedUrl);
          const arrayBuffer = await response.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setDocxHtml(result.value);
        } catch (err: any) {
          console.error("Error convirtiendo DOCX:", err);
          setDocxHtml(null);
          // No bloqueamos — seguimos mostrando la opción de descarga
        }
      }

      setLoading(false);
    };

    load();
  }, [isOpen, storagePath, nombre, isDocx]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0">
        <h2 className="font-medium truncate max-w-[60%]">{nombre}</h2>
        <div className="flex items-center gap-2">
          {url && !isDocx && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Nueva pestaña
            </a>
          )}
          {downloadUrl && (
            <a
              href={downloadUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {loading ? (
          <p className="text-white text-lg">Cargando documento...</p>
        ) : error ? (
          <p className="text-red-400 text-lg">{error}</p>
        ) : !url ? (
          <p className="text-gray-400">No se pudo generar el enlace</p>
        ) : isPdf ? (
          <iframe
            src={url}
            className="w-full h-full rounded-lg bg-white"
            title={nombre}
          />
        ) : isImage ? (
          <img
            src={url}
            alt={nombre}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : isDocx && docxHtml ? (
          <div className="w-full max-w-4xl h-full bg-white rounded-lg shadow-2xl overflow-auto">
            <div
              className="p-8 md:p-12 prose prose-sm md:prose-base max-w-none
                         [&_table]:border-collapse [&_table]:w-full
                         [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2
                         [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-gray-100
                         [&_img]:max-w-full [&_img]:h-auto"
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          </div>
        ) : (
          <div className="text-center text-white">
            <p className="text-lg mb-2">
              Este tipo de archivo no se puede previsualizar en el navegador.
            </p>
            <p className="text-gray-400 mb-6 text-sm">
              {nombre} ({tipoMime ?? "tipo desconocido"})
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                Descargar archivo
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
