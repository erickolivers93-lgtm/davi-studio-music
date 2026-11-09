import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  Repeat,
  Disc,
  Sliders,
  Music,
  Gauge,
  Layers
} from 'lucide-react';
import { StemIcon } from './StemIcon';

export const TransportFooter = ({
  activeSong,
  currentKey,
  isPlaying,
  togglePlay,
  handleSeek,
  loopRange,
  setLoopRange,
  currentTime,
  trackStates,
  handleToggleMute,
  showChordInspector,
  setShowChordInspector,
  mobileTab,
  setMobileTab,
  formatTime
}) => {
  return (
    <footer className="shrink-0 bg-[#0D1411] border-t border-emerald-950/90 px-3 sm:px-5 py-1.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="hidden md:flex items-center gap-2.5 min-w-[160px]">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <Disc className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''}`} />
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-white truncate">{activeSong.title}</div>
            <div className="text-[10px] text-slate-400">
              Orig: <strong>{activeSong.originalKey}</strong> • Atual:{' '}
              <strong className="text-emerald-400">{currentKey}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-center">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSeek(0)}
              className="w-8 h-8 rounded-lg bg-[#15201B] hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300"
              title="Voltar ao início"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/25 active:scale-95 transition-all"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() =>
                setLoopRange((prev) => ({
                  ...prev,
                  enabled: !prev.enabled
                }))
              }
              className={`px-2 h-8 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                loopRange.enabled
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#15201B] border-slate-800 text-slate-400'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Loop</span>
            </button>
          </div>

          <div className="bg-[#141F1A] border border-slate-800 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-200">
            <span className="text-emerald-400 font-semibold">{formatTime(currentTime)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-slate-400">{formatTime(activeSong.duration)}</span>
          </div>

          <button
            type="button"
            onClick={() => handleToggleMute('metronome')}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors ${
              !trackStates.metronome.muted
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#15201B] border-slate-800 text-slate-400'
            }`}
            title="Ativar/Mutar Smart Metrônomo"
          >
            <StemIcon type="metronome" className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">
              Click: {!trackStates.metronome.muted ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowChordInspector((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-[#15201B] hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300"
          >
            {showChordInspector ? 'Ocultar Braço' : 'Mostrar Braço'}
          </button>
        </div>
      </div>

      {/* Barra de Abas Mobile */}
      <div className="grid grid-cols-4 gap-1 lg:hidden pt-1 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setMobileTab('mixer')}
          className={`py-1 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 ${
            mobileTab === 'mixer'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Faixas</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('chords')}
          className={`py-1 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 ${
            mobileTab === 'chords'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Acordes</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('modulation')}
          className={`py-1 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 ${
            mobileTab === 'modulation'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>Tom/BPM</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('library')}
          className={`py-1 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 ${
            mobileTab === 'library'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Músicas</span>
        </button>
      </div>
    </footer>
  );
};
