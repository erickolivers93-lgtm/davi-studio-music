import React from 'react';
import { ChevronDown, ChevronUp, Music } from 'lucide-react';
import { getAvailableKeys } from '../constants/musicConstants';

export const KeySelectorDropdown = ({
  originalKey = 'Am',
  pitchSemitones = 0,
  onChangeKey,
  compact = false
}) => {
  const availableKeys = getAvailableKeys(originalKey);
  const currentKeyObj = availableKeys.find((k) => k.semitones === pitchSemitones) || availableKeys[12];

  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'w-full justify-between' : ''}`}>
      {/* Container do Dropdown de Tons */}
      <div className="relative flex items-center bg-[#15201B] border border-emerald-800/70 rounded-xl px-2.5 py-1 shadow-inner hover:border-emerald-500/80 transition-colors">
        <div className="flex flex-col mr-2 pointer-events-none">
          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold leading-none">
            Tom ({pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st)
          </span>
          <span className="text-xs sm:text-sm font-black text-emerald-300 leading-tight">
            {currentKeyObj?.keyName || originalKey}
          </span>
        </div>

        {/* Select Nativo Estilizado (100% acessível e compatível com touch mobile) */}
        <select
          value={pitchSemitones}
          onChange={(e) => onChangeKey(parseInt(e.target.value, 10))}
          className="bg-transparent text-[11px] font-bold text-emerald-400 cursor-pointer focus:outline-none appearance-none pr-5 py-0.5"
          title="Selecione o Tom Musical Desejado"
        >
          {availableKeys.map((k) => (
            <option key={k.semitones} value={k.semitones} className="bg-[#121A15] text-slate-100">
              {k.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2 pointer-events-none text-slate-400">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Botões Rápidos de Nudge (- / 0 / +) */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onChangeKey(Math.max(-12, pitchSemitones - 1))}
          className="w-7 h-7 rounded-lg bg-slate-800/90 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-200 border border-slate-700 active:scale-95 transition-all"
          title="Descer meio tom (-1 st)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onChangeKey(0)}
          disabled={pitchSemitones === 0}
          className="px-2 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-bold text-slate-300 active:scale-95 transition-all"
          title="Voltar ao tom original"
        >
          0
        </button>

        <button
          type="button"
          onClick={() => onChangeKey(Math.min(12, pitchSemitones + 1))}
          className="w-7 h-7 rounded-lg bg-slate-800/90 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-200 border border-slate-700 active:scale-95 transition-all"
          title="Subir meio tom (+1 st)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
