import React, { useState } from 'react';
import { Sparkles, X, RefreshCw, AlertCircle, Upload, Link2, Music2, CheckCircle2 } from 'lucide-react';

export const ImportModal = ({
  showImportModal,
  setShowImportModal,
  isProcessingImport,
  processingStep,
  youtubeUrl,
  setYoutubeUrl,
  handleYoutubeImport,
  handleLocalFileUpload,
  handleLoadDemoTrack,
  backendOnline
}) => {
  const [activeImportTab, setActiveImportTab] = useState('youtube'); // 'youtube' | 'file' | 'demo'

  if (!showImportModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#121A15] border border-emerald-900/60 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Adicionar & Separar Música
              </h3>
              <p className="text-[11px] text-slate-400">
                Extração em 4 Stems (Vocais, Bateria, Baixo, Harmonia) + Smart Metrônomo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isProcessingImport && setShowImportModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Opções */}
        <div className="grid grid-cols-3 gap-1 bg-[#0D1310] p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveImportTab('youtube')}
            className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeImportTab === 'youtube'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>YouTube</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportTab('file')}
            className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeImportTab === 'file'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Arquivo Local</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportTab('demo')}
            className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeImportTab === 'demo'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Demo Áudio</span>
          </button>
        </div>

        {/* Estado de Processamento Ativo */}
        {isProcessingImport ? (
          <div className="py-8 text-center space-y-3.5">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Processando Separação de Áudio</h4>
              <p className="text-xs text-emerald-300 font-medium">{processingStep}</p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Gerando canais de áudio, sintetizando grade harmônica e sincronizando metrônomo...
            </p>
          </div>
        ) : (
          <>
            {/* Aba 1: YouTube */}
            {activeImportTab === 'youtube' && (
              <form onSubmit={handleYoutubeImport} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cole a URL do vídeo do YouTube:
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full bg-[#0D1310] border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-[#0F1713] border border-emerald-900/40 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Como funciona a extração do YouTube:</span>
                  </div>
                  <p className="text-slate-400">
                    • Identificamos título, artista e arte do vídeo automaticamente.<br />
                    • Com o servidor Python local ativo, executamos a IA <strong>Demucs v4</strong>.<br />
                    • No navegador sem servidor, geramos um arranjo multitrack exclusivo sincronizado para você testar imediatamente!
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Extrair & Adicionar à Biblioteca</span>
                </button>
              </form>
            )}

            {/* Aba 2: Arquivo Local (MP3/WAV) */}
            {activeImportTab === 'file' && (
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-800/80 hover:border-emerald-400 rounded-xl p-6 cursor-pointer bg-[#0D1310] transition-colors text-center group">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-200">
                    Toque para selecionar áudio do aparelho
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    Formatos suportados: .MP3, .WAV, .M4A, .AAC, .OGG
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold mt-2 px-2 py-0.5 rounded bg-emerald-500/15">
                    ⚡ 100% Separação DSP Client-side (Custo Zero)
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleLocalFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Aba 3: Demonstração Rápida */}
            {activeImportTab === 'demo' && (
              <div className="space-y-3 text-center">
                <div className="p-4 rounded-xl bg-[#0D1310] border border-slate-800 text-left space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Testar Separação com Faixa de Demonstração</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Carregue uma faixa de alta definição instantaneamente para ver o processo de separação em tempo real no seu dispositivo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLoadDemoTrack}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <Music2 className="w-4 h-4" />
                  <span>Carregar Faixa de Demonstração</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
