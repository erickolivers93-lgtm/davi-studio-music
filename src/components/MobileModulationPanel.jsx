import React from 'react';
import { ChevronDown, ChevronUp, Clock, Target, Play } from 'lucide-react';
import { KeySelectorDropdown } from './KeySelectorDropdown';
import { StemIcon } from './StemIcon';

export const MobileModulationPanel = ({
  originalKey,
  currentKey,
  pitchSemitones,
  setPitchSemitones,
  currentBpm,
  baseBpm,
  onChangeBpm,
  onTapTempo,
  onSyncMetronome,
  playbackSpeed,
  setPlaybackSpeed,
  trackStates,
  handleToggleMute
}) => {
  return (
    <div className="lg:hidden flex-1 p-3 space-y-3 overflow-y-auto">
      {/* 1. Transposição de Tom */}
      <div className="bg-[#111915] border border-emerald-900/40 rounded-xl p-3.5 space-y-3 shadow-lg">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center justify-between">
            <span>Tom Musical (Pitch Shifting)</span>
            <span className="text-[10px] text-slate-400 font-mono">
              Orig: {originalKey} → Atual: <strong className="text-emerald-300">{currentKey}</strong>
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Mude o tom da música em tempo real para qualquer uma das 12 tonalidades.
          </p>

          <KeySelectorDropdown
            originalKey={originalKey}
            pitchSemitones={pitchSemitones}
            onChangeKey={setPitchSemitones}
            compact={true}
          />
        </div>

        {/* 2. Andamento & Calibração do Metrônomo */}
        <div className="border-t border-slate-800 pt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Andamento & Metrônomo (BPM)
            </h3>
            {handleToggleMute && (
              <button
                type="button"
                onClick={() => handleToggleMute('metronome')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                  trackStates && !trackStates.metronome.muted
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <StemIcon type="metronome" className="w-3 h-3" />
                <span>Click {trackStates && !trackStates.metronome.muted ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          {/* Ajuste fino do BPM base */}
          <div className="bg-[#15201B] p-2.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">BPM Real da Música</span>
                <span className="text-2xl font-black text-white">{baseBpm || currentBpm}</span>
                <span className="text-xs text-emerald-400 ml-1 font-bold">BPM</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangeBpm && onChangeBpm((baseBpm || currentBpm) - 1)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center border border-slate-700 active:scale-95"
                  title="Diminuir 1 BPM"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => onChangeBpm && onChangeBpm((baseBpm || currentBpm) + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center border border-slate-700 active:scale-95"
                  title="Aumentar 1 BPM"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={onTapTempo}
                  className="px-2.5 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold flex items-center gap-1 active:scale-95"
                  title="Toque 4 vezes no ritmo da música para definir o BPM"
                >
                  <Target className="w-3 h-3 text-emerald-400" />
                  <span>Tap BPM</span>
                </button>
              </div>
            </div>

            {/* Botão de sincronizar Batida 1 */}
            <button
              type="button"
              onClick={onSyncMetronome}
              className="w-full py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Alinhar Tempo 1 (Click) Neste Segundo</span>
            </button>
          </div>

          {/* Velocidade de Reprodução */}
          <div className="bg-[#15201B] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Velocidade de Reprodução</span>
              <span className="text-sm font-bold text-slate-200">
                {Math.round(playbackSpeed * 100)}% ({currentBpm} BPM efetivo)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setPlaybackSpeed((v) => Math.max(0.5, Math.round((v - 0.05) * 100) / 100))
                }
                className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center active:scale-95"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(1.0)}
                disabled={playbackSpeed === 1.0}
                className="px-2 h-7 rounded-lg bg-slate-800 disabled:opacity-40 text-[10px] font-bold text-slate-300"
              >
                1x
              </button>
              <button
                type="button"
                onClick={() =>
                  setPlaybackSpeed((v) => Math.min(1.5, Math.round((v + 0.05) * 100) / 100))
                }
                className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center active:scale-95"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
