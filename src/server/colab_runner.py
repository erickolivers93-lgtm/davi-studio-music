# ============================================================================
# DAVI STUDIO AI - RUNNER PARA GOOGLE COLAB COM GPU GRÁTIS (T4)
# ============================================================================
# Instruções para rodar no Google Colab (Custo Zero):
# 1. Abra o Google Colab: https://colab.research.google.com/
# 2. Em 'Ambiente de Execução' -> 'Alterar tipo de ambiente de execução', selecione GPU T4.
# 3. Crie uma célula de código, cole este script e aperte Play.
# 4. Copie a URL pública gerada (.trycloudflare.com) e cole no DAVI Studio!

import os
import time
import subprocess
import re

print("🚀 1/4 • Instalando Dependências de Áudio e IA (Demucs v4 + yt-dlp)...")
subprocess.run([
    "pip", "install", "-q",
    "fastapi", "uvicorn", "yt-dlp", "demucs", "librosa",
    "soundfile", "numpy", "python-multipart"
], check=True)

print("🌐 2/4 • Instalando Cloudflare Tunnel para gerar URL pública segura...")
subprocess.run([
    "wget", "-q", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
], check=True)
subprocess.run(["dpkg", "-i", "cloudflared-linux-amd64.deb"], check=True)

print("🎧 3/4 • Criando Servidor FastAPI DAVI Studio...")
server_code = """
import os
import uuid
import subprocess
from pathlib import Path
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import librosa
import numpy as np

app = FastAPI(title="DAVI Studio Colab AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE = Path("/content/workspace_stems")
WORKSPACE.mkdir(parents=True, exist_ok=True)
app.mount("/stems", StaticFiles(directory=str(WORKSPACE)), name="stems")

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def analyze_harmony_and_beats(audio_path: str):
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = int(round(float(np.ndim(tempo) > 0 and tempo[0] or tempo)))
    
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
    return {"status": "online", "engine": "Google Colab GPU (Demucs v4 + yt-dlp)"}

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
    
    # 2. Separação de 4 faixas com Demucs v4 acelerado por GPU
    subprocess.run([
        "demucs", "-d", "cuda", "-n", "htdemucs", "-o", str(job_dir), str(input_mp3)
    ], check=True)
    
    # 3. Análise de Harmonia e BPM
    analysis = analyze_harmony_and_beats(str(input_mp3))
    
    # Host público recuperado do ambiente
    public_host = os.environ.get("DAVI_PUBLIC_HOST", "http://localhost:8000")
    base_url = f"{public_host}/stems/{job_id}/htdemucs/original"
    
    return {
        "id": job_id,
        "title": f"YouTube Track ({job_id})",
        "artist": "Processado por Demucs v4 (GPU Colab)",
        **analysis,
        "stemUrls": {
            "vocals": f"{base_url}/vocals.wav",
            "drums": f"{base_url}/drums.wav",
            "bass": f"{base_url}/bass.wav",
            "other": f"{base_url}/other.wav"
        }
    }
"""

with open("colab_app.py", "w") as f:
    f.write(server_code)

print("⚡ 4/4 • Iniciando Servidor e Túnel Cloudflare...")
# Inicia Cloudflare Tunnel em background
tunnel_log = open("tunnel.log", "w")
tunnel_proc = subprocess.Popen(
    ["cloudflared", "tunnel", "--url", "http://localhost:8000"],
    stdout=tunnel_log, stderr=tunnel_log
)

# Aguarda a URL do túnel ser gerada no log
time.sleep(3)
public_url = None
for _ in range(20):
    if os.path.exists("tunnel.log"):
        with open("tunnel.log", "r") as f:
            content = f.read()
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
            if match:
                public_url = match.group(0)
                break
    time.sleep(1)

if public_url:
    print("\\n" + "=" * 70)
    print("✅ SERVIDOR DAVI STUDIO ONLINE COM GPU T4!")
    print(f"🔗 URL DO SEU BACKEND: {public_url}")
    print("=" * 70)
    print("👉 Abra o DAVI Studio, clique no ícone de Servidor (topo direito),")
    print(f"   cole a URL '{public_url}' e clique em Salvar!")
    print("=" * 70 + "\\n")
    os.environ["DAVI_PUBLIC_HOST"] = public_url
else:
    print("⚠️ Não foi possível capturar a URL automática do túnel. Verifique tunnel.log.")

# Inicia Uvicorn
subprocess.run(["uvicorn", "colab_app:app", "--host", "0.0.0.0", "--port", "8000"])
