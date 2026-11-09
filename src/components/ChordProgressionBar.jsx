import React, { useRef, useEffect } from 'react';
import { Repeat } from 'lucide-react';
import { ChordDiagram } from './ChordDiagram';

export const ChordProgressionBar = ({
  activeSong,
  currentTime,
  transposedChords,
  activeChordIndex,
  currentChordObj,
  currentBeatNumber,
  isPlaying,
  loopRange,
  setLoopRange,
  onSeek,
  showChordInspector,
  formatTime
}) => {
  const scrollContainerRef = useRef(null);
  const activeButtonRef = useRef(null);

  // Auto-scroll horizontal automático para manter o acorde atual sempre visível e centralizado
  useEffect(() => {
    const container = scrollContainerRef.current;
    const activeBtn = activeButtonRef.current;
    if (!container || !activeBtn) return;

    const containerWidth = container.clientWidth;
    const btnLeft = activeBtn.offsetLeft;
    const btnWidth = activeBtn.offsetWidth;
    const targetScrollLeft = Math.max(0, btnLeft - containerWidth / 2 + btnWidth / 2);

    container.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
  }, [activeChordIndex]);

  return (
    <div className="shrink-0 bg-[#101714] border border-emerald-950/90 rounded-xl p-2 sm:p-2.5 space-y-2">
      {/* Barra de Seções e Compasso */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-1">
            Seções:
          </span>
          {(activeSong.sections || []).map((sec) => {
            const isCurrentSec = currentTime >= sec.start && currentTime < sec.end;
            const isLoopingThis =
              loopRange.enabled &&
              loopRange.start === sec.start &&
              loopRange.end === sec.end;

            return (
              <div key={sec.name} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onSeek(sec.start)}
                  className={`px-2 py-0.5 rounded-l text-[11px] font-medium border transition-colors ${
                    isCurrentSec
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#151F1A] border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {sec.name}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLoopRange((prev) =>
                      isLoopingThis
                        ? { ...prev, enabled: false, label: '' }
                        : {
                            enabled: true,
                            start: sec.start,
                            end: sec.end,
                            label: sec.name
                          }
                    )
                  }
                  className={`px-1 py-0.5 rounded-r border-y border-r text-[11px] transition-colors ${
                    isLoopingThis
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#151F1A] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={`Loop na seção ${sec.name}`}
                >
                  <Repeat className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 bg-[#151F1A] px-2 py-0.5 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 font-medium">Compasso 4/4:</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((b) => (
              <span
                key={b}
                className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
                  isPlaying && currentBeatNumber === b
                    ? b === 1
                      ? 'bg-emerald-400 text-slate-950 scale-110'
                      : 'bg-emerald-500/30 text-emerald-200'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grade de Acordes Sincronizados com Auto-Scroll + Inspetor Visual */}
      <div className="flex items-center justify-between gap-2">
        <div
          ref={scrollContainerRef}
          className="relative flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar scroll-smooth"
        >
          {transposedChords.map((item, idx) => {
            const isActive = idx === activeChordIndex;
            const isPast = idx < activeChordIndex;
            const chordProgress = isActive && item.duration > 0
              ? Math.max(0, Math.min(100, ((currentTime - item.time) / item.duration) * 100))
              : 0;

            return (
              <button
                type="button"
                ref={isActive ? activeButtonRef : null}
                key={`${item.time}-${idx}`}
                onClick={() => onSeek(item.time)}
                className={`relative overflow-hidden shrink-0 min-w-[66px] px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500/25 to-green-600/20 border-emerald-400 shadow-md shadow-emerald-950/50 scale-[1.03]'
                    : isPast
                    ? 'bg-[#121916]/60 border-slate-800/50 opacity-50'
                    : 'bg-[#141D19] border-slate-800 hover:border-slate-700'
                }`}
              >
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 h-[2.5px] bg-emerald-400 transition-all duration-75"
                    style={{ width: `${chordProgress}%` }}
                  />
                )}
                <div className="text-[9px] font-mono text-slate-400 leading-none">
                  {formatTime(item.time)}
                </div>
                <div
                  className={`text-xs sm:text-sm font-black tracking-tight mt-0.5 ${
                    isActive ? 'text-emerald-300' : 'text-slate-200'
                  }`}
                >
                  {item.transposed}
                </div>
              </button>
            );
          })}
        </div>

        {showChordInspector && (
          <div className="shrink-0">
            <ChordDiagram chordName={currentChordObj.transposed} />
          </div>
        )}
      </div>
    </div>
  );
};
