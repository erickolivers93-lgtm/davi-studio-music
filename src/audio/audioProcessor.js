import { separateLocalAudioBufferClientSide } from './dspSeparator';

/**
 * Baixa um arquivo de áudio de uma URL externa e decodifica no Web Audio API
 */
export async function fetchAndDecodeAudio(ctx, audioUrl) {
  let response;
  try {
    response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
  } catch (err) {
    // Tentativa via proxy CORS caso o servidor remoto bloqueie acesso direto
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(audioUrl)}`;
      response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Falha no proxy CORS');
    } catch (_) {
      throw new Error('Não foi possível acessar o arquivo de áudio. Verifique se o link é público e direto.');
    }
  }

  const arrayBuf = await response.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuf);
}

/**
 * Processa um AudioBuffer decodificado, separa em 4 canais DSP (Vocais, Bateria, Baixo, Harmonia)
 * e gera os metadados completos da faixa para o DAVI Studio.
 */
export async function processAudioBufferIntoSong(ctx, decodedBuffer, meta = {}) {
  const { detectedBpm, stems } = await separateLocalAudioBufferClientSide(ctx, decodedBuffer);

  const barDur = (60 / detectedBpm) * 4;
  const generatedChords = [];
  const defaultProgression = ['Am', 'F', 'C', 'G', 'Dm', 'Em', 'F', 'G'];
  for (let idx = 0; idx * barDur < decodedBuffer.duration; idx++) {
    generatedChords.push({
      time: Number((idx * barDur).toFixed(2)),
      duration: Number(barDur.toFixed(2)),
      chord: defaultProgression[idx % defaultProgression.length]
    });
  }

  const songId = meta.id || `audio-${Date.now()}`;
  const title = meta.title || 'Música Importada';
  const artist = meta.artist || `Áudio Real • ${detectedBpm} BPM`;

  return {
    id: songId,
    title,
    artist,
    bpm: detectedBpm,
    originalKey: meta.originalKey || 'Am',
    duration: decodedBuffer.duration,
    thumbnail: meta.thumbnail || null,
    coverGradient: meta.coverGradient || 'from-emerald-600 via-teal-800 to-slate-900',
    customStems: stems,
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
    chords: generatedChords
  };
}
