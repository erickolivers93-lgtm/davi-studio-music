// ============================================================================
// ARMAZENAMENTO INDEXEDDB RESILIENTE PARA MÚSICAS E ÁUDIOS DO USUÁRIO
// Armazena ArrayBuffer binário puro para evitar bugs de serialização de Blob no iOS Safari
// ============================================================================

const DB_NAME = 'DaviStudioDB';
const DB_VERSION = 3;
const STORE_NAME = 'custom_audio_tracks';

// Cache em memória para Stems decodificados e ArrayBuffers brutos
export const inMemoryStemsCache = new Map();
export const inMemoryRawBufferCache = new Map();

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
 * Converte Blobs em ArrayBuffer puro para compatibilidade 100% com iOS Safari / WebKit.
 */
export async function saveTrackToDB(songData) {
  try {
    if (songData.customStems) {
      inMemoryStemsCache.set(songData.id, songData.customStems);
    }

    let rawArrayBuffer = songData.audioArrayBuffer || inMemoryRawBufferCache.get(songData.id) || null;
    if (!rawArrayBuffer && songData.audioBlob && typeof songData.audioBlob.arrayBuffer === 'function') {
      try {
        rawArrayBuffer = await songData.audioBlob.arrayBuffer();
      } catch (_) {}
    }

    if (rawArrayBuffer) {
      inMemoryRawBufferCache.set(songData.id, rawArrayBuffer);
    }

    const db = await openDB();
    if (!db) return false;

    const serializable = {
      id: songData.id,
      title: songData.title,
      artist: songData.artist,
      bpm: songData.bpm || 120,
      firstBeatOffset: songData.firstBeatOffset || 0,
      beatTimes: songData.beatTimes || null,
      originalKey: songData.originalKey || 'C',
      duration: songData.duration || 32,
      thumbnail: songData.thumbnail || null,
      coverGradient: songData.coverGradient || 'from-emerald-600 to-slate-900',
      sections: songData.sections || [],
      chords: songData.chords || [],
      peaks:
        songData.peaks ||
        (songData.customStems
          ? {
              vocals: songData.customStems.vocals?.peaks,
              drums: songData.customStems.drums?.peaks,
              bass: songData.customStems.bass?.peaks,
              other: songData.customStems.other?.peaks,
              metronome: songData.customStems.metronome?.peaks
            }
          : null),
      // ArrayBuffer puro é 100% suportado no iOS Safari sem o bug de Blob do WebKit
      audioArrayBuffer: rawArrayBuffer ? rawArrayBuffer.slice(0) : null,
      updatedAt: Date.now()
    };

    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(serializable);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
    return result;
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
    const results = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    return results.map((track) => {
      if (track.audioArrayBuffer) {
        inMemoryRawBufferCache.set(track.id, track.audioArrayBuffer);
      }
      if (inMemoryStemsCache.has(track.id)) {
        return { ...track, customStems: inMemoryStemsCache.get(track.id) };
      }
      return track;
    });
  } catch (err) {
    console.warn('Aviso: Falha ao ler do IndexedDB:', err);
    return [];
  }
}

/**
 * Busca uma faixa específica diretamente do IndexedDB caso não esteja em memória
 */
export async function getTrackFromDBById(id) {
  try {
    const db = await openDB();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Deleta uma música do IndexedDB e limpa os caches em memória
 */
export async function deleteTrackFromDB(id) {
  try {
    inMemoryStemsCache.delete(id);
    inMemoryRawBufferCache.delete(id);
    const db = await openDB();
    if (!db) return false;
    return await new Promise((resolve, reject) => {
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
