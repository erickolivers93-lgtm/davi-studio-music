import React from 'react';
import {
  Sliders,
  ChevronUp,
  ChevronDown,
  Gauge,
  Link2,
  Download,
  Server,
  ArrowLeft
} from 'lucide-react';
import { StemIcon } from './StemIcon';
import { KeySelectorDropdown } from './KeySelectorDropdown';

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
  baseBpm,
  onChangeBpm,
  onTapTempo,
  onSyncMetronome,
  countInBars,
  setCountInBars,
  setShowImportModal,
  handleExportWav,
  setShowBackendModal,
  backendOnline,
  onBackToCatalog
}) => {
  return (
    <header className="shrink-0 bg-gradient-to-r from-[#0E1612] via-[#111A16] to-[#0E1612] border-b border-emerald-900/50 px-3 sm:px-5 py-2 flex items-center justify-between gap-3 shadow-lg shadow-black/40">
      {/* Botão Voltar ao Catálogo + Identidade DAVI + Faixa Ativa */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="px-2.5 py-1.5 rounded-xl bg-[#14201A] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-emerald-900/50 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
          title="Voltar para a Biblioteca de Músicas"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Biblioteca</span>
        </button>

        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0 border border-emerald-300/30">
          <Sliders className="w-4 h-4 text-slate-950 stroke-[2.5]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black tracking-wider text-white text-sm sm:text-base leading-none">
              DAVI
            </span>
            <span className="text-[8px] uppercase tracking-widest font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              STUDIO AI
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-[180px]">
              {activeSong.title}
            </span>
            <span className="hidden md:inline text-[10px] text-emerald-400/80 font-medium truncate">
              • {activeSong.artist}
            </span>
          </div>
        </div>
      </div>

      {/* MÓDULOS CENTRAIS DA HUD SUPERIOR (DESKTOP) */}
      <div className="hidden lg:flex items-center gap-2">
        {/* HUD 1: Acorde Atual em Tempo Real */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-2.5 py-1 gap-2.5 shadow-inner">
          <div>
            <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-semibold leading-none">
              Acorde Atual
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-black text-emerald-400 leading-none">
                {currentChordObj.transposed}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                → {nextChordObj.transposed}
              </span>
            </div>
          </div>
        </div>

        {/* HUD 2: Dropdown de Tons Completo (-12 a +12 semitons) */}
        <KeySelectorDropdown
          originalKey={activeSong.originalKey}
          pitchSemitones={pitchSemitones}
          onChangeKey={setPitchSemitones}
        />

        {/* HUD 3: Andamento / BPM */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-2.5 py-1 gap-2 shadow-inner">
          <div>
            <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-semibold leading-none">
              BPM Real: {baseBpm || currentBpm}
            </span>
            <span className="text-xs font-black text-emerald-400 leading-tight">
              {currentBpm} <span className="text-[9px] font-semibold text-slate-400">({Math.round(playbackSpeed * 100)}%)</span>
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onChangeBpm && onChangeBpm((baseBpm || currentBpm) - 1)}
              className="w-5 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold"
              title="Diminuir 1 BPM da música"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => onChangeBpm && onChangeBpm((baseBpm || currentBpm) + 1)}
              className="w-5 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold"
              title="Aumentar 1 BPM da música"
            >
              +1
            </button>
            <button
              type="button"
              onClick={onTapTempo}
              className="px-1.5 h-6 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[9px] font-extrabold"
              title="Tap Tempo (toque 4x para calcular o BPM)"
            >
              TAP
            </button>
            <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() =>
                setPlaybackSpeed((v) => Math.max(0.5, Math.round((v - 0.05) * 100) / 100))
              }
              className="w-5 h-6 rounded bg-slate-800 hover:bg-emerald-500/20 text-slate-200 flex items-center justify-center"
              title="Diminuir velocidade"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setPlaybackSpeed(1.0)}
              disabled={playbackSpeed === 1.0}
              className="px-1 h-6 rounded bg-slate-800/70 hover:bg-slate-700 disabled:opacity-40 text-[9px] font-bold text-slate-300"
              title="Velocidade normal 100%"
            >
              1x
            </button>
            <button
              type="button"
              onClick={() =>
                setPlaybackSpeed((v) => Math.min(1.5, Math.round((v + 0.05) * 100) / 100))
              }
              className="w-5 h-6 rounded bg-slate-800 hover:bg-emerald-500/20 text-slate-200 flex items-center justify-center"
              title="Aumentar velocidade"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* HUD 4: Smart Metrônomo + Pulso de Compasso */}
        <div className="flex items-center bg-[#14201A] border border-emerald-800/60 rounded-xl px-2.5 py-1 gap-2 shadow-inner">
          <button
            type="button"
            onClick={() => handleToggleMute('metronome')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all border ${
              !trackStates.metronome.muted
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/25'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-emerald-500/50'
            }`}
            title="Ativar/Desativar Smart Metrônomo"
          >
            <StemIcon type="metronome" className="w-3 h-3" />
            <span>Click {!trackStates.metronome.muted ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1" title="Pulso Sincronizado do Compasso (4/4)">
            {[1, 2, 3, 4].map((b) => (
              <span
                key={b}
                className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center transition-all ${
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

        <button
          type="button"
          onClick={() => setCountInBars((c) => (c === 0 ? 1 : 0))}
          className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-colors ${
            countInBars > 0
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
              : 'bg-[#14201A] border-emerald-900/50 text-slate-400 hover:text-slate-200'
          }`}
          title="Contagem de 4 tempos antes de iniciar"
        >
          <Gauge className="w-3 h-3" />
          <span>4T: {countInBars > 0 ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Botões Rápidos Direita */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Importar</span>
        </button>

        <button
          type="button"
          onClick={handleExportWav}
          className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-[#14201A] hover:bg-slate-800 text-slate-200 border border-emerald-900/50 text-xs font-semibold flex items-center gap-1"
          title="Exportar Mixagem em WAV"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">WAV</span>
        </button>

        <button
          type="button"
          onClick={() => setShowBackendModal(true)}
          className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-[#14201A] hover:bg-slate-800 border border-emerald-900/50 text-xs font-semibold flex items-center gap-1"
          title="Ver Servidor Python Demucs"
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
