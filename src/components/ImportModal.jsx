import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  RefreshCw,
  AlertCircle,
  Upload,
  Link2,
  Music2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Radio,
  FileAudio
} from 'lucide-react';
import { parseYoutubeId } from '../constants/musicConstants';

export const ImportModal = ({
  showImportModal,
  setShowImportModal,
  isProcessingImport,
  processingStep,
  youtubeUrl,
  setYoutubeUrl,
  handleYoutubeImport,
  handleLocalFileUpload,
  handleAudioUrlImport,
  handleYoutubeDirectMp3Upload,
  handleLoadDemoTrack,
  backendOnline,
  onOpenBackendModal
}) => {
  const [activeImportTab, setActiveImportTab] = useState('youtube'); // 'youtube' | 'url' | 'file' | 'demo'
  const [directAudioUrl, setDirectAudioUrl] = useState('');
  const [ytPreview, setYtPreview] = useState(null);

  // Detecta se a URL do YouTube é válida para mostrar thumbnail e atalhos
  useEffect(() => {
    const id = parseYoutubeId(youtubeUrl);
    if (id) {
      setYtPreview({
        id,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        y2mateUrl: `https://y2mate.nu/`,
        cobaltUrl: `https://cobalt.tools/`
      });
    } else {
      setYtPreview(null);
    }
  }, [youtubeUrl]);

  if (!showImportModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#121A15] border border-emerald-900/60 rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
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
        <div className="grid grid-cols-4 gap-1 bg-[#0D1310] p-1 rounded-xl border border-slate-800/80 text-[11px] sm:text-xs">
          <button
            type="button"
            onClick={() => setActiveImportTab('youtube')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors ${
              activeImportTab === 'youtube'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span>YouTube</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportTab('url')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors ${
              activeImportTab === 'url'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Link MP3</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportTab('file')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors ${
              activeImportTab === 'file'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span>Arquivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportTab('demo')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors ${
              activeImportTab === 'demo'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Music2 className="w-3.5 h-3.5 shrink-0" />
            <span>Demo</span>
          </button>
        </div>

        {/* Estado de Processamento Ativo */}
        {isProcessingImport ? (
          <div className="py-8 text-center space-y-3.5">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Processando Áudio & Separando Stems</h4>
              <p className="text-xs text-emerald-300 font-medium">{processingStep}</p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Decodificando frequências, isolando vocais/bateria/baixo/harmonia e sincronizando metrônomo...
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Aba 1: YouTube & Conversor */}
            {activeImportTab === 'youtube' && (
              <div className="space-y-3">
                <form onSubmit={handleYoutubeImport} className="space-y-2.5">
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

                  {/* Status do Backend de IA */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0D1310] border border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Radio className={`w-3.5 h-3.5 ${backendOnline ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                      <span className="text-slate-300">
                        {backendOnline ? (
                          <strong className="text-emerald-300">Servidor IA Conectado (Demucs v4)</strong>
                        ) : (
                          'Servidor IA Local / Colab: Desconectado'
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenBackendModal}
                      className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                    >
                      {backendOnline ? 'Configurar' : 'Conectar Servidor'}
                    </button>
                  </div>

                  {/* Se o YouTube ID foi detectado */}
                  {ytPreview && (
                    <div className="p-3 rounded-xl bg-[#0F1713] border border-emerald-900/50 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={ytPreview.thumbnail}
                          alt="Thumbnail do YouTube"
                          className="w-20 h-14 object-cover rounded-lg border border-slate-800 shrink-0"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            Vídeo Identificado
                          </p>
                          <p className="text-[10px] text-slate-400">
                            ID: {ytPreview.id}
                          </p>
                          <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            Capa & Metadados Prontos
                          </span>
                        </div>
                      </div>

                      {/* Se o Backend NÃO estiver online, oferece ponte inteligente Y2Mate / MP3 */}
                      {!backendOnline && (
                        <div className="pt-2 border-t border-emerald-950 space-y-2">
                          <p className="text-[11px] text-slate-300 font-medium">
                            Como obter o MP3 real deste vídeo sem servidor:
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={ytPreview.y2mateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                            >
                              <span>Baixar no Y2Mate</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            <a
                              href={ytPreview.cobaltUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                            >
                              <span>Baixar no Cobalt</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {/* Dropzone para vincular o MP3 diretamente à música do YouTube */}
                          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/20 cursor-pointer text-center group transition-colors">
                            <FileAudio className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-emerald-200">
                              Solte o MP3 baixado aqui para vincular
                            </span>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => handleYoutubeDirectMp3Upload(e, ytPreview)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {backendOnline
                        ? 'Extrair com IA Demucs v4'
                        : 'Importar para a Biblioteca'}
                    </span>
                  </button>
                </form>
              </div>
            )}

            {/* Aba 2: Link Direto de Áudio (MP3 / WAV da Web) */}
            {activeImportTab === 'url' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (directAudioUrl.trim()) handleAudioUrlImport(directAudioUrl.trim());
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cole o link direto do arquivo de áudio (.MP3, .WAV, .M4A):
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/musica.mp3 ou link direto do Dropbox/Drive"
                    value={directAudioUrl}
                    onChange={(e) => setDirectAudioUrl(e.target.value)}
                    className="w-full bg-[#0D1310] border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-[#0F1713] border border-emerald-900/40 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Importação direta da web:</span>
                  </div>
                  <p className="text-slate-400">
                    • Baixa o áudio binário diretamente no seu navegador.<br />
                    • Executa a separação DSP Mid-Side no aparelho (Vocais, Bateria, Baixo, Harmonia).<br />
                    • Salva no seu armazenamento local (IndexedDB) para tocar offline.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <Globe className="w-4 h-4" />
                  <span>Baixar Áudio & Separar 4 Stems</span>
                </button>
              </form>
            )}

            {/* Aba 3: Arquivo do Aparelho */}
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

            {/* Aba 4: Demonstração Rápida */}
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
          </div>
        )}
      </div>
    </div>
  );
};
