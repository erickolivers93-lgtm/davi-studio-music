# server.py - Backend Local DAVI Studio AI
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
