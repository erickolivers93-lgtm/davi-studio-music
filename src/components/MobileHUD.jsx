import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { StemIcon } from './StemIcon';

export const MobileHUD = ({
  currentChordObj,
  currentKey,
  pitchSemitones,
  setPitchSemitones,
  trackStates,
  handleToggleMute,
  currentBpm,
  isPlaying,
  currentBeatNumber,
  onBackToCatalog
}) => {
  return (
    <div className="lg:hidden shrink-0 bg-[#101915] border-b border-emerald-900/40 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="px-2 py-0.5 rounded-lg bg-[#14201A] border border-emerald-900/60 text-[10px] font-bold text-slate-300 flex items-center gap-1 shrink-0"
        >
          <ArrowLeft className="w-3 h-3 text-emerald-400" />
          <span>Catálogo</span>
        </button>

        <div className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-1 shrink-0">
          <span className="text-[8px] uppercase text-slate-400 font-semibold">Acorde:</span>
          <span className="text-xs font-black text-emerald-300">{currentChordObj.transposed}</span>
        </div>

        <div className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-1 shrink-0">
          <span className="text-[8px] uppercase text-slate-400">Tom:</span>
          <span className="text-xs font-bold text-emerald-400">
            {currentKey} ({pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones})
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleToggleMute('metronome')}
          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 shrink-0 ${
            !trackStates.metronome.muted
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <StemIcon type="metronome" className="w-3 h-3" />
          <span>{currentBpm} BPM</span>
        </button>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className={`w-3.5 h-3.5 rounded text-[8px] font-bold flex items-center justify-center ${
              isPlaying && currentBeatNumber === b
                ? b === 1
                  ? 'bg-emerald-400 text-slate-950 scale-105'
                  : 'bg-emerald-500/30 text-emerald-200'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
};
