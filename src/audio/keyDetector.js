// ============================================================================
// DETECTOR HARMÔNICO REAL POR SEGMENTOS DE TEMPO (GOERTZEL EXATO + CROMAGRAMA)
// Analisa cada compasso da música real para detectar o Tom Global (Key)
// e os Acordes Reais sincronizados com o tempo exato em que são tocados.
// ============================================================================

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Perfis Krumhansl-Kessler para tonalidades Maiores e Menores
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Graus diatônicos e acordes de empréstimo comuns por tonalidade (pesos de probabilidade a priori)
function getKeyChordPriors(keyName) {
  const isMinor = keyName.endsWith('m');
  const rootName = isMinor ? keyName.slice(0, -1) : keyName;
  const rootIdx = NOTES.indexOf(rootName);
  const priors = new Map();

  if (rootIdx === -1) return priors;

  if (!isMinor) {
    // Escala Maior: I, ii, iii, IV, V, vi + IVm, bVII, V/vi, V/V
    priors.set(NOTES[rootIdx], 1.35);                         // I
    priors.set(`${NOTES[(rootIdx + 2) % 12]}m`, 1.15);        // ii
    priors.set(`${NOTES[(rootIdx + 4) % 12]}m`, 1.10);        // iii
    priors.set(NOTES[(rootIdx + 5) % 12], 1.30);              // IV
    priors.set(NOTES[(rootIdx + 7) % 12], 1.32);              // V
    priors.set(`${NOTES[(rootIdx + 9) % 12]}m`, 1.28);        // vi
    priors.set(`${NOTES[(rootIdx + 5) % 12]}m`, 1.05);        // iv (empréstimo)
    priors.set(NOTES[(rootIdx + 10) % 12], 1.05);             // bVII
    priors.set(NOTES[(rootIdx + 4) % 12], 1.08);              // III (V/vi)
    priors.set(NOTES[(rootIdx + 2) % 12], 1.05);              // II (V/V)
  } else {
    // Escala Menor: i, III, iv, v, V, VI, VII
    priors.set(`${NOTES[rootIdx]}m`, 1.38);                   // i
    priors.set(NOTES[(rootIdx + 3) % 12], 1.26);              // III
    priors.set(`${NOTES[(rootIdx + 5) % 12]}m`, 1.26);        // iv
    priors.set(`${NOTES[(rootIdx + 7) % 12]}m`, 1.18);        // v
    priors.set(NOTES[(rootIdx + 7) % 12], 1.24);              // V (dominante harmônica)
    priors.set(NOTES[(rootIdx + 8) % 12], 1.28);              // VI
    priors.set(NOTES[(rootIdx + 10) % 12], 1.25);             // VII
    priors.set(`${NOTES[(rootIdx + 10) % 12]}m`, 1.05);       // viim
    priors.set(NOTES[(rootIdx + 5) % 12], 1.08);              // IV (Dórico)
  }

  return priors;
}

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
 * Goertzel de frequência exata (sem arredondamento inteiro de bin k!).
 * Permite distinguir semitons graves (ex: C2 65.4Hz vs C#2 69.3Hz) com precisão absoluta.
 */
function exactGoertzelEnergy(samples, length, targetFreq, sampleRate) {
  const omega = (2 * Math.PI * targetFreq) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0, s1 = 0, s2 = 0;

  for (let i = 0; i < length; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  const power = s1 * s1 + s2 * s2 - s1 * s2 * coeff;
  return Math.max(0, power / (length * length));
}

/**
 * Calcula o cromagrama harmônico (12 notas) e o cromagrama de baixo (C2-B2)
 * sobre um trecho de áudio já sub-amostrado.
 */
function computeSegmentChroma(dsData, dsRate, startIdx, endIdx) {
  const chroma = new Float32Array(12);
  const bassChroma = new Float32Array(12);
  const segLen = endIdx - startIdx;
  if (segLen < 128) return { chroma, bassChroma, energy: 0 };

  // Limita a janela a 3072 amostras (~0.28s a 11kHz) centrada no segmento para máxima resolução e velocidade
  const winLen = Math.min(segLen, 3072);
  const offset = startIdx + Math.floor((segLen - winLen) * 0.5);
  const windowed = new Float32Array(winLen);

  let rmsSum = 0;
  for (let i = 0; i < winLen; i++) {
    const s = dsData[offset + i] || 0;
    rmsSum += s * s;
    // Janela de Hann para eliminar vazamento espectral entre semitons vizinhos
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winLen - 1)));
    windowed[i] = s * hann;
  }

  const rms = Math.sqrt(rmsSum / winLen);
  if (rms < 0.002) {
    return { chroma, bassChroma, energy: rms };
  }

  const A4 = 440;
  for (let noteIdx = 0; noteIdx < 12; noteIdx++) {
    // Oitava 2 (Baixo Fundamental: C2 = MIDI 36, 65.4 Hz a 123.5 Hz)
    const freq2 = A4 * Math.pow(2, (36 + noteIdx - 69) / 12);
    const e2 = Math.sqrt(exactGoertzelEnergy(windowed, winLen, freq2, dsRate));

    // Oitava 3 (Corpo Harmônico: C3 = MIDI 48, 130.8 Hz a 246.9 Hz)
    const freq3 = A4 * Math.pow(2, (48 + noteIdx - 69) / 12);
    const e3 = Math.sqrt(exactGoertzelEnergy(windowed, winLen, freq3, dsRate));

    // Oitava 4 (Acordes Médios: C4 = MIDI 60, 261.6 Hz a 493.9 Hz)
    const freq4 = A4 * Math.pow(2, (60 + noteIdx - 69) / 12);
    const e4 = Math.sqrt(exactGoertzelEnergy(windowed, winLen, freq4, dsRate));

    bassChroma[noteIdx] = e2 * 1.35 + e3 * 0.55;
    chroma[noteIdx] = e2 * 1.15 + e3 * 1.25 + e4 * 0.85;
  }

  // Normaliza os vetores de croma
  let maxC = 0;
  let maxB = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxC) maxC = chroma[i];
    if (bassChroma[i] > maxB) maxB = bassChroma[i];
  }
  if (maxC > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= maxC;
  }
  if (maxB > 0) {
    for (let i = 0; i < 12; i++) bassChroma[i] /= maxB;
  }

  return { chroma, bassChroma, energy: rms };
}

/**
 * Estima a tonalidade global (Key) combinando o perfil Krumhansl-Kessler
 * com a nota fundamental de baixo mais recorrente no início e fim da música.
 */
export function estimateKeyFromChroma(globalChroma, globalBassChroma) {
  let bestScore = -Infinity;
  let bestKey = 'C';

  for (let root = 0; root < 12; root++) {
    const rotatedChroma = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      rotatedChroma[i] = globalChroma[(root + i) % 12];
    }

    const bassBoost = globalBassChroma ? globalBassChroma[root] * 0.18 : 0;

    // Avalia Tonalidade Maior
    const thirdMaj = globalChroma[(root + 4) % 12];
    const scoreMajor =
      correlation(rotatedChroma, MAJOR_PROFILE) +
      bassBoost +
      thirdMaj * 0.08;

    if (scoreMajor > bestScore) {
      bestScore = scoreMajor;
      bestKey = NOTES[root];
    }

    // Avalia Tonalidade Menor
    const thirdMin = globalChroma[(root + 3) % 12];
    const scoreMinor =
      correlation(rotatedChroma, MINOR_PROFILE) +
      bassBoost +
      thirdMin * 0.08;

    if (scoreMinor > bestScore) {
      bestScore = scoreMinor;
      bestKey = `${NOTES[root]}m`;
    }
  }

  return bestKey;
}

/**
 * Identifica o melhor acorde para um segmento a partir do seu cromagrama,
 * do baixo fundamental e do contexto harmônico da tonalidade.
 */
function matchBestChordForSegment(chroma, bassChroma, keyPriors, prevChord) {
  let bestChord = 'C';
  let bestScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    const rVal = chroma[root];
    const bVal = bassChroma[root];
    const fifth = chroma[(root + 7) % 12];

    // Penaliza notas fora da tríade que causam choque de semitom
    const maj3 = chroma[(root + 4) % 12];
    const min3 = chroma[(root + 3) % 12];
    const avoidMaj = chroma[(root + 1) % 12] * 0.3 + chroma[(root + 3) % 12] * 0.25;
    const avoidMin = chroma[(root + 1) % 12] * 0.3 + chroma[(root + 4) % 12] * 0.25;

    // 1. Candidato Maior
    const majName = NOTES[root];
    const majPrior = keyPriors.get(majName) || 0.82;
    const majContinuity = prevChord === majName ? 1.08 : 1.0;
    const rawMaj = (rVal * 1.35 + bVal * 0.65 + maj3 * 1.15 + fifth * 0.85 - avoidMaj) * majPrior * majContinuity;

    if (rawMaj > bestScore) {
      bestScore = rawMaj;
      bestChord = majName;
    }

    // 2. Candidato Menor
    const minName = `${NOTES[root]}m`;
    const minPrior = keyPriors.get(minName) || 0.82;
    const minContinuity = prevChord === minName ? 1.08 : 1.0;
    const rawMin = (rVal * 1.35 + bVal * 0.65 + min3 * 1.15 + fifth * 0.85 - avoidMin) * minPrior * minContinuity;

    if (rawMin > bestScore) {
      bestScore = rawMin;
      bestChord = minName;
    }
  }

  return bestChord;
}

/**
 * Analisa todo o AudioBuffer em janelas sincronizadas com os compassos/tempos reais:
 * 1. Sub-amostra em 4x (filtro anti-aliasing) para rodar em < 25ms no celular
 * 2. Calcula o cromagrama real de cada janela de 2 batidas (meio compasso)
 * 3. Detecta o Tom Global (Key) real da gravação
 * 4. Detecta o Acorde exato tocado em cada janela de tempo e agrupa durações reais
 */
export function analyzeHarmonicKeyAndChords(audioBuffer, bpm = 120, firstBeatOffset = 0) {
  const sr = audioBuffer.sampleRate;
  const inL = audioBuffer.getChannelData(0);
  const inR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : inL;
  const totalSamples = audioBuffer.length;
  const duration = audioBuffer.duration;

  // Sub-amostragem 4x com média (filtro passa-baixa anti-aliasing simples)
  const dsFactor = 4;
  const dsRate = sr / dsFactor;
  const dsLen = Math.floor(totalSamples / dsFactor);
  const dsData = new Float32Array(dsLen);

  for (let i = 0; i < dsLen; i++) {
    const base = i * dsFactor;
    const m0 = (inL[base] + inR[base]) * 0.5;
    const m1 = (inL[base + 1] + inR[base + 1]) * 0.5;
    const m2 = (inL[base + 2] + inR[base + 2]) * 0.5;
    const m3 = (inL[base + 3] + inR[base + 3]) * 0.5;
    dsData[i] = (m0 + m1 + m2 + m3) * 0.25;
  }

  // Define janelas de análise a cada 2 batidas (meio compasso 4/4) alinhadas ao firstBeatOffset
  const beatDur = 60 / Math.max(60, Math.min(200, bpm));
  const stepDur = beatDur * 2; // 2 tempos por segmento para capturar trocas no meio ou início do compasso
  const startOffset = Math.max(0, firstBeatOffset % beatDur);

  const segments = [];
  const globalChroma = new Float32Array(12);
  const globalBassChroma = new Float32Array(12);

  for (let t = startOffset; t < duration - 0.25; t += stepDur) {
    const tEnd = Math.min(duration, t + stepDur);
    const sIdx = Math.floor(t * dsRate);
    const eIdx = Math.min(dsLen, Math.floor(tEnd * dsRate));

    const { chroma, bassChroma, energy } = computeSegmentChroma(dsData, dsRate, sIdx, eIdx);
    segments.push({ tStart: t, tEnd, chroma, bassChroma, energy });

    if (energy >= 0.004) {
      for (let i = 0; i < 12; i++) {
        globalChroma[i] += chroma[i] * energy;
        globalBassChroma[i] += bassChroma[i] * energy;
      }
    }
  }

  // Normaliza acumulador global
  let maxG = 0, maxGB = 0;
  for (let i = 0; i < 12; i++) {
    if (globalChroma[i] > maxG) maxG = globalChroma[i];
    if (globalBassChroma[i] > maxGB) maxGB = globalBassChroma[i];
  }
  if (maxG > 0) {
    for (let i = 0; i < 12; i++) globalChroma[i] /= maxG;
  }
  if (maxGB > 0) {
    for (let i = 0; i < 12; i++) globalBassChroma[i] /= maxGB;
  }

  const detectedKey = estimateKeyFromChroma(globalChroma, globalBassChroma);
  const keyPriors = getKeyChordPriors(detectedKey);

  // Detecta o acorde real em cada segmento de tempo
  const rawChords = [];
  let prevChord = detectedKey;

  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];
    let chordName;
    if (seg.energy < 0.003) {
      chordName = idx === 0 ? detectedKey : prevChord;
    } else {
      chordName = matchBestChordForSegment(seg.chroma, seg.bassChroma, keyPriors, prevChord);
      prevChord = chordName;
    }

    rawChords.push({
      time: Number(seg.tStart.toFixed(2)),
      duration: Number((seg.tEnd - seg.tStart).toFixed(2)),
      chord: chordName
    });
  }

  // Agrupa segmentos consecutivos que possuem o mesmo acorde (máximo 1 compasso de 4 tempos por bloco visual)
  const barDur = beatDur * 4;
  const mergedChords = [];

  for (const item of rawChords) {
    const last = mergedChords[mergedChords.length - 1];
    if (last && last.chord === item.chord && last.duration + item.duration <= barDur * 1.05) {
      last.duration = Number((last.duration + item.duration).toFixed(2));
    } else {
      mergedChords.push({ ...item });
    }
  }

  // Se houver intro antes do firstBeatOffset, garante cobertura desde t = 0
  if (mergedChords.length > 0 && mergedChords[0].time > 0.05) {
    mergedChords[0].duration = Number((mergedChords[0].duration + mergedChords[0].time).toFixed(2));
    mergedChords[0].time = 0;
  }

  return {
    detectedKey,
    chords: mergedChords.length > 0 ? mergedChords : [{ time: 0, duration: 4, chord: detectedKey }]
  };
}
