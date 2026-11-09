// ============================================================================
// ARMAZENAMENTO INDEXEDDB PARA MÚSICAS E ÁUDIOS DO USUÁRIO
// Permite que arquivos .mp3/.wav enviados sobrevivam a recarregamentos da página
// ============================================================================

const DB_NAME = 'DaviStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'custom_audio_tracks';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTrackToDB(trackData) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(trackData);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar no IndexedDB:', err);
    return false;
  }
}

export async function getAllTracksFromDB() {
  try {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao ler do IndexedDB:', err);
    return [];
  }
}

export async function deleteTrackFromDB(id) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao deletar do IndexedDB:', err);
    return false;
  }
}
