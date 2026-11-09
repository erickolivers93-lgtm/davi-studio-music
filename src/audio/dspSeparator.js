import { extractPeaks, fastSin } from './audioEngine';

// ============================================================================
// SEPARADOR CLIENT-SIDE PARA ARQUIVOS ENVIADOS PELO USUÁRIO (DSP MID-SIDE + FILTROS)
// ============================================================================

export function detectBpmAndOffsetFromBuffer(sourceBuffer) {
  const sr = sourceBuffer.sampleRate;
  const data = sourceBuffer.getChannelData(0);
  const hop = Math.floor(sr * 0.01); // Janela de 10ms (100 Hz)
  const maxSeconds = Math.min(30, sourceBuffer.duration);
  const numFrames = Math.floor((maxSeconds * sr) / hop);
  if (numFrames < 200) return { bpm: 120, firstBeatOffset: 0 };

  const onsetEnv = new Float32Array(numFrames);
  let prevE = 0;
  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    const base = f * hop;
    for (let i = 0; i < hop; i += 4) {
      const s = data[base + i] || 0;
      sum += s * s;
    }
    const diff = Math.max(0, sum - prevE);
    onsetEnv[f] = diff;
    prevE = sum * 0.85 + prevE * 0.15;
  }

  let bestBpm = 120;
  let bestScore = -1;
  for (let bpm = 76; bpm <= 160; bpm += 1) {
    const lag = Math.round((60 / bpm) * 100);
    let score = 0;
    for (let i = 0; i + lag < numFrames; i++) {
      score += onsetEnv[i] * onsetEnv[i + lag];
    }
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  // Localiza a fase exata do primeiro tempo forte (downbeat)
  const periodFrames = Math.round((60 / bestBpm) * 100);
  let bestPhase = 0;
  let bestPhaseEnergy = -1;
  for (let p = 0; p < periodFrames; p++) {
    let e = 0;
    for (let f = p; f < numFrames; f += periodFrames) {
      e += onsetEnv[f];
    }
    if (e > bestPhaseEnergy) {
      bestPhaseEnergy = e;
      bestPhase = p;
    }
  }

  return {
    bpm: bestBpm,
    firstBeatOffset: (bestPhase * hop) / sr
  };
}

export async function separateLocalAudioBufferClientSide(ctx, sourceBuffer) {
  const sr = sourceBuffer.sampleRate;
  const len = sourceBuffer.length;
  const inL = sourceBuffer.getChannelData(0);
  const inR = sourceBuffer.numberOfChannels > 1 ? sourceBuffer.getChannelData(1) : inL;

  const { bpm: detectedBpm, firstBeatOffset } = detectBpmAndOffsetFromBuffer(sourceBuffer);

  const mk = () => ctx.createBuffer(2, len, sr);
  const vocalsBuf = mk();
  const drumsBuf = mk();
  const bassBuf = mk();
  const otherBuf = mk();
  const metroBuf = mk();

  const vL = vocalsBuf.getChannelData(0), vR = vocalsBuf.getChannelData(1);
  const dL = drumsBuf.getChannelData(0),  dR = drumsBuf.getChannelData(1);
  const bL = bassBuf.getChannelData(0),   bR = bassBuf.getChannelData(1);
  const oL = otherBuf.getChannelData(0),  oR = otherBuf.getChannelData(1);
  const mL = metroBuf.getChannelData(0),  mR = metroBuf.getChannelData(1);

  let lpBass = 0;
  let lpVocal = 0;
  let prevEnergy = 0;

  for (let i = 0; i < len; i++) {
    const l = inL[i];
    const r = inR[i];
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;

    // Filtro passa-baixa para isolar Contrabaixo (< 170Hz)
    lpBass += 0.025 * (mid - lpBass);
    bL[i] = lpBass * 1.25;
    bR[i] = lpBass * 1.25;

    // Filtro de médios centrais para Vocais
    const highPassMid = mid - lpBass;
    lpVocal += 0.18 * (highPassMid - lpVocal);
    vL[i] = lpVocal * 0.9;
    vR[i] = lpVocal * 0.9;

    // Detecção de transientes rápidos para Bateria
    const highComponent = highPassMid - lpVocal;
    const instEnergy = Math.abs(highComponent);
    const transient = Math.max(0, instEnergy - prevEnergy);
    prevEnergy = instEnergy * 0.92 + prevEnergy * 0.08;
    const drumFactor = Math.min(1.5, transient * 6 + 0.35);
    dL[i] = highComponent * drumFactor;
    dR[i] = highComponent * drumFactor;

    // Side stereo + harmonia para Guitarras/Teclados
    oL[i] = side * 1.15 + highPassMid * 0.25;
    oR[i] = -side * 1.15 + highPassMid * 0.25;
  }

  // Gera Smart Metrônomo sincronizado com o BPM e fase detectados da música
  const beatSec = 60 / detectedBpm;
  const offsetSamples = Math.floor(firstBeatOffset * sr);
  for (let beat = 0; ; beat++) {
    const start = offsetSamples + Math.floor(beat * beatSec * sr);
    if (start >= len) break;
    const freq = beat % 4 === 0 ? 1480 : 987.77;
    const clickLen = Math.min(Math.floor(0.045 * sr), len - start);
    for (let k = 0; k < clickLen; k++) {
      const kt = k / sr;
      const val = fastSin(2 * Math.PI * freq * kt) * Math.exp(-kt * 85) * (beat % 4 === 0 ? 0.72 : 0.5);
      mL[start + k] = val;
      mR[start + k] = val;
    }
  }

  return {
    detectedBpm,
    stems: {
      vocals:    { buffer: vocalsBuf, peaks: extractPeaks(vocalsBuf) },
      drums:     { buffer: drumsBuf,  peaks: extractPeaks(drumsBuf) },
      bass:      { buffer: bassBuf,   peaks: extractPeaks(bassBuf) },
      other:     { buffer: otherBuf,  peaks: extractPeaks(otherBuf) },
      metronome: { buffer: metroBuf,  peaks: extractPeaks(metroBuf) }
    }
  };
}
