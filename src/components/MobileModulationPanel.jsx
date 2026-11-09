import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { KeySelectorDropdown } from './KeySelectorDropdown';

export const MobileModulationPanel = ({
  originalKey,
  currentKey,
  pitchSemitones,
  setPitchSemitones,
  currentBpm,
  playbackSpeed,
  setPlaybackSpeed
}) => {
  return (
    <div className="lg:hidden flex-1 p-3 space-y-3 overflow-y-auto">
      <div className="bg-[#111915] border border-emerald-900/40 rounded-xl p-3.5 space-y-3 shadow-lg">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
            Seletor de Tom Musical (Pitch Shifting)
          </h3>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Transponha a música para qualquer uma das 12 tonalidades cromáticas com fidelidade de estúdio.
          </p>

          <KeySelectorDropdown
            originalKey={originalKey}
            pitchSemitones={pitchSemitones}
            onChangeKey={setPitchSemitones}
            compact={true}
          />
        </div>

        <div className="border-t border-slate-800 pt-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
            Velocidade & Andamento (BPM)
          </h3>
          <div className="flex items-center justify-between bg-[#15201B] p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block">Andamento Calculado</span>
              <span className="text-xl font-bold text-white">{currentBpm} BPM</span>
              <span className="text-xs text-emerald-400 ml-2">
                ({Math.round(playbackSpeed * 100)}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setPlaybackSpeed((v) => Math.max(0.5, Math.round((v - 0.05) * 100) / 100))
                }
                className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white active:scale-95 transition-all"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(1.0)}
                className="px-2.5 h-9 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 active:scale-95 transition-all"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() =>
                  setPlaybackSpeed((v) => Math.min(1.5, Math.round((v + 0.05) * 100) / 100))
                }
                className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white active:scale-95 transition-all"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
