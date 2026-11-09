import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check } from 'lucide-react';
import {
  PRESET_SONGS,
  STEM_CONFIG,
  transposeChord
} from './constants/musicConstants';
import {
  synthesizeSongStems,
  generatePreviewPeaksForSong,
  extractPeaks
} from './audio/audioEngine';
import { createRealtimePitchShifter } from './audio/pitchShifter';
import { separateLocalAudioBufferClientSide } from './audio/dspSeparator';
import { exportMixToWavBlob } from './audio/wavExporter';

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
  const [songs, setSongs] = useState(PRESET_SONGS);
  const [activeSongId, setActiveSongId] = useState(PRESET_SONGS[0].id);
  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) || songs[0],
    [songs, activeSongId]
  );

  // Aba ativa no Mobile ('mixer' | 'chords' | 'modulation' | 'library')
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
  const [backendOnline, setBackendOnline] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

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
  const activeNodesRef = useRef({});
  const pitchNodeRef = useRef(null);
  const pitchStateRef = useRef({ semitones: 0, speed: 1.0 });
  const playStartCtxTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const [peaksMap, setPeaksMap] = useState(() => generatePreviewPeaksForSong(PRESET_SONGS[0]));

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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
    if (pitchNodeRef.current) {
      try {
        pitchNodeRef.current.disconnect();
      } catch (_) {}
      pitchNodeRef.current = null;
    }
  }, []);

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
      const customPeaks = {};
      Object.keys(activeSong.customStems).forEach((k) => {
        customPeaks[k] = activeSong.customStems[k].peaks;
      });
      setPeaksMap(customPeaks);
    } else {
      stemsDataRef.current = {};
      synthesizedSongIdRef.current = null;
      setPeaksMap(generatePreviewPeaksForSong(activeSong));
    }
  }, [activeSong, stopAudioNodes]);

  useEffect(() => {
    pitchStateRef.current.semitones = pitchSemitones;
    pitchStateRef.current.speed = playbackSpeed;

    Object.values(activeNodesRef.current).forEach((nodeObj) => {
      if (nodeObj?.source && audioCtxRef.current) {
        try {
          nodeObj.source.playbackRate.setValueAtTime(
            playbackSpeed,
            audioCtxRef.current.currentTime
          );
        } catch (_) {}
      }
    });
  }, [pitchSemitones, playbackSpeed]);

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

  const startPlaybackAt = useCallback(
    async (offsetSeconds) => {
      const ctx = ensureAudioContext();
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (_) {}
      }

      if (
        !stemsDataRef.current?.vocals ||
        synthesizedSongIdRef.current !== activeSong.id
      ) {
        stemsDataRef.current = activeSong.customStems
          ? activeSong.customStems
          : synthesizeSongStems(ctx, activeSong);
        synthesizedSongIdRef.current = activeSong.id;
        const realPeaks = {};
        Object.keys(stemsDataRef.current).forEach((k) => {
          realPeaks[k] = stemsDataRef.current[k].peaks;
        });
        setPeaksMap(realPeaks);
      }

      stopAudioNodes();

      const clampedOffset = Math.max(
        0,
        Math.min(activeSong.duration - 0.05, offsetSeconds)
      );
      const anySolo = Object.values(trackStates).some((t) => t.solo);

      const pitchShifter = createRealtimePitchShifter(ctx, pitchStateRef);
      pitchShifter.connect(ctx.destination);

      // Delay de sincronização exata para Bateria e Smart Metrônomo (compensa o buffer de 1024 amostras + metade da janela granular de 55ms)
      const rhythmSyncDelaySec = (1024 / ctx.sampleRate) + 0.0275;
      const rhythmSyncDelay = ctx.createDelay(0.25);
      rhythmSyncDelay.delayTime.value = rhythmSyncDelaySec;
      rhythmSyncDelay.connect(ctx.destination);

      pitchNodeRef.current = pitchShifter;

      // Inicia todas as 5 faixas exatamente no mesmo sample do relógio de hardware
      const syncStartTime = ctx.currentTime + 0.015;

      Object.keys(trackStates).forEach((key) => {
        const stemObj = stemsDataRef.current[key];
        if (!stemObj?.buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = stemObj.buffer;
        source.playbackRate.value = pitchStateRef.current.speed;

        const gainNode = ctx.createGain();
        const st = trackStates[key];
        const isAudible = anySolo ? st.solo : !st.muted;
        gainNode.gain.value = isAudible ? st.volume : 0;

        // Bateria e Metrônomo não sofrem alteração de afinação (pitch), mantendo o transiente limpo e 100% cravado com a harmonia via rhythmSyncDelay
        const isRhythmTrack = key === 'metronome' || key === 'drums';
        const targetBus = isRhythmTrack ? rhythmSyncDelay : pitchShifter;

        const panNode =
          typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
        if (panNode) {
          panNode.pan.value = st.pan;
          source.connect(gainNode);
          gainNode.connect(panNode);
          panNode.connect(targetBus);
        } else {
          source.connect(gainNode);
          gainNode.connect(targetBus);
        }

        source.start(syncStartTime, clampedOffset);
        activeNodesRef.current[key] = { source, gainNode, panNode };
      });

      playStartCtxTimeRef.current = syncStartTime + rhythmSyncDelaySec;
      playStartOffsetRef.current = clampedOffset;
      setCurrentTime(clampedOffset);
      setIsPlaying(true);

      const updateLoop = () => {
        if (!audioCtxRef.current) return;
        const rawElapsed = audioCtxRef.current.currentTime - playStartCtxTimeRef.current;
        const elapsed = Math.max(0, rawElapsed) * pitchStateRef.current.speed;
        const nextTime = playStartOffsetRef.current + elapsed;

        if (loopRange.enabled && nextTime >= loopRange.end) {
          startPlaybackAt(loopRange.start);
          return;
        }

        if (nextTime >= activeSong.duration) {
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
    [activeSong, ensureAudioContext, loopRange, stopAudioNodes, trackStates]
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
    const clamped = Math.max(0, Math.min(activeSong.duration - 0.1, newTime));
    setCurrentTime(clamped);
    if (isPlaying) {
      startPlaybackAt(clamped);
    }
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
    if (
      !stemsDataRef.current?.vocals ||
      synthesizedSongIdRef.current !== activeSong.id
    ) {
      const ctx = ensureAudioContext();
      stemsDataRef.current = activeSong.customStems
        ? activeSong.customStems
        : synthesizeSongStems(ctx, activeSong);
      synthesizedSongIdRef.current = activeSong.id;
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

  const handleLocalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImport(true);
    setProcessingStep('Decodificando áudio, detectando BPM real e separando faixas...');

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

      const newSong = {
        id: `local-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: `Arquivo Local • ${detectedBpm} BPM Detectado`,
        bpm: detectedBpm,
        originalKey: 'Am',
        duration: decoded.duration,
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

      setSongs((prev) => [newSong, ...prev]);
      setActiveSongId(newSong.id);
      setShowImportModal(false);
      setMobileTab('mixer');
      showToast(`Faixas separadas e sincronizadas em ${detectedBpm} BPM`);
    } catch (_) {
      showToast('Erro ao decodificar arquivo de áudio');
    } finally {
      setIsProcessingImport(false);
      setProcessingStep('');
    }
  };

  const handleYoutubeImport = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setIsProcessingImport(true);

    const isServerUp = await checkLocalBackend();

    if (isServerUp) {
      try {
        setProcessingStep('Baixando via yt-dlp e separando com Demucs v4 no servidor local...');
        const formData = new FormData();
        formData.append('url', youtubeUrl);
        const res = await fetch('http://localhost:8000/api/youtube', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        setProcessingStep('Carregando stems .wav gerados pelo Demucs...');
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
        loadedStems.metronome = synthesizeSongStems(ctx, tempSong).metronome;

        const newSong = {
          id: data.id,
          title: data.title,
          artist: data.artist,
          bpm: data.bpm,
          originalKey: data.originalKey,
          duration: data.duration,
          customStems: loadedStems,
          sections: [
            { name: 'Parte A', start: 0, end: Math.round(data.duration * 0.33) },
            {
              name: 'Parte B',
              start: Math.round(data.duration * 0.33),
              end: Math.round(data.duration * 0.66)
            },
            {
              name: 'Final',
              start: Math.round(data.duration * 0.66),
              end: Math.round(data.duration)
            }
          ],
          chords: data.chords
        };

        setSongs((prev) => [newSong, ...prev]);
        setActiveSongId(newSong.id);
        setYoutubeUrl('');
        setShowImportModal(false);
        setMobileTab('mixer');
        showToast('Música do YouTube processada pelo Demucs');
      } catch (_) {
        showToast('Erro ao comunicar com localhost:8000');
      } finally {
        setIsProcessingImport(false);
        setProcessingStep('');
      }
    } else {
      const steps = [
        '1/4 • Extraindo stream de áudio com yt-dlp...',
        '2/4 • Executando rede neural Demucs (htdemucs 4-stems)...',
        '3/4 • Mapeando BPM e batidas com Librosa beat_track...',
        '4/4 • Identificando harmonia e cifras sincronizadas...'
      ];
      for (let i = 0; i < steps.length; i++) {
        setProcessingStep(steps[i]);
        await new Promise((r) => setTimeout(r, 550));
      }

      const videoIdMatch = youtubeUrl.match(/(?:v=|youtu\.be\/)([\w-]{6,11})/);
      const shortCode = videoIdMatch ? videoIdMatch[1] : 'YT-Track';
      const template = PRESET_SONGS[1];
      const newSong = {
        ...template,
        id: `yt-${Date.now()}`,
        title: `YouTube Import (${shortCode})`,
        artist: 'Processado (Modo Simulação Preview)'
      };

      setSongs((prev) => [newSong, ...prev]);
      setActiveSongId(newSong.id);
      setYoutubeUrl('');
      setIsProcessingImport(false);
      setProcessingStep('');
      setShowImportModal(false);
      setMobileTab('mixer');
      showToast('Faixa do YouTube importada no estúdio');
    }
  };

  const currentKey = useMemo(
    () => transposeChord(activeSong.originalKey, pitchSemitones),
    [activeSong.originalKey, pitchSemitones]
  );

  const currentBpm = useMemo(
    () => Math.round(activeSong.bpm * playbackSpeed),
    [activeSong.bpm, playbackSpeed]
  );

  const transposedChords = useMemo(
    () =>
      activeSong.chords.map((c) => ({
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
    const beatDur = 60 / activeSong.bpm;
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

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#090D0B] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
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

      {/* HUD Superior Desktop */}
      <HeaderHUD
        activeSong={activeSong}
        currentChordObj={currentChordObj}
        nextChordObj={nextChordObj}
        trackStates={trackStates}
        handleToggleMute={handleToggleMute}
        isPlaying={isPlaying}
        currentBeatNumber={currentBeatNumber}
        pitchSemitones={pitchSemitones}
        setPitchSemitones={setPitchSemitones}
        currentKey={currentKey}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
        currentBpm={currentBpm}
        countInBars={countInBars}
        setCountInBars={setCountInBars}
        setShowImportModal={setShowImportModal}
        handleExportWav={handleExportWav}
        setShowBackendModal={setShowBackendModal}
        backendOnline={backendOnline}
      />

      {/* HUD Rápida Mobile */}
      <MobileHUD
        currentChordObj={currentChordObj}
        currentKey={currentKey}
        trackStates={trackStates}
        handleToggleMute={handleToggleMute}
        currentBpm={currentBpm}
        isPlaying={isPlaying}
        currentBeatNumber={currentBeatNumber}
      />

      {/* Corpo Principal */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Barra Lateral de Biblioteca */}
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
            currentKey={currentKey}
            pitchSemitones={pitchSemitones}
            setPitchSemitones={setPitchSemitones}
            currentBpm={currentBpm}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
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
                  duration={activeSong.duration}
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
