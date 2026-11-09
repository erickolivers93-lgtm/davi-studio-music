import React from 'react';
import { getChordShape } from '../constants/musicConstants';

export const ChordDiagram = ({ chordName }) => {
  const shape = getChordShape(chordName);
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
  const blackKeys = [
    { note: 1, x: 13 },
    { note: 3, x: 27 },
    { note: 6, x: 55 },
    { note: 8, x: 69 },
    { note: 10, x: 83 }
  ];

  return (
    <div className="flex items-center gap-2.5 bg-[#111916] border border-emerald-900/50 rounded-xl px-2.5 py-1">
      <div className="min-w-[44px] text-center border-r border-slate-800 pr-2">
        <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-medium">Acorde</span>
        <span className="text-base sm:text-lg font-bold text-emerald-400 leading-tight">{chordName || 'N.C.'}</span>
      </div>

      <div className="flex items-center">
        <svg className="w-10 h-10 sm:w-11 sm:h-11" viewBox="0 0 70 72">
          <line x1="12" y1="12" x2="58" y2="12" stroke="#94a3b8" strokeWidth="2.5" />
          {[24, 36, 48, 60].map((y) => (
            <line key={y} x1="12" y1={y} x2="58" y2={y} stroke="#334155" strokeWidth="1" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((s) => {
            const x = 12 + s * 9.2;
            const fret = shape.frets[s];
            return (
              <g key={s}>
                <line x1={x} y1="12" x2={x} y2="62" stroke="#64748b" strokeWidth="1.2" />
                {fret === -1 && (
                  <g stroke="#ef4444" strokeWidth="1.5">
                    <line x1={x - 2.5} y1="4" x2={x + 2.5} y2="9" />
                    <line x1={x + 2.5} y1="4" x2={x - 2.5} y2="9" />
                  </g>
                )}
                {fret === 0 && (
                  <circle cx={x} cy="6.5" r="2.5" fill="none" stroke="#34d399" strokeWidth="1.4" />
                )}
                {fret > 0 && (
                  <circle
                    cx={x}
                    cy={12 + Math.min(4, fret) * 12 - 6}
                    r="3.8"
                    fill="#10b981"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="hidden sm:block">
        <svg className="w-20 h-9" viewBox="0 0 105 52">
          {whiteKeys.map((note, idx) => {
            const active = shape.piano.includes(note);
            return (
              <rect
                key={note}
                x={idx * 14 + 2}
                y="2"
                width="13"
                height="46"
                rx="2"
                fill={active ? '#10b981' : '#e2e8f0'}
                stroke="#0f172a"
                strokeWidth="1"
              />
            );
          })}
          {blackKeys.map((bk) => {
            const active = shape.piano.includes(bk.note);
            return (
              <rect
                key={bk.note}
                x={bk.x}
                y="2"
                width="9"
                height="28"
                rx="1.5"
                fill={active ? '#34d399' : '#0f172a'}
                stroke="#020617"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
