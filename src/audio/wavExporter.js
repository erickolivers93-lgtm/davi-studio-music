// ============================================================================
// EXPORTADOR DE MIXAGEM PARA ARQUIVO .WAV
// ============================================================================

export function exportMixToWavBlob(stemsData, trackStates) {
  const firstStem = stemsData.vocals?.buffer;
  if (!firstStem) return null;
  const sr = firstStem.sampleRate;
  const numSamples = firstStem.length;
  const outL = new Float32Array(numSamples);
  const outR = new Float32Array(numSamples);

  const anySolo = Object.values(trackStates).some((t) => t.solo);

  Object.keys(trackStates).forEach((key) => {
    const st = trackStates[key];
    const buf = stemsData[key]?.buffer;
    if (!buf) return;
    const isAudible = anySolo ? st.solo : !st.muted;
    if (!isAudible || st.volume <= 0) return;

    const cL = buf.getChannelData(0);
    const cR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : cL;
    const pan = st.pan || 0;
    const gainL = st.volume * Math.min(1, 1 - pan);
    const gainR = st.volume * Math.min(1, 1 + pan);

    for (let i = 0; i < numSamples; i++) {
      outL[i] += cL[i] * gainL;
      outR[i] += cR[i] * gainR;
    }
  });

  const buffer = new ArrayBuffer(44 + numSamples * 4);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 4, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 4, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sL = Math.max(-1, Math.min(1, outL[i]));
    const sR = Math.max(-1, Math.min(1, outR[i]));
    view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
    offset += 2;
    view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
