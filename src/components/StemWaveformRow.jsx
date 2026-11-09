import React, { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { StemIcon } from './StemIcon';

export const StemWaveformRow = ({
  stemKey,
  label,
  colorHex,
  peaks,
  state,
  isAudible,
  progress,
  loopRange,
  duration,
  onToggleMute,
  onToggleSolo,
  onChangeVolume,
  onChangePan,
  onSeek
}) => {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 36 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateSize);
      observer.observe(canvas);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || peaks.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvasSize.width;
    const h = canvasSize.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (loopRange.enabled && duration > 0) {
      const startX = (loopRange.start / duration) * w;
      const endX = (loopRange.end / duration) * w;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.fillRect(startX, 0, Math.max(2, endX - startX), h);
    }

    const barCount = peaks.length;
    const barGap = w < 420 ? 1.2 : 1.8;
    const barWidth = Math.max(1, (w - barCount * barGap) / barCount);
    const playX = progress * w;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + barGap);
      const amp = peaks[i] * Math.min(1.2, state.volume) * (isAudible ? 0.85 : 0.18);
      const barH = Math.max(2, amp * (h * 0.78));
      const y = (h - barH) / 2;

      if (!isAudible) {
        ctx.fillStyle = '#263042';
      } else if (x <= playX) {
        ctx.fillStyle = colorHex;
      } else {
        ctx.fillStyle = `${colorHex}44`;
      }

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barWidth, barH, 1.5);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barH);
      }
    }
  }, [peaks, state.volume, isAudible, progress, colorHex, loopRange, duration, canvasSize]);

  const seekFromClientX = (clientX, target) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div
      className={`flex flex-row items-center flex-1 min-h-[54px] max-h-[84px] bg-[#121621] border rounded-xl overflow-hidden transition-colors ${
        !isAudible
          ? 'border-slate-800/50 opacity-75'
          : state.solo
          ? 'border-amber-500/60 shadow-sm shadow-amber-500/10'
          : 'border-slate-800/80 hover:border-slate-700/80'
      }`}
    >
      {/* Painel de Controles da Faixa */}
      <div className="w-[205px] sm:w-68 md:w-80 shrink-0 h-full px-2 sm:px-3.5 bg-[#151A28] border-r border-slate-800/80 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Botão de Ícone (Toque rápido também silencia/ativa a faixa estilo Moises AI) */}
        <button
          type="button"
          onClick={() => onToggleMute(stemKey)}
          title={isAudible ? `Silenciar ${label}` : `Ativar ${label}`}
          className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 text-left group cursor-pointer"
        >
          <div
            className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-90"
            style={{
              backgroundColor: isAudible ? `${colorHex}25` : '#1e293b',
              color: isAudible ? colorHex : '#64748b'
            }}
          >
            <StemIcon type={stemKey} className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {!isAudible && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center">
                <VolumeX className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div
              className={`text-[11px] sm:text-sm font-semibold truncate leading-tight ${
                isAudible ? 'text-slate-100' : 'text-slate-500 line-through'
              }`}
            >
              {label}
            </div>
            <div className="text-[10px] text-slate-400 font-mono leading-tight flex items-center gap-1">
              {isAudible ? (
                <span>{Math.round(state.volume * 100)}%</span>
              ) : (
                <span className="text-rose-400 font-bold">MUDO</span>
              )}
            </div>
          </div>
        </button>

        {/* Botões M/S + Volume + Pan */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleMute(stemKey)}
            title={state.muted ? 'Desmutar faixa' : 'Mutar faixa'}
            className={`w-7 h-7 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all flex items-center justify-center border active:scale-90 ${
              state.muted
                ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            M
          </button>
          <button
            type="button"
            onClick={() => onToggleSolo(stemKey)}
            title={state.solo ? 'Desativar Solo' : 'Isolar faixa (Solo)'}
            className={`w-7 h-7 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all flex items-center justify-center border active:scale-90 ${
              state.solo
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            S
          </button>

          <input
            type="range"
            min="0"
            max="1.2"
            step="0.01"
            value={state.volume}
            onChange={(e) => onChangeVolume(stemKey, parseFloat(e.target.value))}
            title={`Volume: ${Math.round(state.volume * 100)}%`}
            className="w-12 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          <div className="hidden md:flex items-center gap-1 w-16" title="Balanço Estéreo (L/R)">
            <span className="text-[9px] text-slate-500 font-mono">L</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={state.pan}
              onChange={(e) => onChangePan(stemKey, parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-400"
            />
            <span className="text-[9px] text-slate-500 font-mono">R</span>
          </div>
        </div>
      </div>

      {/* Onda Sonora Interativa */}
      <div
        onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
        onTouchStart={(e) => {
          if (e.touches?.[0]) seekFromClientX(e.touches[0].clientX, e.currentTarget);
        }}
        className="relative flex-1 h-full cursor-pointer select-none touch-pan-y"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none"
          style={{ left: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
    </div>
  );
};
