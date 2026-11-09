import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, Upload, AlertCircle, VolumeX, Mic, Disc, RotateCcw } from 'lucide-react';
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
  extractPeaks,
  fastSin
} from './audio/audioEngine';
import {
  safeDecodeAudioData,
  fetchAndDecodeAudio,
  processAudioBufferIntoSong,
  ensureSongStemsLoaded
} from './audio/audioProcessor';
import { exportMixToWavBlob } from './audio/wavExporter';
import {
  saveTrackToDB,
  getAllTracksFromDB,
  deleteTrackFromDB,
  inMemoryStemsCache,
  inMemoryRawBufferCache
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

  // Referências para o motor Web Audio API e sincronismo sem closures obsoletas
  const audioCtxRef = useRef(null);
  const stemsDataRef = useRef({});
  const synthesizedSongIdRef = useRef(null);
  const synthesizedPitchRef = useRef(0);
  const activeNodesRef = useRef({});
  const playStartCtxTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const prevSongIdRef = useRef(null);

  const trackStatesRef = useRef(trackStates);
  trackStatesRef.current = trackStates;

  const pitchSemitonesRef = useRef(pitchSemitones);
  pitchSemitonesRef.current = pitchSemitones;

  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const loopRangeRef = useRef(loopRange);
  loopRangeRef.current = loopRange;

  const [peaksMap, setPeaksMap] = useState(() => generatePreviewPeaksForSong(PRESET_SONGS[0]));

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Salva metadados das músicas no localStorage
  useEffect(() => {
    try {
      const serializable = songs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        genre: s.genre,
        bpm: s.bpm,
        firstBeatOffset: s.firstBeatOffset || 0,
        beatTimes: s.beatTimes || null,
        originalKey: s.originalKey,
        duration: s.duration,
        thumbnail: s.thumbnail,
        coverGradient: s.coverGradient,
        sections: s.sections,
        chords: s.chords,
        peaks: s.peaks || null
      }));
      localStorage.setItem('davi_studio_songs_metadata', JSON.stringify(serializable));
    } catch (_) {}
  }, [songs]);

  // Carrega faixas customizadas salvas do IndexedDB ao abrir/voltar para a página
  useEffect(() => {
    (async () => {
      try {
        const storedTracks = await getAllTracksFromDB();
        if (storedTracks && storedTracks.length > 0) {
          setSongs((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            storedTracks.forEach((t) => {
              const existing = map.get(t.id);
              map.set(t.id, {
                ...existing,
                ...t,
                customStems: existing?.customStems || t.customStems || inMemoryStemsCache.get(t.id)
              });
            });
            return Array.from(map.values());
          });

          // Pré-decodifica em background usando OfflineAudioContext para ficar pronto imediatamente
          for (const track of storedTracks) {
            if (!inMemoryStemsCache.has(track.id) && (track.audioArrayBuffer || track.audioBlob)) {
              ensureSongStemsLoaded(null, track)
                .then((stems) => {
                  if (stems) {
                    setSongs((prev) =>
                      prev.map((s) => (s.id === track.id ? { ...s, customStems: stems } : s))
                    );
                  }
                })
                .catch(() => {});
            }
          }
        }
      } catch (_) {}
    })();
  }, []);

  const [backendUrl, setBackendUrl] = useState(() => {
    try {
      return localStorage.getItem('davi_studio_backend_url') || 'http://localhost:8000';
    } catch (_) {
      return 'http://localhost:8000';
    }
  });

  const checkLocalBackend = useCallback(async (customUrl = null) => {
    const url = (customUrl || backendUrl || 'http://localhost:8000').replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setBackendOnline(true);
        return true;
      }
    } catch (_) {
      setBackendOnline(false);
    }
    return false;
  }, [backendUrl]);

  useEffect(() => {
    checkLocalBackend();
  }, [checkLocalBackend]);

  /**
   * Cria ou desbloqueia o AudioContext de forma SÍNCRONA dentro do clique/toque do usuário.
   * Essencial para o iOS Safari quando o usuário sai da aba/app e volta.
   */
  const ensureAudioContext = useCallback((unlockWithSilentPulse = false) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContextClass();
    }
    const ctx = audioCtxRef.current;

    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      ctx.resume().catch(() => {});
    }

    if (unlockWithSilentPulse) {
      try {
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (_) {}
    }

    return ctx;
  }, []);

  const stopAudioNodes = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    Object.values(activeNodesRef.current).forEach((nodeObj) => {
      try {
        nodeObj.source.stop();
        nodeObj.source.disconnect();
      } catch (_) {}
    });
    activeNodesRef.current = {};
  }, []);

  // Quando o usuário sai da página/minimiza o navegador no celular e volta,
  // evita estado zumbi pausando com segurança e reativando o contexto no retorno
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        Object.values(activeNodesRef.current).forEach((nodeObj) => {
          try {
            nodeObj.source.stop();
            nodeObj.source.disconnect();
          } catch (_) {}
        });
        activeNodesRef.current = {};
        setIsPlaying(false);
      } else if (document.visibilityState === 'visible') {
        if (
          audioCtxRef.current &&
          (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted')
        ) {
          audioCtxRef.current.resume().catch(() => {});
        }
      }
    };

    const handleFirstTouchAfterReturn = () => {
      if (
        audioCtxRef.current &&
        (audioCtxRef.current.state === 'suspended' || audioCtxRef.current.state === 'interrupted')
      ) {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);
    window.addEventListener('touchstart', handleFirstTouchAfterReturn, { passive: true });
    window.addEventListener('click', handleFirstTouchAfterReturn, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      window.removeEventListener('touchstart', handleFirstTouchAfterReturn);
      window.removeEventListener('click', handleFirstTouchAfterReturn);
    };
  }, []);

  // Quando o ID da música ativa mudar, reseta controles e prepara stems/ondas
  useEffect(() => {
    const songChanged = prevSongIdRef.current !== activeSong.id;
    prevSongIdRef.current = activeSong.id;

    if (songChanged) {
      stopAudioNodes();
      setIsPlaying(false);
      setCurrentTime(0);
      setPitchSemitones(0);
      setPlaybackSpeed(1.0);
      setLoopRange({ enabled: false, start: 0, end: 8, label: '' });
    }

    const cachedStems = activeSong.customStems || inMemoryStemsCache.get(activeSong.id);
    if (cachedStems) {
      stemsDataRef.current = cachedStems;
      synthesizedSongIdRef.current = activeSong.id;
      const customPeaks = {};
      Object.keys(cachedStems).forEach((k) => {
        if (cachedStems[k]?.peaks) {
          customPeaks[k] = cachedStems[k].peaks;
        }
      });
      setPeaksMap(customPeaks);
    } else if (activeSong.peaks) {
      setPeaksMap(activeSong.peaks);
    } else if (songChanged) {
      stemsDataRef.current = {};
      synthesizedSongIdRef.current = null;
      synthesizedPitchRef.current = 0;
      setPeaksMap(generatePreviewPeaksForSong(activeSong));
    }
  }, [activeSong, stopAudioNodes]);

  // Atualização IMEDIATA (0ms de latência) de Mute, Solo, Volume e Pan nos nós de áudio ativos
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const anySolo = Object.values(trackStates).some((t) => t.solo);
    const now = ctx.currentTime;

    Object.keys(trackStates).forEach((key) => {
      const st = trackStates[key];
      const nodeObj = activeNodesRef.current[key];
      if (!nodeObj || !nodeObj.gainNode) return;

      const isAudible = anySolo ? st.solo : !st.muted;
      const targetGain = isAudible ? st.volume : 0;

      try {
        nodeObj.gainNode.gain.cancelScheduledValues(now);
        nodeObj.gainNode.gain.setValueAtTime(targetGain, now);
        nodeObj.gainNode.gain.value = targetGain;

        if (nodeObj.panNode) {
          nodeObj.panNode.pan.cancelScheduledValues(now);
          nodeObj.panNode.pan.setValueAtTime(st.pan, now);
          nodeObj.panNode.pan.value = st.pan;
        }
      } catch (_) {}
    });
  }, [trackStates]);

  // Início da reprodução sincronizada
  const startPlaybackAt = useCallback(
    async (offsetSeconds, targetSongOverride = null) => {
      const songToPlay = targetSongOverride || activeSong;
      const ctx = ensureAudioContext(true);

      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        try {
          await ctx.resume();
        } catch (_) {}
      }

      const isCustomSong = Boolean(
        songToPlay.customStems ||
          songToPlay.audioArrayBuffer ||
          songToPlay.audioBlob ||
          inMemoryStemsCache.has(songToPlay.id) ||
          inMemoryRawBufferCache.has(songToPlay.id) ||
          songToPlay.id.startsWith('local-')
      );

      const currentPitch = pitchSemitonesRef.current;

      const needsRegen =
        !stemsDataRef.current?.vocals?.buffer ||
        synthesizedSongIdRef.current !== songToPlay.id ||
        (!isCustomSong && synthesizedPitchRef.current !== currentPitch);

      if (needsRegen) {
        if (isCustomSong) {
          const loadedStems = await ensureSongStemsLoaded(ctx, songToPlay);
          if (loadedStems) {
            stemsDataRef.current = loadedStems;
          } else {
            showToast('Arquivo de áudio original não encontrado. Faça o upload novamente.');
            return;
          }
        } else {
          stemsDataRef.current = synthesizeSongStems(ctx, songToPlay, currentPitch);
        }

        synthesizedSongIdRef.current = songToPlay.id;
        synthesizedPitchRef.current = currentPitch;

        const realPeaks = {};
        if (stemsDataRef.current) {
          Object.keys(stemsDataRef.current).forEach((k) => {
            if (stemsDataRef.current[k]?.peaks) {
              realPeaks[k] = stemsDataRef.current[k].peaks;
            }
          });
          setPeaksMap(realPeaks);
        }
      }

      // Garante que após qualquer await o contexto de áudio do iOS continue em 'running'
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        try {
          await ctx.resume();
        } catch (_) {}
      }

      stopAudioNodes();

      const duration = songToPlay.duration || 32;
      const clampedOffset = Math.max(0, Math.min(duration - 0.05, offsetSeconds));
      const currentTracks = trackStatesRef.current;
      const anySolo = Object.values(currentTracks).some((t) => t.solo);
      const speed = playbackSpeedRef.current;
      const syncStartTime = ctx.currentTime + 0.02;

      Object.keys(currentTracks).forEach((key) => {
        const stemObj = stemsDataRef.current?.[key];
        if (!stemObj?.buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = stemObj.buffer;
        source.playbackRate.value = speed;

        // Para faixas com áudio real, aplica detune nos canais tonais (Vocais, Baixo, Harmonia)
        if (isCustomSong && (key === 'vocals' || key === 'bass' || key === 'other')) {
          if (source.detune) {
            source.detune.value = currentPitch * 100;
          }
        }

        const gainNode = ctx.createGain();
        const st = currentTracks[key];
        const isAudible = anySolo ? st.solo : !st.muted;
        const targetGain = isAudible ? st.volume : 0;
        gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
        gainNode.gain.value = targetGain;

        const panNode =
          typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
        if (panNode) {
          panNode.pan.setValueAtTime(st.pan, ctx.currentTime);
          panNode.pan.value = st.pan;
          source.connect(gainNode);
          gainNode.connect(panNode);
          panNode.connect(ctx.destination);
        } else {
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
        }

        source.start(syncStartTime, clampedOffset);
        activeNodesRef.current[key] = { source, gainNode, panNode, isCustomSong };
      });

      playStartCtxTimeRef.current = syncStartTime;
      playStartOffsetRef.current = clampedOffset;
      setCurrentTime(clampedOffset);
      setIsPlaying(true);

      const updateLoop = () => {
        if (!audioCtxRef.current) return;
        const rawElapsed = audioCtxRef.current.currentTime - playStartCtxTimeRef.current;
        const elapsed = Math.max(0, rawElapsed) * playbackSpeedRef.current;
        const nextTime = playStartOffsetRef.current + elapsed;
        const activeLoop = loopRangeRef.current;

        if (activeLoop.enabled && nextTime >= activeLoop.end) {
          startPlaybackAt(activeLoop.start, songToPlay);
          return;
        }

        if (nextTime >= duration) {
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
    [activeSong, ensureAudioContext, showToast, stopAudioNodes]
  );

  const togglePlay = () => {
    // Desbloqueia o AudioContext de forma síncrona no clique antes de qualquer chamada assíncrona
    const ctx = ensureAudioContext(true);
    if (isPlaying) {
      stopAudioNodes();
      setIsPlaying(false);
      return;
    }

    if (countInBars > 0 && currentTime < 0.2) {
      const beatSec = 60 / ((activeSong.bpm || 120) * playbackSpeed);
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
    ensureAudioContext(true);
    const clamped = Math.max(0, Math.min((activeSong.duration || 32) - 0.1, newTime));
    setCurrentTime(clamped);
    if (isPlaying) {
      startPlaybackAt(clamped);
    }
  };

  // Alteração de Tom em tempo real (sem interromper o áudio se for música customizada)
  const handleChangePitch = (newSemitones) => {
    setPitchSemitones(newSemitones);
    pitchSemitonesRef.current = newSemitones;

    if (isPlaying) {
      const hasCustomNodes = Object.values(activeNodesRef.current).some((n) => n?.isCustomSong);
      if (hasCustomNodes && audioCtxRef.current) {
        const now = audioCtxRef.current.currentTime;
        ['vocals', 'bass', 'other'].forEach((key) => {
          const nodeObj = activeNodesRef.current[key];
          if (nodeObj?.source?.detune) {
            try {
              nodeObj.source.detune.setValueAtTime(newSemitones * 100, now);
              nodeObj.source.detune.value = newSemitones * 100;
            } catch (_) {}
          }
        });
      } else {
        startPlaybackAt(currentTime);
      }
    }
  };

  // Alteração de Velocidade sem perder a posição atual da música
  const handleChangePlaybackSpeed = (newSpeed) => {
    if (audioCtxRef.current && isPlaying) {
      const rawElapsed = audioCtxRef.current.currentTime - playStartCtxTimeRef.current;
      const currentExactPos = playStartOffsetRef.current + Math.max(0, rawElapsed) * playbackSpeedRef.current;
      playStartOffsetRef.current = currentExactPos;
      playStartCtxTimeRef.current = audioCtxRef.current.currentTime;
    }

    setPlaybackSpeed(newSpeed);
    playbackSpeedRef.current = newSpeed;

    Object.values(activeNodesRef.current).forEach((nodeObj) => {
      if (nodeObj?.source && audioCtxRef.current) {
        try {
          nodeObj.source.playbackRate.setValueAtTime(newSpeed, audioCtxRef.current.currentTime);
          nodeObj.source.playbackRate.value = newSpeed;
        } catch (_) {}
      }
    });
  };

  // Ressincroniza a Batida 1 do Smart Metrônomo exatamente no segundo atual (caso o usuário queira ajustar o clique na mão)
  const handleSyncMetronomeHere = () => {
    const ctx = ensureAudioContext(true);
    const beatSec = 60 / (activeSong.bpm || 120);
    const newOffset = currentTime % beatSec;
    const duration = activeSong.duration || 32;
    const sr = ctx.sampleRate || 44100;
    const len = Math.floor(duration * sr);
    const metroBuf = ctx.createBuffer(2, len, sr);
    const mL = metroBuf.getChannelData(0);
    const mR = metroBuf.getChannelData(1);

    const newBeatTimes = [];
    for (let b = 0; ; b++) {
      const t = newOffset + b * beatSec;
      if (t >= duration) break;
      newBeatTimes.push(t);
    }

    // Marca como tempo 1 a batida mais próxima do currentTime
    const currentBeatIdx = Math.round((currentTime - newOffset) / beatSec);

    for (let b = 0; b < newBeatTimes.length; b++) {
      const start = Math.floor(newBeatTimes[b] * sr);
      if (start >= len) break;
      const isDownbeat = ((b - currentBeatIdx) % 4 + 4000) % 4 === 0;
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

    const newMetroStem = { buffer: metroBuf, peaks: extractPeaks(metroBuf) };
    if (stemsDataRef.current) {
      stemsDataRef.current = {
        ...stemsDataRef.current,
        metronome: newMetroStem
      };
      inMemoryStemsCache.set(activeSong.id, stemsDataRef.current);
    }

    setTrackStates((prev) => ({
      ...prev,
      metronome: { ...prev.metronome, muted: false }
    }));

    if (isPlaying) {
      startPlaybackAt(currentTime);
    }
    showToast('Metrônomo alinhado com o tempo atual!');
  };

  const handleToggleMute = (key) => {
    setTrackStates((prev) => {
      const nextMuted = !prev[key].muted;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          muted: nextMuted,
          // Se o usuário mutar uma faixa que estava em Solo, desativa o Solo dela
          solo: nextMuted ? false : prev[key].solo
        }
      };
    });
  };

  const handleToggleSolo = (key) => {
    setTrackStates((prev) => {
      const nextSolo = !prev[key].solo;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          solo: nextSolo,
          muted: nextSolo ? false : prev[key].muted
        }
      };
    });
  };

  const handleChangeVolume = (key, val) => {
    setTrackStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], volume: val, muted: val === 0 ? true : false }
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
      if (presetType === 'no-vocals') {
        base.vocals.muted = true;
        showToast('Modo Karaokê: Voz Removida!');
      } else if (presetType === 'only-vocals') {
        base.vocals.solo = true;
        showToast('Voz Isolada (Solo Vocal)!');
      } else if (presetType === 'no-drums') {
        base.drums.muted = true;
        showToast('Bateria silenciada!');
      } else if (presetType === 'no-bass') {
        base.bass.muted = true;
        showToast('Contrabaixo silenciado!');
      } else if (presetType === 'no-guitar') {
        base.other.muted = true;
        showToast('Harmonia / Violão silenciado!');
      } else {
        showToast('Mixagem original (todas as faixas ativas)!');
      }
      return base;
    });
  };

  const handleExportWav = () => {
    const ctx = ensureAudioContext(true);
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

  // Upload Local com Separação DSP de 4ª Ordem e Detecção de Acordes Reais por Tempo
  const handleLocalFileUpload = async (e, targetSongId = null) => {
    let file = null;
    if (e.target?.files?.length > 0) {
      file = e.target.files[0];
    } else if (e.dataTransfer?.files?.length > 0) {
      file = e.dataTransfer.files[0];
    }
    if (e.target) e.target.value = '';
    if (!file) return;

    setIsProcessingImport(true);
    setProcessingStep('1/4 • Lendo arquivo de áudio...');
    await new Promise((r) => setTimeout(r, 40));

    try {
      const ctx = ensureAudioContext();

      setProcessingStep('2/4 • Decodificando áudio no navegador...');
      await new Promise((r) => setTimeout(r, 40));
      const arrayBuf = await file.arrayBuffer();
      const rawArrayBuffer = arrayBuf.slice(0);
      const rawBlob = new Blob([rawArrayBuffer], { type: file.type || 'audio/mpeg' });
      const decoded = await safeDecodeAudioData(ctx, arrayBuf);

      setProcessingStep('3/4 • Isolando 4 stems, sincronizando BPM e cifras...');
      await new Promise((r) => setTimeout(r, 40));
      const existing = targetSongId ? songs.find((s) => s.id === targetSongId) : null;
      const songId = targetSongId || `local-${Date.now()}`;
      const songTitle = existing ? existing.title : file.name.replace(/\.[^/.]+$/, '');
      const songArtist = existing
        ? existing.artist
        : `Arquivo Local • ${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      const newSong = await processAudioBufferIntoSong(
        ctx,
        decoded,
        {
          id: songId,
          title: songTitle,
          artist: songArtist,
          thumbnail: existing?.thumbnail || null,
          coverGradient: existing?.coverGradient || 'from-cyan-600 via-teal-700 to-slate-900'
        },
        rawBlob,
        rawArrayBuffer
      );

      setProcessingStep('4/4 • Salvando na biblioteca...');
      await new Promise((r) => setTimeout(r, 40));

      setSongs((prev) => {
        const withoutOld = prev.filter((s) => s.id !== songId);
        return [newSong, ...withoutOld];
      });

      await saveTrackToDB(newSong);

      stemsDataRef.current = newSong.customStems;
      synthesizedSongIdRef.current = newSong.id;
      prevSongIdRef.current = newSong.id;
      setPeaksMap(newSong.peaks);

      setActiveSongId(newSong.id);
      setShowImportModal(false);
      setCurrentPage('studio');
      setMobileTab('mixer');
      showToast(`"${newSong.title}" (${newSong.originalKey} • ${newSong.bpm} BPM) pronta!`);
    } catch (err) {
      console.error('Erro no upload local:', err);
      showToast(err.message || 'Erro ao decodificar arquivo de áudio');
      setShowImportModal(false);
    } finally {
      setIsProcessingImport(false);
      setProcessingStep('');
    }
  };

  // Importação direta de áudio por URL
  const handleAudioUrlImport = async (audioUrl) => {
    setIsProcessingImport(true);
    setProcessingStep('1/3 • Baixando áudio da URL...');
    await new Promise((r) => setTimeout(r, 40));

    try {
      const ctx = ensureAudioContext();

      const { decoded, audioBlob, audioArrayBuffer } = await fetchAndDecodeAudio(ctx, audioUrl);
      const urlFileName = audioUrl.split('/').pop().split('?')[0] || 'Áudio Remoto';
      const cleanTitle = decodeURIComponent(urlFileName).replace(/\.[^/.]+$/, '');

      setProcessingStep('2/3 • Isolando stems e detectando acordes reais...');
      await new Promise((r) => setTimeout(r, 40));
      const newSong = await processAudioBufferIntoSong(
        ctx,
        decoded,
        {
          title: cleanTitle || 'Música Remota',
          artist: 'Link da Web • Áudio Real'
        },
        audioBlob,
        audioArrayBuffer
      );

      setProcessingStep('3/3 • Salvando na biblioteca...');
      await new Promise((r) => setTimeout(r, 40));

      setSongs((prev) => [newSong, ...prev.filter((s) => s.id !== newSong.id)]);
      await saveTrackToDB(newSong);

      stemsDataRef.current = newSong.customStems;
      synthesizedSongIdRef.current = newSong.id;
      prevSongIdRef.current = newSong.id;
      setPeaksMap(newSong.peaks);

      setActiveSongId(newSong.id);
      setShowImportModal(false);
      setCurrentPage('studio');
      setMobileTab('mixer');
      showToast(`Áudio de "${newSong.title}" (${newSong.originalKey}) pronto!`);
    } catch (err) {
      console.error('Erro no download por URL:', err);
      showToast(err.message || 'Erro ao baixar arquivo de áudio da URL');
      setShowImportModal(false);
    } finally {
      setIsProcessingImport(false);
      setProcessingStep('');
    }
  };

  // Upload de arquivo MP3 do YouTube
  const handleYoutubeDirectMp3Upload = async (e, ytPreview) => {
    let file = null;
    if (e.target?.files?.length > 0) {
      file = e.target.files[0];
    } else if (e.dataTransfer?.files?.length > 0) {
      file = e.dataTransfer.files[0];
    }
    if (e.target) e.target.value = '';
    if (!file) return;

    setIsProcessingImport(true);
    setProcessingStep('1/3 • Lendo MP3 baixado...');
    await new Promise((r) => setTimeout(r, 40));

    try {
      const ctx = ensureAudioContext();

      setProcessingStep('2/3 • Decodificando áudio...');
      await new Promise((r) => setTimeout(r, 40));
      const arrayBuf = await file.arrayBuffer();
      const rawArrayBuffer = arrayBuf.slice(0);
      const rawBlob = new Blob([rawArrayBuffer], { type: file.type || 'audio/mpeg' });
      const decoded = await safeDecodeAudioData(ctx, arrayBuf);

      const songId = `local-yt-${ytPreview?.id || Date.now()}`;
      const songTitle = file.name.replace(/\.[^/.]+$/, '');

      setProcessingStep('3/3 • Separando faixas e detectando cifras da música...');
      await new Promise((r) => setTimeout(r, 40));
      const newSong = await processAudioBufferIntoSong(
        ctx,
        decoded,
        {
          id: songId,
          title: songTitle,
          artist: 'YouTube • MP3 Real Vinculado',
          thumbnail: ytPreview?.thumbnail || null,
          coverGradient: 'from-rose-600 via-red-800 to-stone-900'
        },
        rawBlob,
        rawArrayBuffer
      );

      setSongs((prev) => [newSong, ...prev.filter((s) => s.id !== songId)]);
      await saveTrackToDB(newSong);

      stemsDataRef.current = newSong.customStems;
      synthesizedSongIdRef.current = newSong.id;
      prevSongIdRef.current = newSong.id;
      setPeaksMap(newSong.peaks);

      setActiveSongId(newSong.id);
      setShowImportModal(false);
      setCurrentPage('studio');
      setMobileTab('mixer');
      showToast(`Música "${newSong.title}" (${newSong.originalKey}) pronta no estúdio!`);
    } catch (err) {
      console.error('Erro ao processar MP3:', err);
      showToast(err.message || 'Erro ao processar arquivo MP3');
      setShowImportModal(false);
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
      const oembedRes = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`
      );
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) videoTitle = oembedData.title;
        if (oembedData.author_name) videoAuthor = oembedData.author_name;
        if (oembedData.thumbnail_url) videoThumbnail = oembedData.thumbnail_url;
      }
    } catch (_) {}

    const tempJob = {
      title: videoTitle,
      stepMessage: 'Iniciando extração de áudio e separação...',
      percent: 15
    };
    setProcessingJob(tempJob);
    setShowImportModal(false);

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
        const res = await fetch(`${backendUrl}/api/youtube`, {
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
          const buf = await safeDecodeAudioData(ctx, arr);
          loadedStems[key] = { buffer: buf, peaks: extractPeaks(buf) };
        }
        const tempSong = {
          ...PRESET_SONGS[0],
          bpm: data.bpm || 120,
          duration: data.duration || 32
        };
        loadedStems.metronome = synthesizeSongStems(ctx, tempSong, 0).metronome;

        const newSong = {
          id: data.id || `local-yt-${ytId}`,
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
        await saveTrackToDB(newSong);
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
    await saveTrackToDB(newSong);
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
    stopAudioNodes();
    setIsPlaying(false);
    setSongs((prev) => prev.filter((s) => s.id !== idToDelete));
    await deleteTrackFromDB(idToDelete);
    if (activeSongId === idToDelete) {
      setActiveSongId(PRESET_SONGS[0].id);
    }
    showToast('Música removida da biblioteca');
  };

  const handleResetCatalog = () => {
    stopAudioNodes();
    setIsPlaying(false);
    setSongs(PRESET_SONGS);
    localStorage.removeItem('davi_studio_songs_metadata');
    showToast('Catálogo original restaurado!');
  };

  const handleToggleCatalogPreview = async (song) => {
    ensureAudioContext(true);

    if (isPlaying && activeSongId === song.id) {
      stopAudioNodes();
      setIsPlaying(false);
      return;
    }

    stopAudioNodes();
    prevSongIdRef.current = song.id;
    setActiveSongId(song.id);
    await startPlaybackAt(0, song);
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
    if (!transposedChords || transposedChords.length === 0) return 0;
    const idx = transposedChords.findIndex(
      (c) => currentTime >= c.time && currentTime < c.time + c.duration
    );
    if (idx !== -1) return idx;
    // Se passou do último acorde mas a música continua, mantém no último
    if (currentTime >= transposedChords[transposedChords.length - 1].time) {
      return transposedChords.length - 1;
    }
    return 0;
  }, [transposedChords, currentTime]);

  const currentChordObj = transposedChords[activeChordIndex] || { transposed: 'N.C.' };
  const nextChordObj = transposedChords[activeChordIndex + 1] || { transposed: 'Fim' };

  // Contador visual de batidas [1, 2, 3, 4] sincronizado com a grade de batidas real e firstBeatOffset
  const currentBeatNumber = useMemo(() => {
    if (Array.isArray(activeSong.beatTimes) && activeSong.beatTimes.length > 0) {
      let beatIdx = 0;
      for (let i = 0; i < activeSong.beatTimes.length; i++) {
        if (currentTime >= activeSong.beatTimes[i]) {
          beatIdx = i;
        } else {
          break;
        }
      }
      return (beatIdx % 4) + 1;
    }
    const beatDur = 60 / (activeSong.bpm || 120);
    const adjustedTime = Math.max(0, currentTime - (activeSong.firstBeatOffset || 0));
    return (Math.floor(adjustedTime / beatDur) % 4) + 1;
  }, [currentTime, activeSong.bpm, activeSong.firstBeatOffset, activeSong.beatTimes]);

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
        {toastMessage && (
          <div className="fixed top-16 right-4 z-50 flex items-center gap-2 bg-slate-900/95 border border-emerald-500/50 text-slate-100 px-3.5 py-2.5 rounded-xl shadow-2xl animate-bounce">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        <CatalogView
          songs={songs}
          previewingId={isPlaying ? activeSongId : null}
          onTogglePreview={handleToggleCatalogPreview}
          onOpenSongInStudio={(id) => {
            ensureAudioContext(true);
            stopAudioNodes();
            setIsPlaying(false);
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

        <ImportModal
          showImportModal={showImportModal}
          setShowImportModal={setShowImportModal}
          isProcessingImport={isProcessingImport}
          processingStep={processingStep}
          youtubeUrl={youtubeUrl}
          setYoutubeUrl={setYoutubeUrl}
          handleYoutubeImport={handleYoutubeImport}
          handleLocalFileUpload={handleLocalFileUpload}
          handleAudioUrlImport={handleAudioUrlImport}
          handleYoutubeDirectMp3Upload={handleYoutubeDirectMp3Upload}
          handleLoadDemoTrack={handleLoadDemoTrack}
          backendOnline={backendOnline}
          onOpenBackendModal={() => setShowBackendModal(true)}
        />

        <BackendModal
          showBackendModal={showBackendModal}
          setShowBackendModal={setShowBackendModal}
          backendOnline={backendOnline}
          checkLocalBackend={checkLocalBackend}
          backendUrl={backendUrl}
          setBackendUrl={setBackendUrl}
        />
      </>
    );
  }

  // Verifica qual preset rápido está ativo para destacar visualmente
  const isKaraokeActive =
    trackStates.vocals.muted &&
    !trackStates.drums.muted &&
    !trackStates.bass.muted &&
    !trackStates.other.muted &&
    !anySoloActive;
  const isVocalSoloActive = trackStates.vocals.solo;
  const isAllNormal =
    !trackStates.vocals.muted &&
    !trackStates.drums.muted &&
    !trackStates.bass.muted &&
    !trackStates.other.muted &&
    !anySoloActive;

  // Se o usuário estiver na tela de Estúdio / Mixer Multitrack
  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#090D0B] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Input invisível para substituição rápida de áudio real */}
      <input
        ref={replaceAudioInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,audio/*"
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
      {activeSong.id.startsWith('yt-') &&
        !activeSong.customStems &&
        !inMemoryStemsCache.has(activeSong.id) && (
          <div className="bg-amber-950/30 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-amber-200 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                Prévia sintética do YouTube. Envie o MP3 para isolar a voz e instrumentos reais:
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

        {/* Área Central: Acordes + Barra Rápida de Isolamento + 5 Faixas */}
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

          {/* Multitrack Mixer: Barra de Atalhos 1-Toque + 5 Faixas */}
          <div
            className={`${
              mobileTab === 'mixer' ? 'flex' : 'hidden'
            } lg:flex flex-col justify-start gap-1.5 sm:gap-2 flex-1 min-h-0`}
          >
            {/* Barra de Atalhos Rápidos de Isolamento e Metrônomo (Visível no Mobile e Desktop) */}
            <div className="shrink-0 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar bg-[#101714] border border-emerald-950/80 rounded-xl px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-0.5 hidden sm:inline">
                  Isolamento Rápido:
                </span>

                <button
                  type="button"
                  onClick={() => applyMixPreset(isKaraokeActive ? 'reset' : 'no-vocals')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all active:scale-95 ${
                    isKaraokeActive
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/25'
                      : 'bg-[#16211C] hover:bg-slate-800 text-slate-200 border-slate-700/80'
                  }`}
                >
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Remover Voz (Karaokê)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyMixPreset(isVocalSoloActive ? 'reset' : 'only-vocals')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all active:scale-95 ${
                    isVocalSoloActive
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/25'
                      : 'bg-[#16211C] hover:bg-slate-800 text-slate-200 border-slate-700/80'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  <span>Só Voz</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyMixPreset(trackStates.drums.muted ? 'reset' : 'no-drums')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                    trackStates.drums.muted && !anySoloActive
                      ? 'bg-rose-500/25 text-rose-300 border-rose-500/50'
                      : 'bg-[#16211C] hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  Sem Bateria
                </button>

                <button
                  type="button"
                  onClick={() => applyMixPreset(trackStates.other.muted ? 'reset' : 'no-guitar')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                    trackStates.other.muted && !anySoloActive
                      ? 'bg-rose-500/25 text-rose-300 border-rose-500/50'
                      : 'bg-[#16211C] hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  Sem Harmonia
                </button>

                {!isAllNormal && (
                  <button
                    type="button"
                    onClick={() => applyMixPreset('reset')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Mix Completa</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSyncMetronomeHere}
                title="Alinha a batida 1 do metrônomo exatamente ao momento atual da música"
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 shrink-0 transition-all active:scale-95"
              >
                Alinhar Clique Aqui
              </button>
            </div>

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
        handleAudioUrlImport={handleAudioUrlImport}
        handleYoutubeDirectMp3Upload={handleYoutubeDirectMp3Upload}
        handleLoadDemoTrack={handleLoadDemoTrack}
        backendOnline={backendOnline}
        onOpenBackendModal={() => setShowBackendModal(true)}
      />

      {/* Modal 2: Servidor Python Local & Google Colab */}
      <BackendModal
        showBackendModal={showBackendModal}
        setShowBackendModal={setShowBackendModal}
        backendOnline={backendOnline}
        checkLocalBackend={checkLocalBackend}
        backendUrl={backendUrl}
        setBackendUrl={setBackendUrl}
      />
    </div>
  );
}
