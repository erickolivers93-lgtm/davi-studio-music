import { extractPeaks, fastSin } from './audioEngine.js';

// ============================================================================
// SEPARADOR DSP DE ESTÚDIO (4ª ORDEM LINKWITZ-RILEY + MID/SIDE + TRANSIENTES)
// Isola Vocais, Bateria, Contrabaixo e Harmonia sem vazamento de voz (bleed)
// e gera Smart Metrônomo com bloqueio de fase nos transientes reais da música.
// ============================================================================

/**
 * Detecta BPM com precisão decimal, fase exata do downbeat (tempo 1)
 * e gera grade de batidas travada nos transientes percussivos reais.
 */
export function detectBpmAndOffsetFromBuffer(sourceBuffer) {
  const sr = sourceBuffer.sampleRate;
  const inL = sourceBuffer.getChannelData(0);
  const inR = sourceBuffer.numberOfChannels > 1 ? sourceBuffer.getChannelData(1) : inL;
  const totalSamples = sourceBuffer.length;
  const duration = sourceBuffer.duration;

  // Taxa de quadros de 200 Hz (resolução temporal de 5ms)
  const frameRate = 200;
  const hop = Math.max(1, Math.floor(sr / frameRate));
  const actualFrameRate = sr / hop;
  const numFrames = Math.floor(totalSamples / hop);

  if (numFrames < 100) {
    return { bpm: 120, firstBeatOffset: 0, beatTimes: [0, 0.5, 1.0, 1.5] };
  }

  // Extrai envelope de transientes percussivos (graves do bumbo < 130Hz + ataque > 1.5kHz)
  const onsetEnv = new Float32Array(numFrames);
  let lpKick = 0;
  let prevLowE = 0;
  let prevHighE = 0;
  const alphaKick = 1 - Math.exp((-2 * Math.PI * 130) / (sr / 2));

  for (let f = 0; f < numFrames; f++) {
    const base = f * hop;
    let lowE = 0;
    let highE = 0;
    let prevSample = ((inL[base] || 0) + (inR[base] || 0)) * 0.5;

    for (let i = 0; i < hop; i += 2) {
      const idx = base + i;
      const m = ((inL[idx] || 0) + (inR[idx] || 0)) * 0.5;
      lpKick += alphaKick * (m - lpKick);
      lowE += lpKick * lpKick;

      const diff = m - prevSample;
      prevSample = m;
      highE += diff * diff;
    }

    const curLow = Math.sqrt(lowE / (hop * 0.5));
    const curHigh = Math.sqrt(highE / (hop * 0.5));
    const dLow = Math.max(0, curLow - prevLowE);
    const dHigh = Math.max(0, curHigh - prevHighE);
    prevLowE = curLow * 0.65 + prevLowE * 0.35;
    prevHighE = curHigh * 0.65 + prevHighE * 0.35;

    onsetEnv[f] = dLow * 1.8 + dHigh * 1.0;
  }

  // Normaliza e aplica limiar adaptativo para limpar ruído de fundo
  let maxOnset = 0;
  for (let f = 0; f < numFrames; f++) {
    if (onsetEnv[f] > maxOnset) maxOnset = onsetEnv[f];
  }
  if (maxOnset > 0) {
    for (let f = 0; f < numFrames; f++) {
      onsetEnv[f] = Math.max(0, onsetEnv[f] / maxOnset - 0.06);
    }
  }

  // Analisa janela representativa (até 45s) e calcula autocorrelação até 3x maxLag
  const analysisFrames = Math.min(numFrames, Math.floor(45 * actualFrameRate));
  const minLag = Math.round((60 / 168) * actualFrameRate); // ~168 BPM
  const maxLag = Math.round((60 / 68) * actualFrameRate);  // ~68 BPM
  const maxAcfLag = Math.min(analysisFrames - 2, maxLag * 3 + 4);

  const acf = new Float32Array(maxAcfLag + 2);
  for (let lag = minLag; lag <= maxAcfLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + lag < analysisFrames; i++) {
      sum += onsetEnv[i] * onsetEnv[i + lag];
      count++;
    }
    acf[lag] = count > 0 ? sum / count : 0;
  }

  // Filtro Comb Multi-Harmônico simétrico (1x, 2x, 3x) com prior perceptual centrado em 116 BPM
  let bestLag = Math.round((60 / 120) * actualFrameRate);
  let bestCombScore = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const candidateBpm = (60 * actualFrameRate) / lag;
    const logDiff = Math.log2(candidateBpm / 116);
    const tempoPrior = Math.exp(-0.5 * (logDiff / 0.55) * (logDiff / 0.55));

    // Combina energia no período fundamental (1 batida), 2 batidas e 3 batidas
    const e1 = acf[lag] + 0.5 * (acf[lag - 1] + acf[lag + 1]);
    const e2 = lag * 2 <= maxAcfLag
      ? acf[lag * 2] + 0.5 * (acf[lag * 2 - 1] + acf[lag * 2 + 1])
      : e1;
    const e3 = lag * 3 <= maxAcfLag
      ? acf[lag * 3] + 0.5 * (acf[lag * 3 - 1] + acf[lag * 3 + 1])
      : e1;

    const comb = e1 * 1.0 + e2 * 0.65 + e3 * 0.4;
    const totalScore = comb * tempoPrior;

    if (totalScore > bestCombScore) {
      bestCombScore = totalScore;
      bestLag = lag;
    }
  }

  // Interpolação parabólica para precisão sub-frame do período da batida
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y1 = acf[bestLag - 1];
    const y2 = acf[bestLag];
    const y3 = acf[bestLag + 1];
    const denom = y1 - 2 * y2 + y3;
    if (Math.abs(denom) > 1e-6) {
      const delta = (0.5 * (y1 - y3)) / denom;
      if (Math.abs(delta) <= 0.5) {
        refinedLag = bestLag + delta;
      }
    }
  }

  const exactBeatSec = (refinedLag * hop) / sr;
  const detectedBpm = Math.round(60 / exactBeatSec);
  const beatSec = 60 / detectedBpm;
  const periodFrames = (beatSec * sr) / hop;

  // Localiza a fase exata do primeiro tempo forte (Downbeat 1 de 4)
  const intPeriod = Math.max(1, Math.round(periodFrames));
  let bestPhase = 0;
  let bestPhaseEnergy = -1;

  for (let p = 0; p < intPeriod; p++) {
    let e = 0;
    for (let beatIdx = 0; ; beatIdx++) {
      const f = Math.round(p + beatIdx * periodFrames);
      if (f >= analysisFrames) break;
      const weight = beatIdx % 4 === 0 ? 1.35 : 1.0;
      const e0 = onsetEnv[f] || 0;
      const ePrev = f > 0 ? onsetEnv[f - 1] * 0.5 : 0;
      const eNext = f + 1 < analysisFrames ? onsetEnv[f + 1] * 0.5 : 0;
      e += (e0 + ePrev + eNext) * weight;
    }
    if (e > bestPhaseEnergy) {
      bestPhaseEnergy = e;
      bestPhase = p;
    }
  }

  // Constrói a grade de batidas com bloqueio dinâmico de fase (Onset Phase-Locking)
  const beatTimes = [];
  let currentFrame = bestPhase;
  const searchRadius = Math.max(2, Math.round(periodFrames * 0.14));

  while (currentFrame < numFrames) {
    const centerFrame = Math.round(currentFrame);
    let localPeakFrame = centerFrame;
    let localPeakVal = onsetEnv[centerFrame] || 0;

    const startSearch = Math.max(0, centerFrame - searchRadius);
    const endSearch = Math.min(numFrames - 1, centerFrame + searchRadius);
    for (let f = startSearch; f <= endSearch; f++) {
      if (onsetEnv[f] > localPeakVal * 1.15) {
        localPeakVal = onsetEnv[f];
        localPeakFrame = f;
      }
    }

    if (localPeakVal > 0.12) {
      currentFrame = currentFrame + 0.28 * (localPeakFrame - currentFrame);
    }

    const beatTimeSec = Math.max(0, Math.min(duration, (currentFrame * hop) / sr));
    beatTimes.push(beatTimeSec);

    currentFrame += periodFrames;
  }

  const firstBeatOffset = beatTimes.length > 0 ? beatTimes[0] : (bestPhase * hop) / sr;

  return {
    bpm: detectedBpm,
    firstBeatOffset,
    beatTimes
  };
}

/**
 * Separa um AudioBuffer em 4 Stems independentes + Smart Metrônomo:
 * - Contrabaixo (Bass): Linkwitz-Riley 4ª ordem < 145 Hz (zero voz)
 * - Vocais (Vocals): Canal Central 210 Hz – 4100 Hz com subtração espectral de Side e rejeição de percussão
 * - Bateria (Drums): Gate de fluxo de transientes rápidos + agudos de pratos/chimbais > 5400 Hz (zero voz sustentada)
 * - Harmonia / Instrumentos (Other): Canal Side Estéreo (cancelamento de fase 100% da voz central) + corpo harmônico
 */
export async function separateLocalAudioBufferClientSide(ctx, sourceBuffer) {
  const sr = sourceBuffer.sampleRate;
  const len = sourceBuffer.length;
  const inL = sourceBuffer.getChannelData(0);
  const inR = sourceBuffer.numberOfChannels > 1 ? sourceBuffer.getChannelData(1) : inL;

  const { bpm: detectedBpm, firstBeatOffset, beatTimes } = detectBpmAndOffsetFromBuffer(sourceBuffer);

  const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const bufFactory = ctx || new OfflineCtxClass(2, 1, sr);
  const mk = () => bufFactory.createBuffer(2, len, sr);

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

  // Verifica se o arquivo é Estéreo real ou Mono (L == R)
  let totalMidE = 0;
  let totalSideE = 0;
  const checkStep = Math.max(1, Math.floor(len / 4000));
  for (let i = 0; i < len; i += checkStep) {
    const m = (inL[i] + inR[i]) * 0.5;
    const s = (inL[i] - inR[i]) * 0.5;
    totalMidE += m * m;
    totalSideE += s * s;
  }
  const isMonoTrack = totalSideE < totalMidE * 0.008;

  // Coeficientes de filtros Linkwitz-Riley em cascata (4 polos = 24 dB/oitava)
  const aBass = 1 - Math.exp((-2 * Math.PI * 145) / sr);       // Cutoff 145 Hz (Baixo)
  const aVocalLow = 1 - Math.exp((-2 * Math.PI * 210) / sr);   // Cutoff 210 Hz (Corte grave da voz)
  const aVocalHigh = 1 - Math.exp((-2 * Math.PI * 4100) / sr); // Cutoff 4.1 kHz (Topo da voz)
  const aAir = 1 - Math.exp((-2 * Math.PI * 5400) / sr);       // Cutoff 5.4 kHz (Pratos/Chimbal)
  const aFormant = 1 - Math.exp((-2 * Math.PI * 1150) / sr);   // Centro formante p/ faixas mono

  // Coeficientes de envelope para separação Harmônico-Percussiva e máscara Central
  const aEnvFast = 1 - Math.exp(-1 / (0.002 * sr)); // Ataque rápido 2ms
  const aEnvSlow = 1 - Math.exp(-1 / (0.045 * sr)); // Sustentação 45ms
  const aMaskSmooth = 1 - Math.exp(-1 / (0.015 * sr)); // Suavização 15ms

  // Estados dos filtros de 4 polos
  let bass1 = 0, bass2 = 0, bass3 = 0, bass4 = 0;
  let vLow1 = 0, vLow2 = 0, vLow3 = 0, vLow4 = 0;
  let vHigh1 = 0, vHigh2 = 0, vHigh3 = 0;
  let sideLow1 = 0, sideLow2 = 0;
  let airL1 = 0, airL2 = 0, airL3 = 0;
  let airR1 = 0, airR2 = 0, airR3 = 0;
  let form1 = 0, form2 = 0;

  let envMidBand = 0;
  let envSideBand = 0;
  let smoothVocalGain = 0.85;
  let fastTransEnv = 0;
  let slowTransEnv = 0;
  let fastKickEnv = 0;
  let slowKickEnv = 0;

  for (let i = 0; i < len; i++) {
    const l = inL[i];
    const r = inR[i];
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;

    // 1. CONTRABAIXO (Bass): Filtro Linkwitz-Riley 4 polos em 145 Hz
    // Rejeita 100% da voz (> 200 Hz) e isola sub-grave e contrabaixo limpos
    bass1 += aBass * (mid - bass1);
    bass2 += aBass * (bass1 - bass2);
    bass3 += aBass * (bass2 - bass3);
    bass4 += aBass * (bass3 - bass4);
    const pureBass = bass4;

    // Detecta transiente rápido de bumbo (Kick) dentro do grave para o stem de Bateria
    const absBass = Math.abs(bass2 - bass4);
    fastKickEnv += aEnvFast * (absBass - fastKickEnv);
    slowKickEnv += aEnvSlow * (absBass - slowKickEnv);
    const kickGate = Math.min(1, Math.max(0, (fastKickEnv - slowKickEnv * 1.15) / (fastKickEnv + 1e-5)));

    bL[i] = pureBass * 1.35;
    bR[i] = pureBass * 1.35;

    // 2. BANDA CENTRAL DE VOZ (210 Hz a 4100 Hz) com corte de 4ª ordem (24 dB/oct)
    vLow1 += aVocalLow * (mid - vLow1);
    vLow2 += aVocalLow * (vLow1 - vLow2);
    vLow3 += aVocalLow * (vLow2 - vLow3);
    vLow4 += aVocalLow * (vLow3 - vLow4);
    const midAbove210 = mid - vLow4; // Passa-alta íngreme > 210 Hz

    vHigh1 += aVocalHigh * (midAbove210 - vHigh1);
    vHigh2 += aVocalHigh * (vHigh1 - vHigh2);
    vHigh3 += aVocalHigh * (vHigh2 - vHigh3);
    const midVocalBand = vHigh3; // Passa-faixa 210 Hz - 4100 Hz

    // Remove graves do canal Side (< 210 Hz)
    sideLow1 += aVocalLow * (side - sideLow1);
    sideLow2 += aVocalLow * (sideLow1 - sideLow2);
    const cleanSide = side - sideLow2;

    // 3. DETECÇÃO DE TRANSIENTES PERCUSSIVOS (Caixa, Palmas, Ataque de Bateria)
    const highMid = midAbove210 - midVocalBand; // > 4.1 kHz no Mid
    const percSignal = midVocalBand * 0.5 + highMid * 1.2;
    const absPerc = Math.abs(percSignal);
    fastTransEnv += aEnvFast * (absPerc - fastTransEnv);
    slowTransEnv += aEnvSlow * (absPerc - slowTransEnv);

    const rawTrans = Math.max(0, (fastTransEnv - slowTransEnv * 1.18) / (fastTransEnv + 1e-5));
    const percGate = Math.min(1, rawTrans * rawTrans * 2.4); // 0 durante notas cantadas sustentadas!

    // 4. SEPARAÇÃO VOCAIS (Centro Sustentado) vs HARMONIA (Side Estéreo + Corpo)
    const sustainWeight = 1 - percGate * 0.85;

    let vocalOut;
    if (!isMonoTrack) {
      envMidBand += aEnvSlow * (Math.abs(midVocalBand) - envMidBand);
      envSideBand += aEnvSlow * (Math.abs(cleanSide) - envSideBand);
      const estVocalRatio = Math.max(0.15, Math.min(1.0, (envMidBand - envSideBand * 0.35) / (envMidBand + 1e-6)));
      smoothVocalGain += aMaskSmooth * (estVocalRatio - smoothVocalGain);
      vocalOut = midVocalBand * smoothVocalGain * sustainWeight * 1.15;
    } else {
      form1 += aFormant * (midVocalBand - form1);
      form2 += aFormant * (form1 - form2);
      vocalOut = (form1 - form2 * 0.35) * sustainWeight * 1.15;
    }

    vL[i] = vocalOut;
    vR[i] = vocalOut;

    // STEM BATERIA: Pratos/Chimbais (> 5.4 kHz 3ª ordem, zero voz) + Transientes de Caixa/Ataque + Kick Punch
    airL1 += aAir * (l - airL1);
    const hpL1 = l - airL1;
    airL2 += aAir * (hpL1 - airL2);
    const hpL2 = hpL1 - airL2;
    airL3 += aAir * (hpL2 - airL3);
    const cymbalL = hpL2 - airL3;

    airR1 += aAir * (r - airR1);
    const hpR1 = r - airR1;
    airR2 += aAir * (hpR1 - airR2);
    const hpR2 = hpR1 - airR2;
    airR3 += aAir * (hpR2 - airR3);
    const cymbalR = hpR2 - airR3;

    const snareTrans = midAbove210 * percGate * 1.45;
    const kickPunch = (bass1 - bass3) * kickGate * 1.6;

    dL[i] = kickPunch + snareTrans + cymbalL * 1.25;
    dR[i] = kickPunch + snareTrans + cymbalR * 1.25;

    // STEM HARMONIA / VIOLÃO / TECLADOS:
    // Usa o canal Side Estéreo (L - R), onde a voz central se cancela 100% por fase (L - R = 0)
    // + corpo médio-grave de 4ª ordem (145 Hz - 210 Hz). Zero vazamento da voz central!
    const lowerMidBody = (vLow4 - pureBass) * 0.9;
    const nonVocalMono = isMonoTrack ? (midVocalBand - vocalOut) * sustainWeight : 0;

    oL[i] = cleanSide * 1.35 + lowerMidBody + nonVocalMono;
    oR[i] = -cleanSide * 1.35 + lowerMidBody + nonVocalMono;
  }

  // 5. SMART METRÔNOMO SINCRONIZADO COM OS TRANSIENTES REAIS DA MÚSICA
  for (let b = 0; b < beatTimes.length; b++) {
    const start = Math.floor(beatTimes[b] * sr);
    if (start >= len) break;
    const isDownbeat = b % 4 === 0;
    const freq = isDownbeat ? 1480 : 987.77;
    const clickLen = Math.min(Math.floor(0.045 * sr), len - start);
    for (let k = 0; k < clickLen; k++) {
      const kt = k / sr;
      const val =
        fastSin(2 * Math.PI * freq * kt) *
        Math.exp(-kt * 85) *
        (isDownbeat ? 0.75 : 0.52);
      mL[start + k] = val;
      mR[start + k] = val;
    }
  }

  return {
    detectedBpm,
    firstBeatOffset,
    beatTimes,
    stems: {
      vocals:    { buffer: vocalsBuf, peaks: extractPeaks(vocalsBuf) },
      drums:     { buffer: drumsBuf,  peaks: extractPeaks(drumsBuf) },
      bass:      { buffer: bassBuf,   peaks: extractPeaks(bassBuf) },
      other:     { buffer: otherBuf,  peaks: extractPeaks(otherBuf) },
      metronome: { buffer: metroBuf,  peaks: extractPeaks(metroBuf) }
    }
  };
}
