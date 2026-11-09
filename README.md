# DAVI Studio AI 🎛️ 🎵

Estúdio de música completo, reprodutor multitrack (stems), modulador de tom em tempo real (pitch shifting), analisador de acordes com diagramas para violão/piano, metrônomo inteligente e separador de faixas client-side & server-side.

---

## 🚀 Demonstração Online (Link Remoto)

- **URL de Produção:** [https://davi-studio-music.netlify.app](https://davi-studio-music.netlify.app)
- **Repositório GitHub:** [https://github.com/erickolivers93-lgtm/davi-studio-music](https://github.com/erickolivers93-lgtm/davi-studio-music)

---

## ✨ Principais Funcionalidades

1. **Reprodutor Multitrack (5 Stems)**:
   - **Vocais**, **Bateria**, **Contrabaixo**, **Harmonia/Outros** e **Smart Metrônomo**.
   - Controles independentes de Mute, Solo, Volume (0% a 120%) e Balanço Estéreo (Pan L/R).
   - Formas de onda vetoriais interativas geradas via Canvas com suporte a Retina/High-DPI.

2. **Modulação de Tom & Andamento em Tempo Real**:
   - Transposição de tom de -12 a +12 semitons via processamento granular Web Audio API com compensação automática de latência nos ritmos.
   - Ajuste fino de velocidade de reprodução (50% a 150%) com recálculo instantâneo de BPM.

3. **Cifras e Diagramas de Acordes Visuais**:
   - Transposição dinâmica e sincronizada de todas as cifras na grade da música.
   - Diagrama responsivo com posições no **Braço do Violão/Guitarra** e no **Teclado de Piano**.
   - Pulso visual do compasso 4/4 sincronizado com o Smart Metrônomo.
   - Contagem prévia inteligente de 4 tempos (Count-in).

4. **Separação de Faixas Dupla**:
   - **Modo Client-side (Navegador/Celular)**: Decomposição DSP Mid-Side com filtros de frequência e transientes para arquivos `.mp3`, `.wav` ou `.m4a` enviados diretamente pelo aparelho sem gastar servidor.
   - **Modo Servidor Local (Python / Demucs v4 / Colab)**: Script FastAPI completo (`server.py`) com rede neural Demucs v4, Librosa e yt-dlp para processar URLs do YouTube.

5. **Multiplataforma & Mobile Ready**:
   - Layout adaptável com abas dedicadas no mobile: *Faixas*, *Acordes*, *Tom/BPM* e *Músicas*.
   - Suporte PWA (Progressive Web App) com instalação direta na tela de início de celulares iOS e Android.
   - Exportação master da mixagem personalizada diretamente para arquivo `.WAV`.

---

## 📂 Arquitetura do Projeto

```
davi-studio-music/
├── src/
│   ├── audio/
│   │   ├── audioEngine.js          # Síntese em memória, lookup de senos e extração de picos
│   │   ├── pitchShifter.js         # Pitch shifter granular Web Audio em tempo real
│   │   ├── dspSeparator.js         # Detecção de BPM e separador DSP Mid-Side no cliente
│   │   └── wavExporter.js          # Exportação do master em 16-bit PCM WAV
│   ├── components/
│   │   ├── BackendModal.jsx        # Modal com código e status do servidor Python
│   │   ├── ChordDiagram.jsx        # SVG visual para Violão e Piano
│   │   ├── ChordProgressionBar.jsx # Seções, cifras dinâmicas e loops
│   │   ├── HeaderHUD.jsx           # HUD superior com tom, BPM, metrônomo e ações
│   │   ├── ImportModal.jsx         # Modal de importação YouTube e upload de áudio
│   │   ├── MobileHUD.jsx           # HUD compacta para smartphones
│   │   ├── MobileModulationPanel.jsx # Painel mobile para pitch e velocidade
│   │   ├── SidebarLibrary.jsx      # Seletor de faixas e presets de mix
│   │   ├── StemIcon.jsx            # Ícones SVG sem emojis
│   │   ├── StemWaveformRow.jsx     # Linha de faixa individual com canvas
│   │   └── TransportFooter.jsx     # Rodapé de playback, timecode e navegação
│   ├── constants/
│   │   └── musicConstants.js       # Transposição de notas, shapes e músicas preset
│   ├── server/
│   │   └── server.py               # Servidor FastAPI Demucs v4 para processamento local/Colab
│   ├── App.jsx                     # Componente raiz gerenciador de estado
│   ├── index.css                   # Tailwind e estilos de controles de áudio
│   └── main.jsx                    # Ponto de entrada React
├── public/
│   ├── favicon.svg
│   └── manifest.json               # Configuração PWA para celulares
├── netlify.toml                    # Configuração de deploy no Netlify
├── package.json
└── vite.config.js
```

---

## 🛠️ Como Rodar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/erickolivers93-lgtm/davi-studio-music.git
cd davi-studio-music
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```
Acesse `http://localhost:5173`.

---

## 🐍 Como Iniciar o Servidor Python Local (Opcional)

Para processar vídeos do YouTube com separação neural via Demucs v4:

```bash
pip install fastapi uvicorn yt-dlp demucs librosa soundfile python-multipart
python src/server/server.py
```
O servidor responderá em `http://localhost:8000`. O DAVI Studio detecta a conexão automaticamente!
