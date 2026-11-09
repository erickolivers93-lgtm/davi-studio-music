import React from 'react';
import {
  Sliders,
  ChevronUp,
  ChevronDown,
  Gauge,
  Link2,
  Download,
  Server
} from 'lucide-react';
import { StemIcon } from './StemIcon';

export const HeaderHUD = ({
  activeSong,
  currentChordObj,
  nextChordObj,
  trackStates,
  handleToggleMute,
  isPlaying,
  currentBeatNumber,
  pitchSemitones,
  setPitchSemitones,
  currentKey,
  playbackSpeed,
  setPlaybackSpeed,
  currentBpm,
  countInBars,
  setCountInBars,
  setShowImportModal,
  handleExportWav,
  setShowBackendModal,
  backendOnline
}) => {
  return (
    <header className="shrink-0 bg-gradient-to-r from-[#0E1612] via-[#111A16] to-[#0E1612] border-b border-emerald-900/50 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 shadow-lg shadow-black/40">
      {/* Identidade DAVI + Faixa Ativa */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0 border border-emerald-300/30">
          <Sliders className="w-5 h-5 text-slate-950 stroke-[2.5]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black tracking-wider text-white text-base sm:text-lg leading-none">
              DAVI
            </span>
            <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              STUDIO AI
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px] sm:max-w-[200px]">
              {activeSong.title}
            </span>
            <span className="hidden sm:inline text-[11px] text-emerald-400/80 font-medium truncate">
              • {activeSong.artist}
            </span>
          </div>
        </div>
      </div>

      {/* MÓDULOS CENTRAIS DA HUD SUPERIOR (DESKTOP) */}
      <div className="hidden lg:flex items-center gap-2.5">
        {/* HUD 1: Acorde Atual em Tempo Real */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-3 py-1.5 gap-3 shadow-inner">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
              Acorde Atual
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-emerald-400 leading-none">
                {currentChordObj.transposed}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                → {nextChordObj.transposed}
              </span>
            </div>
          </div>
        </div>

        {/* HUD 2: Smart Metrônomo Sincronizado + Pulso de Compasso */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-3 py-1.5 gap-2.5 shadow-inner">
          <button
            type="button"
            onClick={() => handleToggleMute('metronome')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
              !trackStates.metronome.muted
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/25'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-emerald-500/50'
            }`}
            title="Ativar/Desativar Smart Metrônomo"
          >
            <StemIcon type="metronome" className="w-3.5 h-3.5" />
            <span>Metrônomo {!trackStates.metronome.muted ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1" title="Pulso Sincronizado do Compasso (4/4)">
            {[1, 2, 3, 4].map((b) => (
              <span
                key={b}
                className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center transition-all ${
                  isPlaying && currentBeatNumber === b
                    ? b === 1
                      ? 'bg-emerald-400 text-slate-950 scale-110 shadow-sm shadow-emerald-400/60'
                      : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                    : 'bg-slate-900/90 text-slate-500 border border-slate-800'
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* HUD 3: Modulação de Tom */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-3 py-1.5 gap-2.5 shadow-inner">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
              Tom ({pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st)
            </span>
            <span className="text-sm font-black text-emerald-400 leading-none">{currentKey}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPitchSemitones((s) => Math.max(-12, s - 1))}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-200 border border-slate-700"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPitchSemitones(0)}
              disabled={pitchSemitones === 0}
              className="px-1.5 h-6 rounded-lg bg-slate-800/70 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-bold text-slate-300"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPitchSemitones((s) => Math.min(12, s + 1))}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-200 border border-slate-700"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* HUD 4: Velocidade / BPM */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-3 py-1.5 gap-2.5 shadow-inner">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
              Andamento ({Math.round(playbackSpeed * 100)}%)
            </span>
            <span className="text-sm font-black text-emerald-400 leading-none">
              {currentBpm} <span className="text-[10px] font-semibold text-slate-400">BPM</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setPlaybackSpeed((v) => Math.max(0.5, Math.round((v - 0.05) * 100) / 100))
              }
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-200 border border-slate-700"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaybackSpeed(1.0)}
              disabled={playbackSpeed === 1.0}
              className="px-1.5 h-6 rounded-lg bg-slate-800/70 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-bold text-slate-300"
            >
              1x
            </button>
            <button
              type="button"
              onClick={() =>
                setPlaybackSpeed((v) => Math.min(1.5, Math.round((v + 0.05) * 100) / 100))
              }
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-200 border border-slate-700"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCountInBars((c) => (c === 0 ? 1 : 0))}
          className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
            countInBars > 0
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
              : 'bg-[#14201A] border-emerald-900/50 text-slate-400 hover:text-slate-200'
          }`}
          title="Contagem de 4 tempos antes de iniciar"
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>4T: {countInBars > 0 ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Botões Rápidos Direita */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Importar</span>
        </button>

        <button
          type="button"
          onClick={handleExportWav}
          className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-[#14201A] hover:bg-slate-800 text-slate-200 border border-emerald-900/50 text-xs font-semibold flex items-center gap-1"
          title="Exportar Mixagem em WAV"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">WAV</span>
        </button>

        <button
          type="button"
          onClick={() => setShowBackendModal(true)}
          className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-[#14201A] hover:bg-slate-800 border border-emerald-900/50 text-xs font-semibold flex items-center gap-1"
          title="Ver Servidor Python Local"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <Server className="w-3.5 h-3.5 text-slate-300" />
        </button>
      </div>
    </header>
  );
};
