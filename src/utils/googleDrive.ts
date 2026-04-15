// Google Drive API utility - REST API calls with OAuth token
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const TOKEN_KEY = "google_drive_token";
const TOKEN_EXPIRY_KEY = "google_drive_token_expiry";

// ── Token management ──────────────────────────────────────────

export function saveToken(token: string, expiresIn: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    clearToken();
    return null;
  }
  return token;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  folderCache.clear();
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// ── Folder cache & mutex ──────────────────────────────────────
// Prevents race conditions: concurrent calls to findOrCreateFolder
// with the same key will share a single API call instead of each
// creating their own folder.

const folderCache = new Map<string, Promise<string>>();

function folderCacheKey(name: string, parentId?: string): string {
  return `${parentId ?? "root"}::${name}`;
}

// ── Helper: fetch con auth y retry ────────────────────────────

async function driveFetch(
  url: string,
  options: RequestInit = {},
  retries = 2
): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("No autenticado en Google Drive");

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("Token de Google Drive expirado. Reconecta tu cuenta.");
  }

  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 2000));
    return driveFetch(url, options, retries - 1);
  }

  if (!res.ok && retries > 0 && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1000));
    return driveFetch(url, options, retries - 1);
  }

  return res;
}

// ── Folder operations ─────────────────────────────────────────

export async function findFolder(
  name: string,
  parentId?: string
): Promise<string | null> {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ];
  if (parentId) q.push(`'${parentId}' in parents`);

  const params = new URLSearchParams({
    q: q.join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
  });

  const res = await driveFetch(`${DRIVE_API}/files?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Error buscando carpeta en Drive: ${err.error?.message ?? res.statusText}`
    );
  }
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function createFolder(
  name: string,
  parentId?: string
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await driveFetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Error creando carpeta en Drive: ${err.error?.message ?? res.statusText}`
    );
  }

  const data = await res.json();
  return data.id;
}

// Cached findOrCreateFolder — concurrent calls with the same name+parent
// will await the same promise, guaranteeing only ONE folder is created.
export function findOrCreateFolder(
  name: string,
  parentId?: string
): Promise<string> {
  const key = folderCacheKey(name, parentId);

  const cached = folderCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const existing = await findFolder(name, parentId);
    if (existing) return existing;
    return createFolder(name, parentId);
  })();

  // Cache the promise immediately so concurrent calls share it
  folderCache.set(key, promise);

  // If the promise rejects, remove from cache so it can be retried
  promise.catch(() => folderCache.delete(key));

  return promise;
}

// ── High-level folder helpers ─────────────────────────────────

export async function getBackupRootFolder(): Promise<string> {
  const key = folderCacheKey("__backup_root__");
  const cached = folderCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    // Buscar carpeta "BACKUP EXPEDIENTES" en cualquier parte del Drive (case-insensitive search)
    const q = [
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
    ].join(" and ");

    const params = new URLSearchParams({
      q,
      fields: "files(id,name)",
      spaces: "drive",
      pageSize: "100",
    });

    const res = await driveFetch(`${DRIVE_API}/files?${params}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Error buscando carpetas: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    const folders = data.files as { id: string; name: string }[] | undefined;

    // Buscar coincidencia case-insensitive
    const match = folders?.find(
      (f) => f.name.toLowerCase() === "backup expedientes"
    );
    if (match) return match.id;

    // No existe: crear en la raíz
    return createFolder("BACKUP EXPEDIENTES");
  })();

  folderCache.set(key, promise);
  promise.catch(() => folderCache.delete(key));
  return promise;
}

export async function getExpedienteFolder(
  rootId: string,
  numeroExpediente: string,
  titulo: string
): Promise<string> {
  const folderName = `${numeroExpediente} - ${titulo}`.slice(0, 100);
  return findOrCreateFolder(folderName, rootId);
}

// ── File upload ───────────────────────────────────────────────

export async function uploadFileToDrive(
  file: File,
  folderId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  onProgress?.(10);

  const token = getToken();
  if (!token) throw new Error("No autenticado en Google Drive");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${UPLOAD_API}/files?uploadType=multipart&fields=id`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 90) + 10);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        onProgress?.(100);
        resolve(data.id);
      } else if (xhr.status === 401) {
        clearToken();
        reject(new Error("Token expirado"));
      } else {
        reject(new Error(`Error subiendo a Drive: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Error de red al subir a Drive"));
    xhr.send(form);
  });
}

export async function uploadBlobToDrive(
  blob: Blob,
  fileName: string,
  folderId: string
): Promise<string> {
  const file = new File([blob], fileName, { type: blob.type });
  return uploadFileToDrive(file, folderId);
}
