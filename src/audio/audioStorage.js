// ============================================================================
// ARMAZENAMENTO INDEXEDDB RESILIENTE PARA MÚSICAS E ÁUDIOS DO USUÁRIO
// Suporta Blobs de áudio de qualquer tamanho (.mp3/.wav) sem erro de DataClone
// ============================================================================

const DB_NAME = 'DaviStudioDB';
const DB_VERSION = 2; // Incremental para atualização de schema
const STORE_NAME = 'custom_audio_tracks';

// Cache em memória para AudioBuffers decodificados (acesso instantâneo < 1ms)
export const inMemoryStemsCache = new Map();

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

/**
 * Salva uma música customizada no IndexedDB.
 * Remove buffers nativos (não clonáveis) e armazena o audioBlob/ArrayBuffer de forma segura.
 */
export async function saveTrackToDB(songData) {
  try {
    const db = await openDB();
    if (!db) return false;

    // Se houver stems em memória, guarda no cache de memória
    if (songData.customStems) {
      inMemoryStemsCache.set(songData.id, songData.customStems);
    }

    // Prepara objeto seguro para o IndexedDB (sem instâncias de AudioBuffer nativas)
    const serializable = {
      id: songData.id,
      title: songData.title,
      artist: songData.artist,
      bpm: songData.bpm || 120,
      originalKey: songData.originalKey || 'Am',
      duration: songData.duration || 32,
      thumbnail: songData.thumbnail || null,
      coverGradient: songData.coverGradient || 'from-emerald-600 to-slate-900',
      sections: songData.sections || [],
      chords: songData.chords || [],
      peaks: songData.peaks || (songData.customStems ? {
        vocals: songData.customStems.vocals?.peaks,
        drums: songData.customStems.drums?.peaks,
        bass: songData.customStems.bass?.peaks,
        other: songData.customStems.other?.peaks,
        metronome: songData.customStems.metronome?.peaks
      } : null),
      audioBlob: songData.audioBlob || null, // Blob binário padrão (suportado 100% no IndexedDB)
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(serializable);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso: Falha ao persistir no IndexedDB:', err);
    return false;
  }
}

/**
 * Carrega todas as músicas armazenadas do IndexedDB
 */
export async function getAllTracksFromDB() {
  try {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        // Restaura referências de stems em cache se existirem
        const hydrated = results.map((track) => {
          if (inMemoryStemsCache.has(track.id)) {
            return { ...track, customStems: inMemoryStemsCache.get(track.id) };
          }
          return track;
        });
        resolve(hydrated);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso: Falha ao ler do IndexedDB:', err);
    return [];
  }
}

/**
 * Deleta uma música do IndexedDB e limpa o cache em memória
 */
export async function deleteTrackFromDB(id) {
  try {
    inMemoryStemsCache.delete(id);
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
    console.warn('Aviso: Falha ao deletar do IndexedDB:', err);
    return false;
  }
}
