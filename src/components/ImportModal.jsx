import React from 'react';
import { Sparkles, X, RefreshCw, AlertCircle, Upload } from 'lucide-react';

export const ImportModal = ({
  showImportModal,
  setShowImportModal,
  isProcessingImport,
  processingStep,
  youtubeUrl,
  setYoutubeUrl,
  handleYoutubeImport,
  handleLocalFileUpload,
  backendOnline
}) => {
  if (!showImportModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131824] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Separar Nova Música (YouTube ou Arquivo)
              </h3>
              <p className="text-[11px] text-slate-400">
                Extrai Vocais, Bateria, Baixo, Harmonia, BPM e Acordes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isProcessingImport && setShowImportModal(false)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isProcessingImport ? (
          <div className="py-6 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <div className="text-xs font-semibold text-white">{processingStep}</div>
            <p className="text-[11px] text-slate-400">
              Preparando formas de onda e sincronizando grade de acordes...
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleYoutubeImport} className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                1. Importar via Link do YouTube (yt-dlp + Demucs)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1 bg-[#0D111A] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shrink-0 transition-colors"
                >
                  Extrair & Separar
                </button>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  {backendOnline
                    ? 'Conectado ao servidor Python local (localhost:8000).'
                    : 'Servidor Python offline — usará simulação instantânea ou envie um arquivo abaixo.'}
                </span>
              </p>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="shrink mx-3 text-[10px] uppercase text-slate-500 font-semibold">
                ou envie do seu aparelho
              </span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <div>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-4 cursor-pointer bg-[#0E121C] transition-colors text-center">
                <Upload className="w-6 h-6 text-cyan-400 mb-1.5" />
                <span className="text-xs font-semibold text-slate-200">
                  Selecionar arquivo .MP3, .WAV ou .M4A
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Processamento direto no navegador em 4 faixas + Smart Metrônomo
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleLocalFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
