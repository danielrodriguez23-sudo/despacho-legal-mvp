import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Folder, Plus, Search, Upload, File, Trash2, Edit2, FolderUp } from 'lucide-react';
import DocumentoViewer from './documentos/DocumentoViewer';

interface Carpeta {
  id: string;
  nombre: string;
  color: string;
  created_at: string;
}

interface Documento {
  id: string;
  nombre: string;
  url: string | null;
  tipo: string | null;
  storage_path: string | null;
  carpeta_id: string | null;
  created_at: string;
}

export default function CarpetasDocumentos({ expedienteId }: { expedienteId: string }) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarpeta, setSelectedCarpeta] = useState<string | null>(null);
  const [showNewCarpeta, setShowNewCarpeta] = useState(false);
  const [newCarpetaNombre, setNewCarpetaNombre] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingCarpeta, setEditingCarpeta] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [viewingDoc, setViewingDoc] = useState<Documento | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadCarpetas();
    loadDocumentos();
  }, [expedienteId]);

  // selectedCarpeta = null muestra todos los documentos

  const loadCarpetas = async () => {
    const { data, error } = await supabase
      .from('carpetas_documentos')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading carpetas:', error);
      return;
    }
    setCarpetas(data || []);
  };

  const loadDocumentos = async () => {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading documentos:', error);
      return;
    }
    setDocumentos(data || []);
  };

  const createCarpeta = async () => {
    if (!newCarpetaNombre.trim()) return;
    const { error } = await supabase
      .from('carpetas_documentos')
      .insert({ expediente_id: expedienteId, nombre: newCarpetaNombre.trim() });
    if (error) {
      console.error('Error creating carpeta:', error);
      alert('Error al crear carpeta');
      return;
    }
    setNewCarpetaNombre('');
    setShowNewCarpeta(false);
    loadCarpetas();
  };

  const updateCarpeta = async (id: string) => {
    if (!editNombre.trim()) return;
    const { error } = await supabase
      .from('carpetas_documentos')
      .update({ nombre: editNombre.trim() })
      .eq('id', id);
    if (error) {
      console.error('Error updating carpeta:', error);
      alert('Error al actualizar carpeta');
      return;
    }
    setEditingCarpeta(null);
    setEditNombre('');
    loadCarpetas();
  };

  const deleteCarpeta = async (id: string) => {
    if (!confirm('¿Eliminar esta carpeta y TODOS los documentos que contiene? Esta acción no se puede deshacer.')) return;

    const { data: docs, error: fetchErr } = await supabase
      .from('documentos')
      .select('id, storage_path')
      .eq('carpeta_id', id);
    if (fetchErr) {
      console.error('Error obteniendo documentos:', fetchErr);
      alert('Error al eliminar carpeta');
      return;
    }

    const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from('Documentos').remove(paths);
      if (storageErr) console.error('Error borrando del storage:', storageErr);
    }

    if ((docs ?? []).length > 0) {
      const { error: docsErr } = await supabase
        .from('documentos')
        .delete()
        .eq('carpeta_id', id);
      if (docsErr) {
        console.error('Error borrando documentos:', docsErr);
        alert('Error al eliminar documentos de la carpeta');
        return;
      }
    }

    const { error } = await supabase
      .from('carpetas_documentos')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting carpeta:', error);
      alert('Error al eliminar carpeta');
      return;
    }

    loadCarpetas();
    loadDocumentos();
    if (selectedCarpeta === id) setSelectedCarpeta(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, carpetaId: string | null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${expedienteId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('Documentos')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documentos').insert({
        expediente_id: expedienteId,
        carpeta_id: carpetaId,
        nombre: file.name,
        storage_path: filePath,
        tipo_mime: file.type || null,
        tamanio_bytes: file.size,
      });
      if (dbError) throw dbError;

      loadDocumentos();
      alert('Documento subido correctamente');
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error al subir documento');
    } finally {
      setUploading(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const grupos = new Map<string, File[]>();
      for (const f of Array.from(files)) {
        const rel = (f as any).webkitRelativePath as string | undefined;
        const topLevel = rel ? rel.split('/')[0] : 'Sin nombre';
        if (!grupos.has(topLevel)) grupos.set(topLevel, []);
        grupos.get(topLevel)!.push(f);
      }

      let okCount = 0;
      let errCount = 0;

      for (const [nombreCarpeta, archivos] of grupos.entries()) {
        const { data: carpetaData, error: carpetaErr } = await supabase
          .from('carpetas_documentos')
          .insert({ expediente_id: expedienteId, nombre: nombreCarpeta })
          .select('id')
          .single();

        if (carpetaErr || !carpetaData) {
          console.error('Error creando carpeta:', carpetaErr);
          errCount += archivos.length;
          continue;
        }

        for (const file of archivos) {
          try {
            const fileName = `${Date.now()}_${file.name}`;
            const filePath = `${expedienteId}/${fileName}`;

            const { error: upErr } = await supabase.storage
              .from('Documentos')
              .upload(filePath, file);
            if (upErr) throw upErr;

            const { error: dbErr } = await supabase.from('documentos').insert({
              expediente_id: expedienteId,
              carpeta_id: carpetaData.id,
              nombre: file.name,
              storage_path: filePath,
              tipo_mime: file.type || null,
              tamanio_bytes: file.size,
            });
            if (dbErr) throw dbErr;
            okCount++;
          } catch (err) {
            console.error('Error subiendo archivo:', file.name, err);
            errCount++;
          }
        }
      }

      await loadCarpetas();
      await loadDocumentos();
      alert(`Subida completada: ${okCount} archivos${errCount ? `, ${errCount} con error` : ''}`);
    } catch (err) {
      console.error('Error subiendo carpeta:', err);
      alert('Error al subir la carpeta');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteDocumento = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return;
    const doc = documentos.find((d) => d.id === id);
    if (doc?.storage_path) {
      await supabase.storage.from('Documentos').remove([doc.storage_path]);
    }
    const { error } = await supabase.from('documentos').delete().eq('id', id);
    if (error) {
      console.error('Error deleting documento:', error);
      alert('Error al eliminar documento');
      return;
    }
    loadDocumentos();
  };

  const moveDocumento = async (docId: string, newCarpetaId: string | null) => {
    const { error } = await supabase
      .from('documentos')
      .update({ carpeta_id: newCarpetaId })
      .eq('id', docId);
    if (error) {
      console.error('Error moving documento:', error);
      return;
    }
    loadDocumentos();
  };

  const filteredDocumentos = documentos.filter((doc) => {
    const matchesSearch = doc.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCarpeta = selectedCarpeta === null || doc.carpeta_id === selectedCarpeta;
    return matchesSearch && matchesCarpeta;
  });

  const filteredCarpetas = carpetas.filter((carpeta) =>
    carpeta.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDocCount = (carpetaId: string) => {
    return documentos.filter((doc) => doc.carpeta_id === carpetaId).length;
  };

  // Lee recursivamente archivos de un FileSystemEntry
  const readAllFiles = (entry: FileSystemEntry): Promise<{ file: File; folderName: string }[]> => {
    const topName = entry.name;
    const collect = (e: FileSystemEntry): Promise<File[]> => {
      if (e.isFile) {
        return new Promise((res) => (e as FileSystemFileEntry).file((f) => res([f])));
      }
      if (e.isDirectory) {
        const reader = (e as FileSystemDirectoryEntry).createReader();
        return new Promise((res) => {
          reader.readEntries(async (entries) => {
            const all = await Promise.all(entries.map(collect));
            res(all.flat());
          });
        });
      }
      return Promise.resolve([]);
    };
    return collect(entry).then((files) => files.map((f) => ({ file: f, folderName: topName })));
  };

  const processDroppedItems = async (entries: FileSystemEntry[], rawFiles: File[]) => {
    if (uploading) return;
    setUploading(true);
    let okCount = 0;
    let errCount = 0;

    try {
      const hasFolders = entries.some((e) => e.isDirectory);

      if (hasFolders && entries.length > 0) {
        // Hay carpetas: usar entries API
        for (const entry of entries) {
          if (entry.isDirectory) {
            const items = await readAllFiles(entry);
            const { data: carpetaData, error: carpetaErr } = await supabase
              .from('carpetas_documentos')
              .insert({ expediente_id: expedienteId, nombre: entry.name })
              .select('id')
              .single();
            if (carpetaErr || !carpetaData) { errCount += items.length; continue; }

            for (const { file } of items) {
              try {
                const filePath = `${expedienteId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
                const { error: upErr } = await supabase.storage.from('Documentos').upload(filePath, file);
                if (upErr) throw upErr;
                const { error: dbErr } = await supabase.from('documentos').insert({
                  expediente_id: expedienteId, carpeta_id: carpetaData.id,
                  nombre: file.name, storage_path: filePath,
                  tipo_mime: file.type || null, tamanio_bytes: file.size,
                });
                if (dbErr) throw dbErr;
                okCount++;
              } catch { errCount++; }
            }
          } else {
            // Archivo suelto junto a carpetas
            try {
              const file = await new Promise<File>((res) =>
                (entry as FileSystemFileEntry).file((f) => res(f))
              );
              const filePath = `${expedienteId}/${Date.now()}_${file.name}`;
              const { error: upErr } = await supabase.storage.from('Documentos').upload(filePath, file);
              if (upErr) throw upErr;
              const { error: dbErr } = await supabase.from('documentos').insert({
                expediente_id: expedienteId, carpeta_id: selectedCarpeta,
                nombre: file.name, storage_path: filePath,
                tipo_mime: file.type || null, tamanio_bytes: file.size,
              });
              if (dbErr) throw dbErr;
              okCount++;
            } catch { errCount++; }
          }
        }
      } else {
        // Solo archivos sueltos: usar rawFiles (más fiable)
        const filesToUpload = rawFiles.length > 0 ? rawFiles : [];
        for (const file of filesToUpload) {
          try {
            const filePath = `${expedienteId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
            const { error: upErr } = await supabase.storage.from('Documentos').upload(filePath, file);
            if (upErr) throw upErr;
            const { error: dbErr } = await supabase.from('documentos').insert({
              expediente_id: expedienteId, carpeta_id: selectedCarpeta,
              nombre: file.name, storage_path: filePath,
              tipo_mime: file.type || null, tamanio_bytes: file.size,
            });
            if (dbErr) throw dbErr;
            okCount++;
          } catch { errCount++; }
        }
      }

      await loadCarpetas();
      await loadDocumentos();
      if (okCount > 0 || errCount > 0) {
        alert(`Subida completada: ${okCount} archivos${errCount ? `, ${errCount} con error` : ''}`);
      }
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    let depth = 0;
    const onOver = (e: DragEvent) => e.preventDefault();
    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      depth++;
      if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      depth--;
      if (depth <= 0) { depth = 0; setIsDragging(false); }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setIsDragging(false);

      // Capturar entries y files síncronamente
      const entries: FileSystemEntry[] = [];
      const rawFiles: File[] = [];
      if (e.dataTransfer?.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const entry = e.dataTransfer.items[i].webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }
      }
      if (e.dataTransfer?.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          rawFiles.push(e.dataTransfer.files[i]);
        }
      }
      if (entries.length === 0 && rawFiles.length === 0) return;
      processDroppedItems(entries, rawFiles);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  });

  return (
    <div className="space-y-6 relative">
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-blue-600/20 backdrop-blur-sm rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white border-4 border-dashed border-blue-600 rounded-2xl px-12 py-10 text-center shadow-2xl">
            <FolderUp className="w-14 h-14 mx-auto text-blue-600 mb-3" />
            <p className="text-lg font-semibold text-gray-900">
              Suelta archivos o carpetas
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Carpetas se crean automáticamente · Archivos sueltos van al expediente
            </p>
          </div>
        </div>
      )}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Buscar carpetas o documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <label className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer">
          <FolderUp className="h-5 w-5" />
          {uploading ? 'Subiendo...' : 'Subir Carpeta'}
          <input
            type="file"
            multiple
            onChange={handleFolderUpload}
            className="hidden"
            disabled={uploading}
            // @ts-expect-error webkitdirectory no está en los tipos de React
            webkitdirectory=""
            directory=""
          />
        </label>
        <button
          onClick={() => setShowNewCarpeta(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nueva Carpeta
        </button>
      </div>

      {showNewCarpeta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Nueva Carpeta</h3>
            <input
              type="text"
              placeholder="Nombre de la carpeta"
              value={newCarpetaNombre}
              onChange={(e) => setNewCarpetaNombre(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createCarpeta()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewCarpeta(false);
                  setNewCarpetaNombre('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={createCarpeta}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Botón "Todos los documentos" */}
        <div
          onClick={() => setSelectedCarpeta(null)}
          className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg ${
            selectedCarpeta === null
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <File className="h-8 w-8 text-gray-500 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-gray-900">Todos</h3>
              <p className="text-sm text-gray-500">{documentos.length} documentos</p>
            </div>
          </div>
        </div>

        {filteredCarpetas.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            Arrastra carpetas o archivos aquí, o crea una carpeta manualmente.
          </div>
        )}

        {filteredCarpetas.map((carpeta) => (
          <div
            key={carpeta.id}
            onClick={() => setSelectedCarpeta(carpeta.id)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg ${
              selectedCarpeta === carpeta.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Folder className="h-8 w-8 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  {editingCarpeta === carpeta.id ? (
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && updateCarpeta(carpeta.id)}
                      onBlur={() => updateCarpeta(carpeta.id)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3 className="font-medium text-gray-900 truncate">{carpeta.nombre}</h3>
                  )}
                  <p className="text-sm text-gray-500">{getDocCount(carpeta.id)} documentos</p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCarpeta(carpeta.id);
                    setEditNombre(carpeta.nombre);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 className="h-4 w-4 text-gray-600" />
                </button>
                <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg">
                  <Upload className="h-4 w-4 text-gray-600" />
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, carpeta.id)}
                    className="hidden"
                    disabled={uploading}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCarpeta(carpeta.id);
                  }}
                  className="p-2 hover:bg-red-100 rounded-lg"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {selectedCarpeta
              ? `Documentos en: ${carpetas.find((c) => c.id === selectedCarpeta)?.nombre ?? '—'}`
              : 'Todos los documentos'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {filteredDocumentos.length} documentos
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredDocumentos.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No hay documentos
              {searchTerm && ' que coincidan con la búsqueda'}
            </div>
          ) : (
            filteredDocumentos.map((doc) => (
              <div
                key={doc.id}
                className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setViewingDoc(doc)}
                      className="font-medium text-gray-900 hover:text-blue-600 truncate block text-left w-full"
                    >
                      {doc.nombre}
                    </button>
                    <p className="text-sm text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString('es-ES')}
                      {doc.carpeta_id && (
                        <> · {carpetas.find((c) => c.id === doc.carpeta_id)?.nombre}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <select
                    value={doc.carpeta_id || ''}
                    onChange={(e) => moveDocumento(doc.id, e.target.value || null)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    {carpetas.map((carpeta) => (
                      <option key={carpeta.id} value={carpeta.id}>
                        {carpeta.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteDocumento(doc.id)}
                    className="p-2 hover:bg-red-100 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {viewingDoc && (
        <DocumentoViewer
          isOpen={true}
          onClose={() => setViewingDoc(null)}
          nombre={viewingDoc.nombre}
          storagePath={viewingDoc.storage_path ?? ''}
          tipoMime={viewingDoc.tipo ?? null}
        />
      )}
    </div>
  );
}
