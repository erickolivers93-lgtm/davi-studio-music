import { fastSin } from './audioEngine';

/**
 * Cria um Pitch Shifter granular em tempo real no Web Audio API
 * Utiliza dupla linha de delay circular modulada em dente-de-serra com janelas senoidais em quadratura
 */
export function createRealtimePitchShifter(ctx, pitchStateRef) {
  const bufferSize = 1024;
  const node = ctx.createScriptProcessor(bufferSize, 2, 2);
  const delaySamples = Math.floor(ctx.sampleRate * 0.055);
  const ringL = new Float32Array(delaySamples);
  const ringR = new Float32Array(delaySamples);
  let writePtr = 0;
  let phasor = 0;

  node.onaudioprocess = (e) => {
    const inL = e.inputBuffer.getChannelData(0);
    const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL;
    const outL = e.outputBuffer.getChannelData(0);
    const outR = e.outputBuffer.numberOfChannels > 1 ? e.outputBuffer.getChannelData(1) : outL;

    const { semitones, speed } = pitchStateRef.current;
    const desiredPitchRatio = Math.pow(2, semitones / 12) / speed;
    const phasorStep =
      Math.abs(desiredPitchRatio - 1.0) < 0.003
        ? 0
        : (1 - desiredPitchRatio) / delaySamples;

    for (let i = 0; i < inL.length; i++) {
      ringL[writePtr] = inL[i];
      ringR[writePtr] = inR[i];

      if (phasorStep === 0) {
        // Ponto médio fixo para garantir latência constante em semitones === 0
        const fixedDelay = delaySamples >> 1;
        const readIdx = (writePtr - fixedDelay + delaySamples) % delaySamples;
        outL[i] = ringL[readIdx];
        outR[i] = ringR[readIdx];
      } else {
        phasor = (phasor + phasorStep) % 1.0;
        if (phasor < 0) phasor += 1.0;
        const phasor2 = (phasor + 0.5) % 1.0;

        const delay1 = phasor * (delaySamples - 2);
        const delay2 = phasor2 * (delaySamples - 2);

        const read1 = (writePtr - delay1 + delaySamples) % delaySamples;
        const read2 = (writePtr - delay2 + delaySamples) % delaySamples;

        const r1Int = read1 | 0;
        const r1Frac = read1 - r1Int;
        const r2Int = read2 | 0;
        const r2Frac = read2 - r2Int;

        const s1L =
          ringL[r1Int] * (1 - r1Frac) + ringL[(r1Int + 1) % delaySamples] * r1Frac;
        const s2L =
          ringL[r2Int] * (1 - r2Frac) + ringL[(r2Int + 1) % delaySamples] * r2Frac;

        const s1R =
          ringR[r1Int] * (1 - r1Frac) + ringR[(r1Int + 1) % delaySamples] * r1Frac;
        const s2R =
          ringR[r2Int] * (1 - r2Frac) + ringR[(r2Int + 1) % delaySamples] * r2Frac;

        const win1 = fastSin(Math.PI * phasor);
        const win2 = fastSin(Math.PI * phasor2);
        const norm = win1 * win1 + win2 * win2 || 1;

        outL[i] = (s1L * (win1 * win1) + s2L * (win2 * win2)) / norm;
        outR[i] = (s1R * (win1 * win1) + s2R * (win2 * win2)) / norm;
      }

      writePtr = (writePtr + 1) % delaySamples;
    }
  };

  return node;
}
