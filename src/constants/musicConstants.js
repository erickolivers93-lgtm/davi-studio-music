// ============================================================================
// CONSTANTES MUSICAIS E TRANSPOSIÇÃO DE ACORDES
// ============================================================================
export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function transposeNote(note, semitones) {
  if (!note) return '';
  const clean = note.trim();
  let idx = NOTES_SHARP.indexOf(clean);
  if (idx === -1) idx = NOTES_FLAT.indexOf(clean);
  if (idx === -1) return note;
  const newIdx = (idx + semitones + 120) % 12;
  return NOTES_SHARP[newIdx];
}

export function transposeChord(chordStr, semitones) {
  if (!chordStr || chordStr === 'N.C.') return chordStr;
  if (semitones === 0) return chordStr;
  return chordStr.replace(/^([A-G][#b]?)(.*)$/, (_, root, suffix) => {
    const transposedRoot = transposeNote(root, semitones);
    if (suffix.includes('/')) {
      const [qual, bass] = suffix.split('/');
      return `${transposedRoot}${qual}/${transposeNote(bass, semitones)}`;
    }
    return `${transposedRoot}${suffix}`;
  });
}

/**
 * Retorna as 25 tonalidades cromáticas possíveis (-12 a +12 semitons) a partir do tom original
 */
export function getAvailableKeys(originalKey = 'Am') {
  const keys = [];
  for (let s = -12; s <= 12; s++) {
    const keyName = transposeChord(originalKey, s);
    const sign = s > 0 ? `+${s}` : `${s}`;
    let label = `${keyName} (${sign} st)`;
    if (s === 0) label = `${keyName} (Tom Original)`;
    keys.push({
      semitones: s,
      keyName,
      label,
      isOriginal: s === 0
    });
  }
  return keys;
}

/**
 * Extrai o ID do vídeo do YouTube de qualquer formato de link (watch, youtu.be, shorts, mobile, embed)
 */
export function parseYoutubeId(url) {
  if (!url) return null;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = url.trim().match(regExp);
  return match ? match[1] : null;
}

// Dicionário de posições de acordes para o diagrama visual (Violão/Guitarra e Piano)
export const CHORD_SHAPES = {
  'C':    { frets: [-1, 3, 2, 0, 1, 0], piano: [0, 4, 7] },
  'C#':   { frets: [-1, 4, 6, 6, 6, 4], piano: [1, 5, 8] },
  'D':    { frets: [-1, -1, 0, 2, 3, 2], piano: [2, 6, 9] },
  'D#':   { frets: [-1, 6, 8, 8, 8, 6], piano: [3, 7, 10] },
  'E':    { frets: [0, 2, 2, 1, 0, 0], piano: [4, 8, 11] },
  'F':    { frets: [1, 3, 3, 2, 1, 1], piano: [5, 9, 0] },
  'F#':   { frets: [2, 4, 4, 3, 2, 2], piano: [6, 10, 1] },
  'G':    { frets: [3, 2, 0, 0, 0, 3], piano: [7, 11, 2] },
  'G#':   { frets: [4, 6, 6, 5, 4, 4], piano: [8, 0, 3] },
  'A':    { frets: [-1, 0, 2, 2, 2, 0], piano: [9, 1, 4] },
  'A#':   { frets: [-1, 1, 3, 3, 3, 1], piano: [10, 2, 5] },
  'B':    { frets: [-1, 2, 4, 4, 4, 2], piano: [11, 3, 6] },
  'Cm':   { frets: [-1, 3, 5, 5, 4, 3], piano: [0, 3, 7] },
  'C#m':  { frets: [-1, 4, 6, 6, 5, 4], piano: [1, 4, 8] },
  'Dm':   { frets: [-1, -1, 0, 2, 3, 1], piano: [2, 5, 9] },
  'D#m':  { frets: [-1, 6, 8, 8, 7, 6], piano: [3, 6, 10] },
  'Em':   { frets: [0, 2, 2, 0, 0, 0], piano: [4, 7, 11] },
  'Fm':   { frets: [1, 3, 3, 1, 1, 1], piano: [5, 8, 0] },
  'F#m':  { frets: [2, 4, 4, 2, 2, 2], piano: [6, 9, 1] },
  'Gm':   { frets: [3, 5, 5, 3, 3, 3], piano: [7, 10, 2] },
  'G#m':  { frets: [4, 6, 6, 4, 4, 4], piano: [8, 11, 3] },
  'Am':   { frets: [-1, 0, 2, 2, 1, 0], piano: [9, 0, 4] },
  'A#m':  { frets: [-1, 1, 3, 3, 2, 1], piano: [10, 1, 5] },
  'Bm':   { frets: [-1, 2, 4, 4, 3, 2], piano: [11, 2, 6] },
};

export function getChordShape(chordName) {
  if (!chordName) return CHORD_SHAPES['C'];
  const normalized = chordName.replace(/7|9|maj|sus4|add9/g, '');
  return (
    CHORD_SHAPES[normalized] ||
    CHORD_SHAPES[normalized.slice(0, 2)] ||
    CHORD_SHAPES[normalized[0]] ||
    CHORD_SHAPES['C']
  );
}

export function buildSongChordsByBpm(bpm, progression) {
  const barDuration = (60 / bpm) * 4;
  return progression.map((item, idx) => ({
    time: Number((idx * barDuration).toFixed(3)),
    duration: Number(barDuration.toFixed(3)),
    chord: item.chord,
    freqs: item.freqs
  }));
}

export function buildSongSectionsByBpm(bpm, sectionNames) {
  const barDuration = (60 / bpm) * 4;
  const barsPerSection = 4;
  return sectionNames.map((name, idx) => ({
    name,
    start: Number((idx * barsPerSection * barDuration).toFixed(2)),
    end: Number(((idx + 1) * barsPerSection * barDuration).toFixed(2))
  }));
}

export const PRESET_SONGS = [
  {
    id: 'neon-groove',
    title: 'Midnight Neon Groove',
    artist: 'DAVI Studio • Soul / Funk',
    genre: 'Soul / Funk',
    bpm: 108,
    originalKey: 'Am',
    coverGradient: 'from-purple-600 via-indigo-600 to-slate-900',
    duration: Number((((60 / 108) * 4) * 16).toFixed(2)),
    sections: buildSongSectionsByBpm(108, ['Intro', 'Verso 1', 'Refrão', 'Solo / Outro']),
    chords: buildSongChordsByBpm(108, [
      { chord: 'Am', freqs: [220.0, 261.63, 329.63, 392.0] },
      { chord: 'F',  freqs: [174.61, 220.0, 261.63, 329.63] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 493.88] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'Am', freqs: [220.0, 261.63, 329.63, 392.0] },
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
      { chord: 'Em', freqs: [164.81, 196.0, 246.94, 293.66] },
      { chord: 'Am', freqs: [220.0, 261.63, 329.63, 392.0] },
      { chord: 'F',  freqs: [174.61, 220.0, 261.63, 329.63] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'Em', freqs: [164.81, 196.0, 246.94, 293.66] },
      { chord: 'Am', freqs: [220.0, 261.63, 329.63, 392.0] },
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 493.88] },
      { chord: 'E',  freqs: [164.81, 207.65, 246.94, 329.63] }
    ])
  },
  {
    id: 'southern-rock',
    title: 'Highway Overdrive',
    artist: 'DAVI Studio • Classic Rock',
    genre: 'Classic Rock',
    bpm: 120,
    originalKey: 'G',
    coverGradient: 'from-amber-500 via-orange-600 to-stone-900',
    duration: Number((((60 / 120) * 4) * 16).toFixed(2)),
    sections: buildSongSectionsByBpm(120, ['Riff Inicial', 'Estrofe', 'Refrão Forte', 'Lead Final']),
    chords: buildSongChordsByBpm(120, [
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'D',  freqs: [293.66, 369.99, 440.0, 587.33] },
      { chord: 'Em', freqs: [164.81, 196.0, 246.94, 329.63] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 523.25] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'D',  freqs: [293.66, 369.99, 440.0, 587.33] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 523.25] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'Em', freqs: [164.81, 196.0, 246.94, 329.63] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 523.25] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
      { chord: 'D',  freqs: [293.66, 369.99, 440.0, 587.33] },
      { chord: 'Am', freqs: [220.0, 261.63, 329.63, 440.0] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 523.25] },
      { chord: 'D',  freqs: [293.66, 369.99, 440.0, 587.33] },
      { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] }
    ])
  },
  {
    id: 'bossa-session',
    title: 'Tarde em Copacabana',
    artist: 'DAVI Studio • Bossa / MPB',
    genre: 'Bossa / MPB',
    bpm: 96,
    originalKey: 'Dm',
    coverGradient: 'from-emerald-600 via-teal-700 to-zinc-900',
    duration: Number((((60 / 96) * 4) * 16).toFixed(2)),
    sections: buildSongSectionsByBpm(96, ['Tema A', 'Tema B', 'Modulação', 'Coda']),
    chords: buildSongChordsByBpm(96, [
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
      { chord: 'Gm', freqs: [196.0, 233.08, 293.66, 349.23] },
      { chord: 'A',  freqs: [220.0, 277.18, 329.63, 440.0] },
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
      { chord: 'Gm', freqs: [196.0, 233.08, 293.66, 349.23] },
      { chord: 'C',  freqs: [261.63, 329.63, 392.0, 493.88] },
      { chord: 'F',  freqs: [174.61, 220.0, 261.63, 349.23] },
      { chord: 'A',  freqs: [220.0, 277.18, 329.63, 440.0] },
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
      { chord: 'Gm', freqs: [196.0, 233.08, 293.66, 349.23] },
      { chord: 'Bb', freqs: [233.08, 293.66, 349.23, 466.16] },
      { chord: 'A',  freqs: [220.0, 277.18, 329.63, 440.0] },
      { chord: 'Gm', freqs: [196.0, 233.08, 293.66, 349.23] },
      { chord: 'A',  freqs: [220.0, 277.18, 329.63, 440.0] },
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
      { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] }
    ])
  }
];

export const STEM_CONFIG = [
  { key: 'vocals',    label: 'Vocais',          color: '#10b981' },
  { key: 'drums',     label: 'Bateria',         color: '#22c55e' },
  { key: 'bass',      label: 'Contrabaixo',     color: '#f59e0b' },
  { key: 'other',     label: 'Harmonia',        color: '#a855f7' },
  { key: 'metronome', label: 'Smart Metrônomo', color: '#34d399' }
];

export const PYTHON_SERVER_CODE = `# server.py - Backend Local DAVI Studio AI
# Requisitos:
# pip install fastapi uvicorn yt-dlp demucs librosa soundfile numpy python-multipart

import os
import uuid
import subprocess
from pathlib import Path
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import librosa
import numpy as np

app = FastAPI(title="DAVI Studio AI Local Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE = Path("./workspace_stems")
WORKSPACE.mkdir(exist_ok=True)
app.mount("/stems", StaticFiles(directory=str(WORKSPACE)), name="stems")

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def analyze_harmony_and_beats(audio_path: str):
    """Extrai BPM, Tom principal e Acordes sincronizados usando Librosa."""
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))
    
    # 1. Detecção de BPM e Batidas (Smart Metronome)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = int(round(float(np.ndim(tempo) > 0 and tempo[0] or tempo)))
    
    # 2. Cromagrama para estimativa de Tom e Acordes a cada 2 segundos
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)
    key_idx = int(np.argmax(chroma_mean))
    detected_key = NOTES[key_idx]
    
    chords = []
    step_sec = 2.0
    total_steps = int(np.ceil(duration / step_sec))
    for i in range(total_steps):
        t_start = i * step_sec
        f_start = librosa.time_to_frames(t_start, sr=sr)
        f_end = librosa.time_to_frames(min(duration, t_start + step_sec), sr=sr)
        if f_end > f_start:
            seg = np.mean(chroma[:, f_start:f_end], axis=1)
            root = int(np.argmax(seg))
            minor_third = seg[(root + 3) % 12]
            major_third = seg[(root + 4) % 12]
            qual = "m" if minor_third > major_third * 1.05 else ""
            chords.append({
                "time": round(t_start, 2),
                "duration": step_sec,
                "chord": f"{NOTES[root]}{qual}"
            })
            
    return {
        "bpm": bpm,
        "originalKey": detected_key,
        "duration": round(duration, 2),
        "chords": chords
    }

@app.get("/api/health")
def health():
    return {"status": "online", "engine": "Demucs v4 + yt-dlp + Librosa"}

@app.post("/api/youtube")
def process_youtube(url: str = Form(...)):
    job_id = str(uuid.uuid4())[:8]
    job_dir = WORKSPACE / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    input_mp3 = job_dir / "original.mp3"
    
    # 1. Download via yt-dlp
    subprocess.run([
        "yt-dlp", "-x", "--audio-format", "mp3",
        "-o", str(input_mp3), url
    ], check=True)
    
    # 2. Separação de 4 faixas com Demucs (htdemucs)
    subprocess.run([
        "demucs", "-n", "htdemucs", "-o", str(job_dir), str(input_mp3)
    ], check=True)
    
    # 3. Análise de BPM, Acordes e Tom com Librosa
    analysis = analyze_harmony_and_beats(str(input_mp3))
    base_url = f"http://localhost:8000/stems/{job_id}/htdemucs/original"
    
    return {
        "id": job_id,
        "title": f"YouTube Track ({job_id})",
        "artist": "Importado via yt-dlp + Demucs",
        **analysis,
        "stemUrls": {
            "vocals": f"{base_url}/vocals.wav",
            "drums": f"{base_url}/drums.wav",
            "bass": f"{base_url}/bass.wav",
            "other": f"{base_url}/other.wav"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
