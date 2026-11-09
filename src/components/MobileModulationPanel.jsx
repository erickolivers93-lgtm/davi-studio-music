import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const MobileModulationPanel = ({
  currentKey,
  pitchSemitones,
  setPitchSemitones,
  currentBpm,
  playbackSpeed,
  setPlaybackSpeed
}) => {
  return (
    <div className="lg:hidden flex-1 p-3 space-y-3 overflow-y-auto">
      <div className="bg-[#111915] border border-emerald-900/40 rounded-xl p-3.5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Modulação de Tom (Pitch Shift)
        </h3>
        <div className="flex items-center justify-between bg-[#15201B] p-2.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-[11px] text-slate-400 block">Tom Atual</span>
            <span className="text-xl font-bold text-white">{currentKey}</span>
            <span className="text-xs text-emerald-400 ml-2">
              ({pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPitchSemitones((s) => Math.max(-12, s - 1))}
              className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPitchSemitones(0)}
              className="px-2.5 h-9 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
            >
              Orig
            </button>
            <button
              type="button"
              onClick={() => setPitchSemitones((s) => Math.min(12, s + 1))}
              className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Velocidade / Andamento
        </h3>
        <div className="flex items-center justify-between bg-[#15201B] p-2.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-[11px] text-slate-400 block">Andamento</span>
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
              className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPlaybackSpeed(1.0)}
              className="px-2.5 h-9 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() =>
                setPlaybackSpeed((v) => Math.min(1.5, Math.round((v + 0.05) * 100) / 100))
              }
              className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
