// ============================================================================
// GERADOR DE FAIXAS MULTISTEM (SÍNTESE DE ÁUDIO REAL EM MEMÓRIA)
// ============================================================================

// Tabela de Seno pré-calculada para síntese ultrarrápida em celulares (< 25ms sem travar a UI)
export const SINE_TABLE_SIZE = 4096;
export const SINE_TABLE_MASK = SINE_TABLE_SIZE - 1;
export const SINE_TABLE = new Float32Array(SINE_TABLE_SIZE);

for (let i = 0; i < SINE_TABLE_SIZE; i++) {
  SINE_TABLE[i] = Math.sin((2 * Math.PI * i) / SINE_TABLE_SIZE);
}

export const fastSin = (rad) => {
  const idx = ((rad * (SINE_TABLE_SIZE / (2 * Math.PI))) | 0) & SINE_TABLE_MASK;
  return SINE_TABLE[idx];
};

export function extractPeaks(audioBuffer, numBins = 160) {
  const data = audioBuffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / numBins));
  const peaks = [];
  for (let i = 0; i < numBins; i++) {
    let max = 0;
    const start = i * step;
    for (let j = 0; j < step; j += 16) {
      const val = Math.abs(data[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, Math.max(0.08, max)));
  }
  return peaks;
}

export function generatePreviewPeaksForSong(song) {
  const mk = (seed, base) =>
    Array.from({ length: 140 }, (_, i) => {
      const v =
        base +
        0.38 * Math.abs(Math.sin(i * 0.27 + seed)) +
        0.22 * Math.abs(Math.cos(i * 0.63 + seed * 2));
      return Math.min(0.96, Math.max(0.12, v));
    });
  const seedShift = (song?.bpm || 108) * 0.1;
  return {
    vocals: mk(1.1 + seedShift, 0.22),
    drums: mk(2.4 + seedShift, 0.28),
    bass: mk(3.7 + seedShift, 0.32),
    other: mk(5.0 + seedShift, 0.20),
    metronome: Array.from({ length: 140 }, (_, i) => (i % 4 === 0 ? 0.85 : 0.15))
  };
}

export function synthesizeSongStems(ctx, song, pitchSemitones = 0) {
  const sampleRate = ctx.sampleRate || 44100;
  const duration = song.duration;
  const totalSamples = Math.floor(sampleRate * duration);
  const beatDur = 60 / song.bpm;
  const barDur = beatDur * 4;

  // Multiplicador exato de frequência para o tom selecionado: f = f0 * 2^(semitones / 12)
  const pitchRatio = Math.pow(2, pitchSemitones / 12);

  const createBuf = () => ctx.createBuffer(2, totalSamples, sampleRate);
  const vocalsBuf = createBuf();
  const drumsBuf = createBuf();
  const bassBuf = createBuf();
  const otherBuf = createBuf();
  const metroBuf = createBuf();

  const vL = vocalsBuf.getChannelData(0), vR = vocalsBuf.getChannelData(1);
  const dL = drumsBuf.getChannelData(0),  dR = drumsBuf.getChannelData(1);
  const bL = bassBuf.getChannelData(0),   bR = bassBuf.getChannelData(1);
  const oL = otherBuf.getChannelData(0),  oR = otherBuf.getChannelData(1);
  const mL = metroBuf.getChannelData(0),  mR = metroBuf.getChannelData(1);

  const getChordAtTime = (t) => {
    const idx = Math.min(song.chords.length - 1, Math.floor(t / barDur));
    return song.chords[idx] || song.chords[0];
  };

  // 1. SÍNTESE DE VOCAL / MELODIA LEAD NO TOM EXATO
  let vocalPhase = 0;
  const melodyPattern = [0, 2, 1, 3, 2, 1, 0, -1];
  const noteStep = beatDur * 0.5;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const stepIdx = (t / noteStep) | 0;
    const localT = (t % noteStep) / noteStep;
    const patVal = melodyPattern[stepIdx % melodyPattern.length];
    if (patVal >= 0) {
      const chord = getChordAtTime(t);
      const baseFreq = ((chord.freqs[patVal % chord.freqs.length] || 261.63) * 2) * pitchRatio;
      const vibrato = fastSin(2 * Math.PI * 5.5 * t) * 0.008;
      const freq = baseFreq * (1 + vibrato);
      vocalPhase += (2 * Math.PI * freq) / sampleRate;
      const env = fastSin(Math.PI * localT) * (1 - localT * 0.65);
      const sig =
        (fastSin(vocalPhase) * 0.65 +
          fastSin(vocalPhase * 2) * 0.25 +
          fastSin(vocalPhase * 3) * 0.1) *
        env *
        0.38;
      vL[i] = sig * 0.95;
      vR[i] = sig * 1.05;
    }
  }

  // 2. SÍNTESE DE BATERIA (Bumbo, Caixa, Chimbal) + SMART METRÔNOMO (Mantém punch rítmico nativo)
  const totalEighths = Math.floor(duration / (beatDur * 0.5));
  for (let e = 0; e < totalEighths; e++) {
    const startSample = Math.floor(e * beatDur * 0.5 * sampleRate);
    const isBeat = e % 2 === 0;
    const beatNum = Math.floor(e / 2) % 4;

    if (isBeat) {
      const clickFreq = beatNum === 0 ? 1480 : 987.77;
      const clickLen = Math.floor(0.045 * sampleRate);
      for (let k = 0; k < clickLen && startSample + k < totalSamples; k++) {
        const kt = k / sampleRate;
        const env = Math.exp(-kt * 85);
        const clickVal =
          (fastSin(2 * Math.PI * clickFreq * kt) * 0.8 +
            fastSin(2 * Math.PI * (clickFreq * 2) * kt) * 0.2) *
          env *
          (beatNum === 0 ? 0.75 : 0.52);
        mL[startSample + k] += clickVal;
        mR[startSample + k] += clickVal;
      }
    }

    if (e % 8 === 0 || e % 8 === 4 || e % 8 === 5) {
      const kickLen = Math.floor(0.22 * sampleRate);
      let kPhase = 0;
      for (let k = 0; k < kickLen && startSample + k < totalSamples; k++) {
        const kt = k / sampleRate;
        const f = 52 + 115 * Math.exp(-kt * 38);
        kPhase += (2 * Math.PI * f) / sampleRate;
        const env = Math.exp(-kt * 14);
        const val = fastSin(kPhase) * env * 0.65;
        dL[startSample + k] += val;
        dR[startSample + k] += val;
      }
    }

    if (e % 8 === 2 || e % 8 === 6) {
      const snareLen = Math.floor(0.18 * sampleRate);
      for (let k = 0; k < snareLen && startSample + k < totalSamples; k++) {
        const kt = k / sampleRate;
        const tone = fastSin(2 * Math.PI * 185 * kt) * Math.exp(-kt * 25);
        const noise = (Math.random() * 2 - 1) * Math.exp(-kt * 19);
        const val = (tone * 0.45 + noise * 0.55) * 0.5;
        dL[startSample + k] += val;
        dR[startSample + k] += val;
      }
    }

    const hatLen = Math.floor(0.06 * sampleRate);
    for (let k = 0; k < hatLen && startSample + k < totalSamples; k++) {
      const kt = k / sampleRate;
      const val =
        (Math.random() * 2 - 1) * Math.exp(-kt * (e % 2 === 0 ? 45 : 70)) * 0.22;
      dL[startSample + k] += val * 1.1;
      dR[startSample + k] += val * 0.9;
    }
  }

  // 3. SÍNTESE DE CONTRABAIXO + 4. HARMONIA (Transpostos com perfeição matemática)
  let bassPhase = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const eighthIdx = (t / (beatDur * 0.5)) | 0;
    const localT = (t % (beatDur * 0.5)) / (beatDur * 0.5);
    const chord = getChordAtTime(t);
    const isFifth = eighthIdx % 4 === 3;
    const rootFreq = ((chord.freqs[isFifth ? 2 : 0] || 196.0) * 0.5) * pitchRatio;
    bassPhase += (2 * Math.PI * rootFreq) / sampleRate;
    const bEnv = (1 - localT * 0.75) * Math.min(1, localT * 35);
    const bSig = (fastSin(bassPhase) * 0.75 + fastSin(bassPhase * 2) * 0.25) * bEnv * 0.58;
    bL[i] = bSig;
    bR[i] = bSig;

    const beatLocal = (t % beatDur) / beatDur;
    const oEnv = (1 - beatLocal * 0.7) * Math.min(1, beatLocal * 40);
    const f0 = (chord.freqs[0] || 220) * pitchRatio;
    const f1 = (chord.freqs[1] || 261.63) * pitchRatio;
    const f2 = (chord.freqs[2] || 329.63) * pitchRatio;
    const f3 = (chord.freqs[3] || 392.0) * pitchRatio;
    const sL = fastSin(2 * Math.PI * f0 * t) + fastSin(2 * Math.PI * f2 * t);
    const sR = fastSin(2 * Math.PI * f1 * t) + fastSin(2 * Math.PI * f3 * t);
    oL[i] = (sL * 0.18 + sR * 0.06) * oEnv;
    oR[i] = (sR * 0.18 + sL * 0.06) * oEnv;
  }

  return {
    vocals:    { buffer: vocalsBuf, peaks: extractPeaks(vocalsBuf) },
    drums:     { buffer: drumsBuf,  peaks: extractPeaks(drumsBuf) },
    bass:      { buffer: bassBuf,   peaks: extractPeaks(bassBuf) },
    other:     { buffer: otherBuf,  peaks: extractPeaks(otherBuf) },
    metronome: { buffer: metroBuf,  peaks: extractPeaks(metroBuf) }
  };
}
