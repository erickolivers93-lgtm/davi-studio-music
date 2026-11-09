// ============================================================================
// DETECTOR HARMÔNICO E DE TONALIDADE (KRUMHANSL-SCHMUCKLER KEY-FINDING)
// Analisa o cromagrama do áudio decodificado e determina a tonalidade real
// ============================================================================

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Perfis de Krumhansl-Schmuckler para tonalidades Maiores e Menores
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Calcula a correlação de Pearson entre dois vetores de 12 dimensões
 */
function correlation(x, y) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < 12; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = 12 * sumXY - sumX * sumY;
  const den = Math.sqrt((12 * sumX2 - sumX * sumX) * (12 * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

/**
 * Filtro de Goertzel simplificado para calcular a energia de uma frequência específica
 */
function goertzelEnergy(samples, targetFreq, sampleRate) {
  const k = Math.round((samples.length * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / samples.length;
  const cosW = Math.cos(w);
  const coeff = 2 * cosW;

  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - s1 * s2 * coeff;
}

/**
 * Extrai o vetor de energia das 12 classes de notas (Croma) de um trecho de áudio
 */
export function computeChromagramFromChannel(data, sampleRate, startSample, endSample) {
  const chroma = new Float32Array(12);
  const windowLen = Math.min(endSample - startSample, 4096);
  if (windowLen < 512) return chroma;

  // Extrai trecho com janela de Hann
  const slice = new Float32Array(windowLen);
  for (let i = 0; i < windowLen; i++) {
    const s = data[startSample + i] || 0;
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowLen - 1)));
    slice[i] = s * hann;
  }

  // Frequências fundamentais de C2 a B4 (65 Hz a 493 Hz) para focar na harmonia principal
  const A4 = 440;
  for (let midi = 36; midi <= 71; midi++) {
    const freq = A4 * Math.pow(2, (midi - 69) / 12);
    const noteClass = midi % 12; // 0 = C, 1 = C#, ..., 9 = A
    const energy = goertzelEnergy(slice, freq, sampleRate);
    chroma[noteClass] += energy;
  }

  // Normaliza o vetor croma
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i];
  }
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }

  return chroma;
}

/**
 * Identifica a tonalidade musical (ex: 'Am', 'C', 'G', 'Em') comparando com os perfis de Krumhansl
 */
export function estimateKeyFromChroma(chroma) {
  let bestScore = -Infinity;
  let bestKey = 'Am';

  for (let root = 0; root < 12; root++) {
    // Rotaciona o perfil para a nota raiz correspondente
    const rotatedChroma = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      rotatedChroma[i] = chroma[(root + i) % 12];
    }

    // Compara com perfil Maior
    const scoreMajor = correlation(rotatedChroma, MAJOR_PROFILE);
    if (scoreMajor > bestScore) {
      bestScore = scoreMajor;
      bestKey = NOTES[root];
    }

    // Compara com perfil Menor
    const scoreMinor = correlation(rotatedChroma, MINOR_PROFILE);
    if (scoreMinor > bestScore) {
      bestScore = scoreMinor;
      bestKey = `${NOTES[root]}m`;
    }
  }

  return bestKey;
}

/**
 * Analisa o buffer completo de áudio decodificado:
 * - Detecta a tonalidade global (Key)
 * - Identifica acordes a cada compasso sincronizados com o BPM
 */
export function analyzeHarmonicKeyAndChords(audioBuffer, bpm = 120) {
  const sr = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const totalSamples = audioBuffer.length;
  const duration = audioBuffer.duration;

  // Analisa até 6 janelas distribuídas pela música para determinar a tonalidade global com precisão
  const globalChroma = new Float32Array(12);
  const sampleSteps = Math.min(10, Math.max(3, Math.floor(duration / 6)));
  const stepSamples = Math.floor(totalSamples / (sampleSteps + 1));

  for (let s = 1; s <= sampleSteps; s++) {
    const start = s * stepSamples;
    const end = Math.min(totalSamples, start + Math.floor(sr * 2.0)); // janela de 2s
    const windowChroma = computeChromagramFromChannel(data, sr, start, end);
    for (let i = 0; i < 12; i++) {
      globalChroma[i] += windowChroma[i];
    }
  }

  const detectedKey = estimateKeyFromChroma(globalChroma);

  // Mapeia os acordes compasso a compasso
  const barDur = (60 / bpm) * 4;
  const totalBars = Math.ceil(duration / barDur);
  const chords = [];

  for (let bar = 0; bar < totalBars; bar++) {
    const tStart = bar * barDur;
    const sStart = Math.floor(tStart * sr);
    const sEnd = Math.min(totalSamples, sStart + Math.floor(barDur * sr));

    if (sEnd > sStart) {
      const barChroma = computeChromagramFromChannel(data, sr, sStart, sEnd);
      const barKey = estimateKeyFromChroma(barChroma);
      chords.push({
        time: Number(tStart.toFixed(2)),
        duration: Number(barDur.toFixed(2)),
        chord: barKey
      });
    }
  }

  return {
    detectedKey,
    chords: chords.length > 0 ? chords : [{ time: 0, duration: 4, chord: detectedKey }]
  };
}
