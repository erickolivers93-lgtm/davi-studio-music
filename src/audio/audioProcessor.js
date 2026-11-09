import { separateLocalAudioBufferClientSide } from './dspSeparator';
import { analyzeHarmonicKeyAndChords } from './keyDetector';
import {
  inMemoryStemsCache,
  inMemoryRawBufferCache,
  getTrackFromDBById
} from './audioStorage';

/**
 * Decodifica com segurança um ArrayBuffer de áudio.
 * Utiliza OfflineAudioContext para NUNCA travar no iOS Safari (dispensa ativação por gesto de hardware).
 */
export async function safeDecodeAudioData(ctx, arrayBuffer) {
  const bufferCopy = arrayBuffer.slice(0);

  const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let decodeEngine = null;

  try {
    if (OfflineCtxClass) {
      decodeEngine = new OfflineCtxClass(1, 44100, 44100);
    }
  } catch (_) {}

  if (!decodeEngine) {
    decodeEngine = ctx || new (window.AudioContext || window.webkitAudioContext)();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Tempo de decodificação excedido. Verifique o arquivo de áudio.'));
      }
    }, 12000);

    const onDecoded = (decoded) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(decoded);
      }
    };

    const onError = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('Formato de áudio não suportado ou arquivo corrompido.'));
      }
    };

    try {
      const res = decodeEngine.decodeAudioData(bufferCopy, onDecoded, onError);
      if (res && typeof res.then === 'function') {
        res.then(onDecoded).catch(onError);
      }
    } catch (err) {
      onError(err);
    }
  });
}

/**
 * Garante que os stems de áudio de uma música estejam decodificados e prontos em memória.
 * Se a página foi recarregada ou o usuário saiu e voltou, restaura do cache ou do IndexedDB.
 */
export async function ensureSongStemsLoaded(ctx, song) {
  if (!song) return null;

  if (inMemoryStemsCache.has(song.id)) {
    return inMemoryStemsCache.get(song.id);
  }

  if (song.customStems?.vocals?.buffer) {
    inMemoryStemsCache.set(song.id, song.customStems);
    return song.customStems;
  }

  // Tenta obter o ArrayBuffer bruto da memória, do objeto song ou diretamente do IndexedDB
  let arrayBuf = song.audioArrayBuffer || inMemoryRawBufferCache.get(song.id) || null;

  if (!arrayBuf && song.audioBlob && typeof song.audioBlob.arrayBuffer === 'function') {
    try {
      arrayBuf = await song.audioBlob.arrayBuffer();
    } catch (_) {}
  }

  if (!arrayBuf) {
    const dbRecord = await getTrackFromDBById(song.id);
    if (dbRecord) {
      if (dbRecord.audioArrayBuffer) {
        arrayBuf = dbRecord.audioArrayBuffer;
      } else if (dbRecord.audioBlob && typeof dbRecord.audioBlob.arrayBuffer === 'function') {
        try {
          arrayBuf = await dbRecord.audioBlob.arrayBuffer();
        } catch (_) {}
      }
    }
  }

  if (arrayBuf) {
    try {
      inMemoryRawBufferCache.set(song.id, arrayBuf);
      const decoded = await safeDecodeAudioData(ctx, arrayBuf);
      const { stems } = await separateLocalAudioBufferClientSide(ctx, decoded);
      inMemoryStemsCache.set(song.id, stems);
      return stems;
    } catch (err) {
      console.warn('Erro ao restaurar stems do ArrayBuffer:', err);
    }
  }

  return null;
}

/**
 * Baixa um arquivo de áudio de uma URL externa e decodifica no Web Audio API
 */
export async function fetchAndDecodeAudio(ctx, audioUrl) {
  let response;
  try {
    response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
  } catch (_) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(audioUrl)}`;
      response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Falha no proxy CORS');
    } catch (_) {
      throw new Error('Não foi possível acessar o link de áudio. Verifique se a URL é direta e pública.');
    }
  }

  const arrayBuf = await response.arrayBuffer();
  const bufferClone = arrayBuf.slice(0);
  const blob = new Blob([bufferClone], { type: 'audio/mpeg' });
  const decoded = await safeDecodeAudioData(ctx, arrayBuf);
  return { decoded, audioBlob: blob, audioArrayBuffer: bufferClone };
}

/**
 * Processa um AudioBuffer decodificado:
 * 1. Detecta o BPM real, firstBeatOffset e grade de batidas travada nos transientes
 * 2. Executa a separação DSP de 4ª ordem em 4 stems reais + Smart Metrônomo
 * 3. Analisa a TONALIDADE REAL e os ACORDES REAIS por compasso/segmento de tempo
 */
export async function processAudioBufferIntoSong(
  ctx,
  decodedBuffer,
  meta = {},
  rawAudioBlob = null,
  rawArrayBuffer = null
) {
  await new Promise((r) => setTimeout(r, 20));

  // 1. Separação de canais DSP e detecção de BPM + fase de batidas
  const {
    detectedBpm,
    firstBeatOffset,
    beatTimes,
    stems
  } = await separateLocalAudioBufferClientSide(ctx, decodedBuffer);

  // 2. Análise harmônica real por segmento alinhada com firstBeatOffset e BPM
  const { detectedKey, chords } = analyzeHarmonicKeyAndChords(
    decodedBuffer,
    detectedBpm,
    firstBeatOffset
  );

  const songId = meta.id || `local-${Date.now()}`;
  const title = meta.title || 'Música Importada';
  const artist = meta.artist || `Áudio Real • ${detectedBpm} BPM`;

  const peaks = {
    vocals: stems.vocals?.peaks,
    drums: stems.drums?.peaks,
    bass: stems.bass?.peaks,
    other: stems.other?.peaks,
    metronome: stems.metronome?.peaks
  };

  inMemoryStemsCache.set(songId, stems);
  if (rawArrayBuffer) {
    inMemoryRawBufferCache.set(songId, rawArrayBuffer);
  }

  return {
    id: songId,
    title,
    artist,
    bpm: detectedBpm,
    firstBeatOffset,
    beatTimes,
    originalKey: meta.originalKey || detectedKey,
    duration: decodedBuffer.duration,
    thumbnail: meta.thumbnail || null,
    coverGradient: meta.coverGradient || 'from-emerald-600 via-teal-800 to-slate-900',
    customStems: stems,
    peaks,
    audioBlob: rawAudioBlob,
    audioArrayBuffer: rawArrayBuffer,
    sections: [
      { name: 'Intro / A', start: 0, end: Math.round(decodedBuffer.duration * 0.25) },
      {
        name: 'Desenvolvimento',
        start: Math.round(decodedBuffer.duration * 0.25),
        end: Math.round(decodedBuffer.duration * 0.65)
      },
      {
        name: 'Final',
        start: Math.round(decodedBuffer.duration * 0.65),
        end: Math.round(decodedBuffer.duration)
      }
    ],
    chords
  };
}
