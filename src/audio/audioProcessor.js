import { separateLocalAudioBufferClientSide } from './dspSeparator';
import { analyzeHarmonicKeyAndChords } from './keyDetector';
import { inMemoryStemsCache } from './audioStorage';

/**
 * Garante que os stems de áudio de uma música estejam decodificados e prontos em memória.
 * Se a página foi recarregada, restaura instantaneamente a partir do audioBlob no IndexedDB.
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

  if (song.audioBlob) {
    try {
      const arrayBuf = await song.audioBlob.arrayBuffer();
      const decoded = await safeDecodeAudioData(ctx, arrayBuf);
      const { stems } = await separateLocalAudioBufferClientSide(ctx, decoded);
      inMemoryStemsCache.set(song.id, stems);
      return stems;
    } catch (err) {
      console.warn('Erro ao restaurar stems do audioBlob:', err);
    }
  }

  return null;
}

/**
 * Decodifica com segurança um ArrayBuffer de áudio em qualquer navegador (Chrome, Safari, Firefox, iOS, Android)
 * Trata casos de compatibilidade com chamadas baseadas em Callback e Promise.
 */
export async function safeDecodeAudioData(ctx, arrayBuffer) {
  if (!ctx) throw new Error('AudioContext não disponível');

  if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
    try {
      await ctx.resume();
    } catch (_) {}
  }

  // Clona o arrayBuffer para evitar mutação/desconexão
  const bufferCopy = arrayBuffer.slice(0);

  return new Promise((resolve, reject) => {
    let settled = false;

    // Tentativa com callbacks legados (estilo Safari iOS) e Promise moderna
    try {
      const promise = ctx.decodeAudioData(
        bufferCopy,
        (decoded) => {
          if (!settled) {
            settled = true;
            resolve(decoded);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            reject(new Error('Falha ao decodificar arquivo de áudio. O formato pode estar corrompido ou incompatível.'));
          }
        }
      );

      if (promise && typeof promise.then === 'function') {
        promise
          .then((decoded) => {
            if (!settled) {
              settled = true;
              resolve(decoded);
            }
          })
          .catch((err) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
      }
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}

/**
 * Baixa um arquivo de áudio de uma URL externa e decodifica no Web Audio API
 */
export async function fetchAndDecodeAudio(ctx, audioUrl) {
  let response;
  try {
    response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
  } catch (err) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(audioUrl)}`;
      response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Falha no proxy CORS');
    } catch (_) {
      throw new Error('Não foi possível acessar o link de áudio. Verifique se a URL é direta e pública.');
    }
  }

  const arrayBuf = await response.arrayBuffer();
  const blob = new Blob([arrayBuf], { type: 'audio/mpeg' });
  const decoded = await safeDecodeAudioData(ctx, arrayBuf);
  return { decoded, audioBlob: blob };
}

/**
 * Processa um AudioBuffer decodificado:
 * 1. Detecta o BPM e o compasso
 * 2. Analisa a TONALIDADE REAL (Key) e a PROGRESSÃO DE ACORDES via Krumhansl-Schmuckler
 * 3. Executa a separação DSP Mid-Side em 4 stems reais (Vocais, Bateria, Baixo, Harmonia) + Smart Metrônomo
 * 4. Retorna a música com todas as formas de onda (peaks) e o blob binário para persistência.
 */
export async function processAudioBufferIntoSong(ctx, decodedBuffer, meta = {}, rawAudioBlob = null) {
  // 1. Separação de canais e detecção de BPM
  const { detectedBpm, stems } = await separateLocalAudioBufferClientSide(ctx, decodedBuffer);

  // 2. Análise harmônica real (Key e Acordes sincronizados com o BPM)
  const { detectedKey, chords } = analyzeHarmonicKeyAndChords(decodedBuffer, detectedBpm);

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

  return {
    id: songId,
    title,
    artist,
    bpm: detectedBpm,
    originalKey: meta.originalKey || detectedKey, // Tonalidade Real Detectada!
    duration: decodedBuffer.duration,
    thumbnail: meta.thumbnail || null,
    coverGradient: meta.coverGradient || 'from-emerald-600 via-teal-800 to-slate-900',
    customStems: stems,
    peaks,
    audioBlob: rawAudioBlob,
    sections: [
      { name: 'Intro', start: 0, end: Math.round(decodedBuffer.duration * 0.25) },
      {
        name: 'Meio',
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
