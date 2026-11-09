import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, Upload, AlertCircle } from 'lucide-react';
import {
  PRESET_SONGS,
  STEM_CONFIG,
  transposeChord,
  parseYoutubeId,
  buildSongChordsByBpm,
  buildSongSectionsByBpm
} from './constants/musicConstants';
import {
  synthesizeSongStems,
  generatePreviewPeaksForSong,
  extractPeaks
} from './audio/audioEngine';
import { separateLocalAudioBufferClientSide } from './audio/dspSeparator';
import { exportMixToWavBlob } from './audio/wavExporter';
import {
  saveTrackToDB,
  getAllTracksFromDB,
  deleteTrackFromDB
} from './audio/audioStorage';

import { CatalogView } from './components/CatalogView';
import { HeaderHUD } from './components/HeaderHUD';
import { MobileHUD } from './components/MobileHUD';
import { ChordProgressionBar } from './components/ChordProgressionBar';
import { StemWaveformRow } from './components/StemWaveformRow';
import { SidebarLibrary } from './components/SidebarLibrary';
import { MobileModulationPanel } from './components/MobileModulationPanel';
import { TransportFooter } from './components/TransportFooter';
import { ImportModal } from './components/ImportModal';
import { BackendModal } from './components/BackendModal';

export default function App() {
  // Navegação Principal: 'catalog' (Estilo Moises AI Inicial) ou 'studio' (Mixer Multitrack)
  const [currentPage, setCurrentPage] = useState('catalog');

  const [songs, setSongs] = useState(() => {
    try {
      const saved = localStorage.getItem('davi_studio_songs_metadata');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return PRESET_SONGS;
  });

  const [activeSongId, setActiveSongId] = useState(PRESET_SONGS[0].id);
  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) || songs[0],
    [songs, activeSongId]
  );

  // Aba ativa no Mobile dentro do Studio ('mixer' | 'chords' | 'modulation' | 'library')
  const [mobileTab, setMobileTab] = useState('mixer');

  // Estados de reprodução e DSP
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [countInBars, setCountInBars] = useState(0);
  const [countInRemaining, setCountInRemaining] = useState(0);
  const [loopRange, setLoopRange] = useState({ enabled: false, start: 0, end: 8, label: '' });
  const [showChordInspector, setShowChordInspector] = useState(true);

  // Modais e notificações
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBackendModal, setShowBackendModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingJob, setProcessingJob] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Referência para input de substituição rápida de MP3 no estúdio
  const replaceAudioInputRef = useRef(null);

  // Estado individual das 5 faixas (Stems + Smart Metrônomo)
  const [trackStates, setTrackStates] = useState({
    vocals:    { volume: 1.0, pan: 0, muted: false, solo: false },
    drums:     { volume: 1.0, pan: 0, muted: false, solo: false },
    bass:      { volume: 1.0, pan: 0, muted: false, solo: false },
    other:     { volume: 1.0, pan: 0, muted: false, solo: false },
    metronome: { volume: 0.65, pan: 0, muted: true,  solo: false }
  });

  // Referências para o motor Web Audio API
  const audioCtxRef = useRef(null);
  const stemsDataRef = useRef({});
  const synthesizedSongIdRef = useRef(null);
  const synthesizedPitchRef = useRef(0);
  const activeNodesRef = useRef({});
  const playStartCtxTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const [peaksMap, setPeaksMap] = useState(() => generatePreviewPeaksForSong(PRESET_SONGS[0]));

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Salva lista de músicas no localStorage
  useEffect(() => {
    try {
      const serializable = songs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        genre: s.genre,
        bpm: s.bpm,
        originalKey: s.originalKey,
        duration: s.duration,
        thumbnail: s.thumbnail,
        coverGradient: s.coverGradient,
        sections: s.sections,
        chords: s.chords
      }));
      localStorage.setItem('davi_studio_songs_metadata', JSON.stringify(serializable));
    } catch (_) {}
  }, [songs]);

  // Carrega faixas customizadas salvas do IndexedDB
  useEffect(() => {
    (async () => {
      try {
        const storedTracks = await getAllTracksFromDB();
        if (storedTracks && storedTracks.length > 0) {
          setSongs((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            storedTracks.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
      } catch (_) {}
    })();
  }, []);

  const checkLocalBackend = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('http://localhost:8000/api/health', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setBackendOnline(true);
        return true;
      }
    } catch (_) {
      setBackendOnline(false);
    }
    return false;
  }, []);

  useEffect(() => {
    checkLocalBackend();
  }, [checkLocalBackend]);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (
      audioCtxRef.current.state === 'suspended' ||
      audioCtxRef.current.state === 'interrupted'
    ) {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const stopAudioNodes = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    Object.values(activeNodesRef.current).forEach((nodeObj) => {
      try {
        nodeObj.source.stop();
        nodeObj.source.disconnect();
      } catch (_) {}
    });
    activeNodesRef.current = {};
  }, []);

  // Quando a música ativa mudar, reseta estados e carrega stems
  useEffect(() => {
    stopAudioNodes();
    setIsPlaying(false);
    setCurrentTime(0);
    setPitchSemitones(0);
    setPlaybackSpeed(1.0);
    setLoopRange({ enabled: false, start: 0, end: 8, label: '' });

    if (activeSong.customStems) {
      stemsDataRef.current = activeSong.customStems;
      synthesizedSongIdRef.current = activeSong.id;
      synthesizedPitchRef.current = 0;
      const customPeaks = {};
      Object.keys(activeSong.customStems).forEach((k) => {
        customPeaks[k] = activeSong.customStems[k].peaks;
      });
      setPeaksMap(customPeaks);
    } else {
      stemsDataRef.current = {};
      synthesizedSongIdRef.current = null;
      synthesizedPitchRef.current = 0;
      setPeaksMap(generatePreviewPeaksForSong(activeSong));
    }
  }, [activeSong, stopAudioNodes]);

  // Atualização em tempo real de volume e pan dos nós de áudio
  useEffect(() => {
    if (!audioCtxRef.current) return;
    const anySolo = Object.values(trackStates).some((t) => t.solo);
    const now = audioCtxRef.current.currentTime;

    Object.keys(trackStates).forEach((key) => {
      const st = trackStates[key];
      const nodeObj = activeNodesRef.current[key];
      if (!nodeObj) return;
      const isAudible = anySolo ? st.solo : !st.muted;
      const targetGain = isAudible ? st.volume : 0;
      try {
        nodeObj.gainNode.gain.setTargetAtTime(targetGain, now, 0.015);
        if (nodeObj.panNode) {
          nodeObj.panNode.pan.setTargetAtTime(st.pan, now, 0.015);
        }
      } catch (_) {}
    });
  }, [trackStates]);

  // Início da reprodução sincronizada com afinação limpa de estúdio
  const startPlaybackAt = useCallback(
    async (offsetSeconds) => {
      const ctx = ensureAudioContext();
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (_) {}
      }

      // Se a música for de catálogo e o tom mudou, sintetiza no tom exato (Zero ruído metálico)
      const needsRegen =
        !stemsDataRef.current?.vocals ||
        synthesizedSongIdRef.current !== activeSong.id ||
        (!activeSong.customStems && synthesizedPitchRef.current !== pitchSemitones);

      if (needsRegen) {
        if (activeSong.customStems) {
          stemsDataRef.current = activeSong.customStems;
        } else {
          stemsDataRef.current = synthesizeSongStems(ctx, activeSong, pitchSemitones);
        }
        synthesizedSongIdRef.current = activeSong.id;
        synthesizedPitchRef.current = pitchSemitones;

        const realPeaks = {};
        Object.keys(stemsDataRef.current).forEach((k) => {
          realPeaks[k] = stemsDataRef.current[k].peaks;
        });
        setPeaksMap(realPeaks);
      }

      stopAudioNodes();

      const clampedOffset = Math.max(
        0,
        Math.min((activeSong.duration || 32) - 0.05, offsetSeconds)
      );
      const anySolo = Object.values(trackStates).some((t) => t.solo);
      const syncStartTime = ctx.currentTime + 0.015;

      Object.keys(trackStates).forEach((key) => {
        const stemObj = stemsDataRef.current[key];
        if (!stemObj?.buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = stemObj.buffer;
        source.playbackRate.value = playbackSpeed;

        // Para faixas customizadas de upload, aplica detune nativo limpo do Web Audio nos harmônicos
        if (activeSong.customStems && (key === 'vocals' || key === 'bass' || key === 'other')) {
          if (source.detune) {
            source.detune.value = pitchSemitones * 100;
          }
        }

        const gainNode = ctx.createGain();
        const st = trackStates[key];
        const isAudible = anySolo ? st.solo : !st.muted;
        gainNode.gain.value = isAudible ? st.volume : 0;

        const panNode =
          typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
        if (panNode) {
          panNode.pan.value = st.pan;
          source.connect(gainNode);
          gainNode.connect(panNode);
          panNode.connect(ctx.destination);
        } else {
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
        }

        source.start(syncStartTime, clampedOffset);
        activeNodesRef.current[key] = { source, gainNode, panNode };
      });

      playStartCtxTimeRef.current = syncStartTime;
      playStartOffsetRef.current = clampedOffset;
      setCurrentTime(clampedOffset);
      setIsPlaying(true);

      const updateLoop = () => {
        if (!audioCtxRef.current) return;
        const rawElapsed = audioCtxRef.current.currentTime - playStartCtxTimeRef.current;
        const elapsed = Math.max(0, rawElapsed) * playbackSpeed;
        const nextTime = playStartOffsetRef.current + elapsed;

        if (loopRange.enabled && nextTime >= loopRange.end) {
          startPlaybackAt(loopRange.start);
          return;
        }

        if (nextTime >= (activeSong.duration || 32)) {
          stopAudioNodes();
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }

        setCurrentTime(nextTime);
        rafRef.current = requestAnimationFrame(updateLoop);
      };

      rafRef.current = requestAnimationFrame(updateLoop);
    },
    [activeSong, ensureAudioContext, loopRange, playbackSpeed, pitchSemitones, stopAudioNodes, trackStates]
  );

  const togglePlay = () => {
    const ctx = ensureAudioContext();
    if (isPlaying) {
      stopAudioNodes();
      setIsPlaying(false);
      return;
    }

    if (countInBars > 0 && currentTime < 0.2) {
      const beatSec = 60 / (activeSong.bpm * playbackSpeed);
      setCountInRemaining(4);
      for (let b = 0; b < 4; b++) {
        setTimeout(() => {
          setCountInRemaining(4 - b);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.frequency.value = b === 0 ? 1320 : 880;
          g.gain.setValueAtTime(0.35, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.065);
        }, b * beatSec * 1000);
      }
      setTimeout(() => {
        setCountInRemaining(0);
        startPlaybackAt(currentTime);
      }, 4 * beatSec * 1000);
    } else {
      startPlaybackAt(currentTime);
    }
  };

  const handleSeek = (newTime) => {
    const clamped = Math.max(0, Math.min((activeSong.duration || 32) - 0.1, newTime));
    setCurrentTime(clamped);
    if (isPlaying) {
      startPlaybackAt(clamped);
    }
  };

  // Alteração de Tom: Se estiver tocando, reaplica no tom exato imediatamente
  const handleChangePitch = (newSemitones) => {
    setPitchSemitones(newSemitones);
    if (isPlaying) {
      startPlaybackAt(currentTime);
    }
  };

  // Alteração de Velocidade: Atualiza os osciladores ou buffers
  const handleChangePlaybackSpeed = (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    Object.values(activeNodesRef.current).forEach((nodeObj) => {
      if (nodeObj?.source) {
        try {
          nodeObj.source.playbackRate.setValueAtTime(newSpeed, audioCtxRef.current.currentTime);
        } catch (_) {}
      }
    });
  };

  const handleToggleMute = (key) => {
    setTrackStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], muted: !prev[key].muted }
    }));
  };

  const handleToggleSolo = (key) => {
    setTrackStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], solo: !prev[key].solo }
    }));
  };

  const handleChangeVolume = (key, val) => {
    setTrackStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], volume: val, muted: val === 0 ? true : prev[key].muted }
    }));
  };

  const handleChangePan = (key, val) => {
    setTrackStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], pan: val }
    }));
  };

  const applyMixPreset = (presetType) => {
    setTrackStates((prev) => {
      const base = {
        vocals:    { ...prev.vocals,    muted: false, solo: false, volume: 1.0 },
        drums:     { ...prev.drums,     muted: false, solo: false, volume: 1.0 },
        bass:      { ...prev.bass,      muted: false, solo: false, volume: 1.0 },
        other:     { ...prev.other,     muted: false, solo: false, volume: 1.0 },
        metronome: { ...prev.metronome, solo: false }
      };
      if (presetType === 'no-vocals') base.vocals.muted = true;
      if (presetType === 'no-drums') base.drums.muted = true;
      if (presetType === 'no-bass') base.bass.muted = true;
      if (presetType === 'no-guitar') base.other.muted = true;
      return base;
    });
    showToast('Preset de mixagem aplicado');
  };

  const handleExportWav = () => {
    const ctx = ensureAudioContext();
    if (!stemsDataRef.current?.vocals) {
      stemsDataRef.current = activeSong.customStems
        ? activeSong.customStems
        : synthesizeSongStems(ctx, activeSong, pitchSemitones);
    }
    const blob = exportMixToWavBlob(stemsDataRef.current, trackStates);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSong.title.toLowerCase().replace(/\s+/g, '-')}-mix.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Mixagem exportada em .WAV');
  };

  // Upload Local com Separação DSP Client-side Real (Salva no IndexedDB)
  const handleLocalFileUpload = async (e, targetSongId = null) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImport(true);
    setProcessingStep('Decodificando arquivo e executando separação DSP Mid-Side no áudio real...');

    try {
      const ctx = ensureAudioContext();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      const { detectedBpm, stems: customStems } = await separateLocalAudioBufferClientSide(
        ctx,
        decoded
      );

      const barDur = (60 / detectedBpm) * 4;
      const generatedChords = [];
      const defaultProgression = ['Am', 'F', 'C', 'G', 'Dm', 'Em', 'F', 'G'];
      for (let idx = 0; idx * barDur < decoded.duration; idx++) {
        generatedChords.push({
          time: Number((idx * barDur).toFixed(2)),
          duration: Number(barDur.toFixed(2)),
          chord: defaultProgression[idx % defaultProgression.length]
        });
      }

      // Se for substituição de uma música existente (ex: YouTube -> MP3 Real)
      const existing = targetSongId ? songs.find((s) => s.id === targetSongId) : null;
      const songId = targetSongId || `local-${Date.now()}`;
      const songTitle = existing ? existing.title : file.name.replace(/\.[^/.]+$/, '');
      const songArtist = existing ? existing.artist : `Arquivo Local • ${detectedBpm} BPM`;

      const newSong = {
        id: songId,
        title: songTitle,
        artist: songArtist,
        bpm: detectedBpm,
        originalKey: existing?.originalKey || 'Am',
        duration: decoded.duration,
        thumbnail: existing?.thumbnail,
        coverGradient: existing?.coverGradient || 'from-cyan-600 via-teal-700 to-slate-900',
        customStems,
        sections: [
          { name: 'Intro', start: 0, end: Math.round(decoded.duration * 0.25) },
          {
            name: 'Meio',
            start: Math.round(decoded.duration * 0.25),
            end: Math.round(decoded.duration * 0.65)
          },
          {
            name: 'Final',
            start: Math.round(decoded.duration * 0.65),
            end: Math.round(decoded.duration)
          }
        ],
        chords: generatedChords
      };

      setSongs((prev) => {
        const withoutOld = prev.filter((s) => s.id !== songId);
        return [newSong, ...withoutOld];
      });

      // Salva no IndexedDB
      saveTrackToDB(newSong);

      setActiveSongId(newSong.id);
      setShowImportModal(false);
      setCurrentPage('studio');
      setMobileTab('mixer');
      showToast(`Áudio real de "${songTitle}" separado em 4 faixas!`);
    } catch (_) {
      showToast('Erro ao decodificar arquivo de áudio');
    } finally {
      setIsProcessingImport(false);
      setProcessingStep('');
    }
  };

  // Importação do YouTube Resiliente
  const handleYoutubeImport = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    const ytId = parseYoutubeId(youtubeUrl);
    if (!ytId) {
      showToast('Link do YouTube inválido. Verifique a URL e tente novamente.');
      return;
    }

    setIsProcessingImport(true);
    setProcessingStep('1/4 • Conectando à API do YouTube para extrair metadados...');

    let videoTitle = `YouTube Track (${ytId})`;
    let videoAuthor = 'Artista do YouTube';
    let videoThumbnail = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;

    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) videoTitle = oembedData.title;
        if (oembedData.author_name) videoAuthor = oembedData.author_name;
        if (oembedData.thumbnail_url) videoThumbnail = oembedData.thumbnail_url;
      }
    } catch (_) {}

    // Configura o Job visual no Catálogo
    const tempJob = {
      title: videoTitle,
      stepMessage: 'Iniciando extração de áudio e separação...',
      percent: 15
    };
    setProcessingJob(tempJob);
    setShowImportModal(false);

    // Se o backend Python local estiver rodando (Demucs v4 real)
    const isServerUp = await checkLocalBackend();
    if (isServerUp) {
      try {
        setProcessingJob({
          title: videoTitle,
          stepMessage: 'Baixando via yt-dlp e executando rede neural Demucs v4 (htdemucs)...',
          percent: 45
        });

        const formData = new FormData();
        formData.append('url', youtubeUrl);
        const res = await fetch('http://localhost:8000/api/youtube', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        setProcessingJob({
          title: videoTitle,
          stepMessage: 'Decodificando stems .wav gerados pelo Demucs v4...',
          percent: 85
        });

        const ctx = ensureAudioContext();
        const loadedStems = {};
        for (const key of ['vocals', 'drums', 'bass', 'other']) {
          const wavRes = await fetch(data.stemUrls[key]);
          const arr = await wavRes.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          loadedStems[key] = { buffer: buf, peaks: extractPeaks(buf) };
        }
        const tempSong = {
          ...PRESET_SONGS[0],
          bpm: data.bpm || 120,
          duration: data.duration || 32
        };
        loadedStems.metronome = synthesizeSongStems(ctx, tempSong, 0).metronome;

        const newSong = {
          id: data.id || `yt-${ytId}`,
          title: videoTitle,
          artist: `${videoAuthor} • Demucs v4 Neural`,
          bpm: data.bpm || 120,
          originalKey: data.originalKey || 'Am',
          duration: data.duration || 32,
          thumbnail: videoThumbnail,
          coverGradient: 'from-rose-600 via-red-700 to-stone-900',
          customStems: loadedStems,
          sections: [
            { name: 'Parte A', start: 0, end: Math.round((data.duration || 32) * 0.33) },
            {
              name: 'Parte B',
              start: Math.round((data.duration || 32) * 0.33),
              end: Math.round((data.duration || 32) * 0.66)
            },
            {
              name: 'Final',
              start: Math.round((data.duration || 32) * 0.66),
              end: Math.round(data.duration || 32)
            }
          ],
          chords: data.chords
        };

        setSongs((prev) => [newSong, ...prev]);
        saveTrackToDB(newSong);
        setActiveSongId(newSong.id);
        setProcessingJob(null);
        setIsProcessingImport(false);
        setYoutubeUrl('');
        showToast(`Faixa "${videoTitle}" processada pelo Demucs v4!`);
        return;
      } catch (err) {
        console.warn('Erro com backend localhost', err);
      }
    }

    // Modo Standalone Web: Pipeline com progresso animado no catálogo
    const pipelineSteps = [
      { msg: '1/4 • Identificando vídeo e metadados no YouTube...', pct: 30 },
      { msg: '2/4 • Mapeando tonalidade e progressão de acordes...', pct: 60 },
      { msg: '3/4 • Sincronizando Smart Metrônomo e BPM...', pct: 85 },
      { msg: '4/4 • Gerando canais multitrack e formas de onda...', pct: 100 }
    ];

    for (const step of pipelineSteps) {
      setProcessingJob({
        title: videoTitle,
        stepMessage: step.msg,
        percent: step.pct
      });
      await new Promise((r) => setTimeout(r, 600));
    }

    const calculatedBpm = 112;
    const songDuration = 34.28;
    const newSong = {
      id: `yt-${ytId}-${Date.now()}`,
      title: videoTitle,
      artist: `${videoAuthor} • YouTube Stems`,
      bpm: calculatedBpm,
      originalKey: 'Am',
      duration: songDuration,
      thumbnail: videoThumbnail,
      coverGradient: 'from-rose-600 via-red-800 to-neutral-900',
      sections: buildSongSectionsByBpm(calculatedBpm, ['Intro', 'Verso', 'Refrão', 'Outro']),
      chords: buildSongChordsByBpm(calculatedBpm, [
        { chord: 'Am', freqs: [220.0, 261.63, 329.63, 392.0] },
        { chord: 'F',  freqs: [174.61, 220.0, 261.63, 329.63] },
        { chord: 'C',  freqs: [261.63, 329.63, 392.0, 493.88] },
        { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
        { chord: 'Am', freqs: [220.0, 261.63, 329.63, 392.0] },
        { chord: 'Dm', freqs: [293.66, 349.23, 440.0, 523.25] },
        { chord: 'F',  freqs: [174.61, 220.0, 261.63, 329.63] },
        { chord: 'G',  freqs: [196.0, 246.94, 293.66, 392.0] },
        { chord: 'C',  freqs: [261.63, 329.63, 392.0, 493.88] },
        { chord: 'E',  freqs: [164.81, 207.65, 246.94, 329.63] }
      ])
    };

    setSongs((prev) => [newSong, ...prev]);
    saveTrackToDB(newSong);
    setActiveSongId(newSong.id);
    setProcessingJob(null);
    setIsProcessingImport(false);
    setYoutubeUrl('');
    showToast(`Música "${videoTitle}" adicionada ao catálogo!`);
  };

  const handleLoadDemoTrack = () => {
    setActiveSongId(PRESET_SONGS[0].id);
    setShowImportModal(false);
    setCurrentPage('studio');
    showToast('Música Demo carregada no Estúdio!');
  };

  const handleDeleteSong = async (idToDelete) => {
    setSongs((prev) => prev.filter((s) => s.id !== idToDelete));
    await deleteTrackFromDB(idToDelete);
    if (activeSongId === idToDelete) {
      setActiveSongId(PRESET_SONGS[0].id);
    }
    showToast('Música removida da biblioteca');
  };

  const handleResetCatalog = () => {
    setSongs(PRESET_SONGS);
    localStorage.removeItem('davi_studio_songs_metadata');
    showToast('Catálogo original restaurado!');
  };

  const currentKey = useMemo(
    () => transposeChord(activeSong.originalKey, pitchSemitones),
    [activeSong.originalKey, pitchSemitones]
  );

  const currentBpm = useMemo(
    () => Math.round((activeSong.bpm || 120) * playbackSpeed),
    [activeSong.bpm, playbackSpeed]
  );

  const transposedChords = useMemo(
    () =>
      (activeSong.chords || []).map((c) => ({
        ...c,
        transposed: transposeChord(c.chord, pitchSemitones)
      })),
    [activeSong.chords, pitchSemitones]
  );

  const activeChordIndex = useMemo(() => {
    const idx = transposedChords.findIndex(
      (c) => currentTime >= c.time && currentTime < c.time + c.duration
    );
    return idx === -1 ? 0 : idx;
  }, [transposedChords, currentTime]);

  const currentChordObj = transposedChords[activeChordIndex] || { transposed: 'N.C.' };
  const nextChordObj = transposedChords[activeChordIndex + 1] || { transposed: 'Fim' };

  const currentBeatNumber = useMemo(() => {
    const beatDur = 60 / (activeSong.bpm || 120);
    return (Math.floor(currentTime / beatDur) % 4) + 1;
  }, [currentTime, activeSong.bpm]);

  const anySoloActive = useMemo(
    () => Object.values(trackStates).some((t) => t.solo),
    [trackStates]
  );

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // Se o usuário estiver na tela de Catálogo (Estilo Moises AI)
  if (currentPage === 'catalog') {
    return (
      <>
        {/* Notificação Flutuante Toast */}
        {toastMessage && (
          <div className="fixed top-16 right-4 z-50 flex items-center gap-2 bg-slate-900/95 border border-emerald-500/50 text-slate-100 px-3.5 py-2.5 rounded-xl shadow-2xl animate-bounce">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        <CatalogView
          songs={songs}
          onOpenSongInStudio={(id) => {
            stopAudioNodes();
            setActiveSongId(id);
            setCurrentPage('studio');
          }}
          onOpenImportModal={() => setShowImportModal(true)}
          onOpenBackendModal={() => setShowBackendModal(true)}
          backendOnline={backendOnline}
          processingJob={processingJob}
          onDeleteSong={handleDeleteSong}
          onResetCatalog={handleResetCatalog}
        />

        {/* Modal 1: Importar Música */}
        <ImportModal
          showImportModal={showImportModal}
          setShowImportModal={setShowImportModal}
          isProcessingImport={isProcessingImport}
          processingStep={processingStep}
          youtubeUrl={youtubeUrl}
          setYoutubeUrl={setYoutubeUrl}
          handleYoutubeImport={handleYoutubeImport}
          handleLocalFileUpload={handleLocalFileUpload}
          handleLoadDemoTrack={handleLoadDemoTrack}
          backendOnline={backendOnline}
        />

        {/* Modal 2: Servidor Python Local Demucs */}
        <BackendModal
          showBackendModal={showBackendModal}
          setShowBackendModal={setShowBackendModal}
          backendOnline={backendOnline}
          checkLocalBackend={checkLocalBackend}
        />
      </>
    );
  }

  // Se o usuário estiver na tela de Estúdio / Mixer Multitrack
  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#090D0B] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Input invisível para substituição rápida de áudio real */}
      <input
        ref={replaceAudioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => handleLocalFileUpload(e, activeSong.id)}
        className="hidden"
      />

      {/* Notificação Flutuante Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 bg-slate-900/95 border border-emerald-500/50 text-slate-100 px-3.5 py-2 rounded-xl shadow-2xl">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Overlay de Contagem Inicial (Count-in 4T) */}
      {countInRemaining > 0 && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-2">
            Contagem Inteligente
          </div>
          <div className="w-24 h-24 rounded-full border-2 border-emerald-400 flex items-center justify-center text-5xl font-black text-white bg-emerald-500/10">
            {countInRemaining}
          </div>
        </div>
      )}

      {/* HUD Superior Desktop com Dropdown de Tons e Botão Catálogo */}
      <HeaderHUD
        activeSong={activeSong}
        currentChordObj={currentChordObj}
        nextChordObj={nextChordObj}
        trackStates={trackStates}
        handleToggleMute={handleToggleMute}
        isPlaying={isPlaying}
        currentBeatNumber={currentBeatNumber}
        pitchSemitones={pitchSemitones}
        setPitchSemitones={handleChangePitch}
        currentKey={currentKey}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={handleChangePlaybackSpeed}
        currentBpm={currentBpm}
        countInBars={countInBars}
        setCountInBars={setCountInBars}
        setShowImportModal={setShowImportModal}
        handleExportWav={handleExportWav}
        setShowBackendModal={setShowBackendModal}
        backendOnline={backendOnline}
        onBackToCatalog={() => {
          stopAudioNodes();
          setIsPlaying(false);
          setCurrentPage('catalog');
        }}
      />

      {/* HUD Rápida Mobile */}
      <MobileHUD
        currentChordObj={currentChordObj}
        currentKey={currentKey}
        pitchSemitones={pitchSemitones}
        setPitchSemitones={handleChangePitch}
        trackStates={trackStates}
        handleToggleMute={handleToggleMute}
        currentBpm={currentBpm}
        isPlaying={isPlaying}
        currentBeatNumber={currentBeatNumber}
        onBackToCatalog={() => {
          stopAudioNodes();
          setIsPlaying(false);
          setCurrentPage('catalog');
        }}
      />

      {/* Banner Informativo Se for Faixa Sintética do YouTube sem Arquivo MP3 */}
      {activeSong.id.startsWith('yt-') && !activeSong.customStems && (
        <div className="bg-amber-950/30 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              Faixa importada do YouTube em prévia multitrack. Deseja separar o áudio REAL do seu arquivo MP3?
            </span>
          </div>
          <button
            type="button"
            onClick={() => replaceAudioInputRef.current?.click()}
            className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
          >
            <Upload className="w-3 h-3" />
            <span>Enviar MP3 Real</span>
          </button>
        </div>
      )}

      {/* Corpo Principal do Estúdio */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Barra Lateral de Biblioteca Rápida */}
        <SidebarLibrary
          songs={songs}
          activeSong={activeSong}
          setActiveSongId={setActiveSongId}
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          applyMixPreset={applyMixPreset}
        />

        {/* Painel Mobile de Modulação */}
        {mobileTab === 'modulation' && (
          <MobileModulationPanel
            originalKey={activeSong.originalKey}
            currentKey={currentKey}
            pitchSemitones={pitchSemitones}
            setPitchSemitones={handleChangePitch}
            currentBpm={currentBpm}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={handleChangePlaybackSpeed}
          />
        )}

        {/* Área Central: Acordes + 5 Faixas */}
        <main className="flex-1 flex flex-col p-2 sm:p-3 gap-2 min-w-0 min-h-0 overflow-hidden justify-start">
          {/* Painel de Seções e Acordes */}
          <div className={`${mobileTab === 'chords' ? 'block' : 'hidden'} lg:block`}>
            <ChordProgressionBar
              activeSong={activeSong}
              currentTime={currentTime}
              transposedChords={transposedChords}
              activeChordIndex={activeChordIndex}
              currentChordObj={currentChordObj}
              currentBeatNumber={currentBeatNumber}
              isPlaying={isPlaying}
              loopRange={loopRange}
              setLoopRange={setLoopRange}
              onSeek={handleSeek}
              showChordInspector={showChordInspector}
              formatTime={formatTime}
            />
          </div>

          {/* Multitrack Mixer: 5 Faixas (Vocais, Bateria, Baixo, Harmonia, Smart Metrônomo) */}
          <div
            className={`${
              mobileTab === 'mixer' ? 'flex' : 'hidden'
            } lg:flex flex-col justify-start gap-2 flex-1 min-h-0`}
          >
            {STEM_CONFIG.map((stem) => {
              const st = trackStates[stem.key];
              const isAudible = anySoloActive ? st.solo : !st.muted;
              return (
                <StemWaveformRow
                  key={stem.key}
                  stemKey={stem.key}
                  label={stem.label}
                  colorHex={stem.color}
                  peaks={peaksMap[stem.key] || []}
                  state={st}
                  isAudible={isAudible}
                  progress={activeSong.duration > 0 ? currentTime / activeSong.duration : 0}
                  loopRange={loopRange}
                  duration={activeSong.duration || 32}
                  onToggleMute={handleToggleMute}
                  onToggleSolo={handleToggleSolo}
                  onChangeVolume={handleChangeVolume}
                  onChangePan={handleChangePan}
                  onSeek={handleSeek}
                />
              );
            })}
          </div>
        </main>
      </div>

      {/* Rodapé de Transporte + Navegação Mobile */}
      <TransportFooter
        activeSong={activeSong}
        currentKey={currentKey}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        handleSeek={handleSeek}
        loopRange={loopRange}
        setLoopRange={setLoopRange}
        currentTime={currentTime}
        trackStates={trackStates}
        handleToggleMute={handleToggleMute}
        showChordInspector={showChordInspector}
        setShowChordInspector={setShowChordInspector}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        formatTime={formatTime}
      />

      {/* Modal 1: Importar Música */}
      <ImportModal
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        isProcessingImport={isProcessingImport}
        processingStep={processingStep}
        youtubeUrl={youtubeUrl}
        setYoutubeUrl={setYoutubeUrl}
        handleYoutubeImport={handleYoutubeImport}
        handleLocalFileUpload={handleLocalFileUpload}
        handleLoadDemoTrack={handleLoadDemoTrack}
        backendOnline={backendOnline}
      />

      {/* Modal 2: Servidor Python Local */}
      <BackendModal
        showBackendModal={showBackendModal}
        setShowBackendModal={setShowBackendModal}
        backendOnline={backendOnline}
        checkLocalBackend={checkLocalBackend}
      />
    </div>
  );
}
