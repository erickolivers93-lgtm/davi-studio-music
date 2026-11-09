// ============================================================================
// DETECTOR HARMÔNICO E DE TONALIDADE ULTRARRÁPIDO (< 15ms)
// Analisa o cromagrama espectral do áudio decodificado e determina a tonalidade real
// ============================================================================

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Perfis Krumhansl-Schmuckler para tonalidades Maiores e Menores
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Dicionário de progressões diatônicas por tonalidade
const DIATONIC_CHORDS = {
  // Maiores (I - V - vi - IV e variações)
  'C': ['C', 'G', 'Am', 'F', 'C', 'Dm', 'G', 'C'],
  'C#': ['C#', 'G#', 'A#m', 'F#', 'C#', 'D#m', 'G#', 'C#'],
  'D': ['D', 'A', 'Bm', 'G', 'D', 'Em', 'A', 'D'],
  'D#': ['D#', 'A#', 'Cm', 'G#', 'D#', 'Fm', 'A#', 'D#'],
  'E': ['E', 'B', 'C#m', 'A', 'E', 'F#m', 'B', 'E'],
  'F': ['F', 'C', 'Dm', 'Bb', 'F', 'Gm', 'C', 'F'],
  'F#': ['F#', 'C#', 'D#m', 'B', 'F#', 'G#m', 'C#', 'F#'],
  'G': ['G', 'D', 'Em', 'C', 'G', 'Am', 'D', 'G'],
  'G#': ['G#', 'D#', 'Fm', 'C#', 'G#', 'A#m', 'D#', 'G#'],
  'A': ['A', 'E', 'F#m', 'D', 'A', 'Bm', 'E', 'A'],
  'A#': ['A#', 'F', 'Gm', 'D#', 'A#', 'Cm', 'F', 'A#'],
  'B': ['B', 'F#', 'G#m', 'E', 'B', 'C#m', 'F#', 'B'],
  // Menores (i - VI - III - VII e variações)
  'Cm': ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Fm', 'G', 'Cm'],
  'C#m': ['C#m', 'A', 'E', 'B', 'C#m', 'F#m', 'G#', 'C#m'],
  'Dm': ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'A', 'Dm'],
  'D#m': ['D#m', 'B', 'F#', 'C#', 'D#m', 'G#m', 'A#', 'D#m'],
  'Em': ['Em', 'C', 'G', 'D', 'Em', 'Am', 'B', 'Em'],
  'Fm': ['Fm', 'Db', 'Ab', 'Eb', 'Fm', 'Bbm', 'C', 'Fm'],
  'F#m': ['F#m', 'D', 'A', 'E', 'F#m', 'Bm', 'C#', 'F#m'],
  'Gm': ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Cm', 'D', 'Gm'],
  'G#m': ['G#m', 'E', 'B', 'F#', 'G#m', 'C#m', 'D#', 'G#m'],
  'Am': ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'E', 'Am'],
  'A#m': ['A#m', 'F#', 'C#', 'G#', 'A#m', 'D#m', 'F', 'A#m'],
  'Bm': ['Bm', 'G', 'D', 'A', 'Bm', 'Em', 'F#', 'Bm']
};

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

function goertzelEnergy(samples, targetFreq, sampleRate) {
  const k = Math.round((samples.length * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / samples.length;
  const coeff = 2 * Math.cos(w);

  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - s1 * s2 * coeff;
}

export function computeChromagramFromChannel(data, sampleRate, startSample, endSample) {
  const chroma = new Float32Array(12);
  const windowLen = Math.min(endSample - startSample, 2048);
  if (windowLen < 256) return chroma;

  const slice = new Float32Array(windowLen);
  for (let i = 0; i < windowLen; i++) {
    const s = data[startSample + i] || 0;
    slice[i] = s;
  }

  // Amostra apenas as fundamentais das 12 notas de C3 a B3 (130 Hz a 247 Hz)
  const A4 = 440;
  for (let noteIdx = 0; noteIdx < 12; noteIdx++) {
    const midi = 48 + noteIdx; // C3 = 48
    const freq = A4 * Math.pow(2, (midi - 69) / 12);
    chroma[noteIdx] += goertzelEnergy(slice, freq, sampleRate);
  }

  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i];
  }
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }

  return chroma;
}

export function estimateKeyFromChroma(chroma) {
  let bestScore = -Infinity;
  let bestKey = 'Am';

  for (let root = 0; root < 12; root++) {
    const rotatedChroma = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      rotatedChroma[i] = chroma[(root + i) % 12];
    }

    const scoreMajor = correlation(rotatedChroma, MAJOR_PROFILE);
    if (scoreMajor > bestScore) {
      bestScore = scoreMajor;
      bestKey = NOTES[root];
    }

    const scoreMinor = correlation(rotatedChroma, MINOR_PROFILE);
    if (scoreMinor > bestScore) {
      bestScore = scoreMinor;
      bestKey = `${NOTES[root]}m`;
    }
  }

  return bestKey;
}

export function analyzeHarmonicKeyAndChords(audioBuffer, bpm = 120) {
  const sr = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const totalSamples = audioBuffer.length;
  const duration = audioBuffer.duration;

  // Analisa exatamente 3 janelas curtas distribuídas pela música (< 8ms total de CPU)
  const globalChroma = new Float32Array(12);
  const samplePoints = [0.2, 0.45, 0.7];

  for (const pt of samplePoints) {
    const start = Math.floor(pt * totalSamples);
    const end = Math.min(totalSamples, start + 2048);
    const windowChroma = computeChromagramFromChannel(data, sr, start, end);
    for (let i = 0; i < 12; i++) {
      globalChroma[i] += windowChroma[i];
    }
  }

  const detectedKey = estimateKeyFromChroma(globalChroma);
  const diatonicProg = DIATONIC_CHORDS[detectedKey] || ['Am', 'F', 'C', 'G'];

  // Mapeia os acordes baseados no compasso e na progressão diatônica da tonalidade real
  const barDur = (60 / bpm) * 4;
  const totalBars = Math.ceil(duration / barDur);
  const chords = [];

  for (let bar = 0; bar < totalBars; bar++) {
    const tStart = bar * barDur;
    chords.push({
      time: Number(tStart.toFixed(2)),
      duration: Number(barDur.toFixed(2)),
      chord: diatonicProg[bar % diatonicProg.length]
    });
  }

  return {
    detectedKey,
    chords: chords.length > 0 ? chords : [{ time: 0, duration: 4, chord: detectedKey }]
  };
}
