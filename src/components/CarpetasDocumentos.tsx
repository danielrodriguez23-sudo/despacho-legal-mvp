import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Folder, Plus, Search, Upload, File, Trash2, Edit2, X, FolderUp } from 'lucide-react';

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

  // Selecciona automáticamente la primera carpeta cuando se cargan
  useEffect(() => {
    if (!selectedCarpeta && carpetas.length > 0) {
      setSelectedCarpeta(carpetas[0].id);
    }
  }, [carpetas, selectedCarpeta]);
  const [showNewCarpeta, setShowNewCarpeta] = useState(false);
  const [newCarpetaNombre, setNewCarpetaNombre] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingCarpeta, setEditingCarpeta] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');

  useEffect(() => {
    loadCarpetas();
    loadDocumentos();
  }, [expedienteId]);

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
      .insert({
        expediente_id: expedienteId,
        nombre: newCarpetaNombre.trim(),
      });

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

    // 1. Obtener documentos de la carpeta
    const { data: docs, error: fetchErr } = await supabase
      .from('documentos')
      .select('id, storage_path')
      .eq('carpeta_id', id);

    if (fetchErr) {
      console.error('Error obteniendo documentos:', fetchErr);
      alert('Error al eliminar carpeta');
      return;
    }

    // 2. Borrar archivos del storage
    const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from('Documentos').remove(paths);
      if (storageErr) console.error('Error borrando del storage:', storageErr);
    }

    // 3. Borrar filas de documentos
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

    // 4. Borrar la carpeta
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${expedienteId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('Documentos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('documentos')
        .insert({
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
      // Agrupar archivos por carpeta de primer nivel (webkitRelativePath)
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
        // Crear la carpeta
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

    const { error } = await supabase
      .from('documentos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting documento:', error);
      alert('Error al eliminar documento');
      return;
    }

    loadDocumentos();
  };

  const openDocumento = async (doc: Documento) => {
    if (doc.storage_path) {
      const { data, error } = await supabase.storage
        .from('Documentos')
        .createSignedUrl(doc.storage_path, 60);
      if (error || !data) {
        alert(`Error al abrir documento: ${error?.message ?? 'desconocido'}`);
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (doc.url) {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
      return;
    }
    alert('Este documento no tiene archivo asociado.');
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

  // Filtrar documentos
  const filteredDocumentos = documentos.filter((doc) => {
    const matchesSearch = 
      doc.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCarpeta = 
      selectedCarpeta === null || 
      doc.carpeta_id === selectedCarpeta;

    return matchesSearch && matchesCarpeta;
  });

  // Filtrar carpetas por búsqueda
  const filteredCarpetas = carpetas.filter((carpeta) =>
    carpeta.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Contar documentos por carpeta
  const getDocCount = (carpetaId: string) => {
    return documentos.filter((doc) => doc.carpeta_id === carpetaId).length;
  };

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda */}
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

      {/* Modal nueva carpeta */}
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

      {/* Lista de carpetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCarpetas.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            Aún no hay carpetas. Crea la primera para empezar a organizar documentos.
          </div>
        )}

        {/* Carpetas creadas */}
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

      {/* Lista de documentos */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {selectedCarpeta
              ? `Documentos en: ${carpetas.find((c) => c.id === selectedCarpeta)?.nombre ?? '—'}`
              : 'Selecciona una carpeta'}
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
                      onClick={() => openDocumento(doc)}
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
    </div>
  );
}
