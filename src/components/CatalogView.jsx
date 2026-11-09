import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Play,
  Pause,
  ArrowRight,
  Music,
  Clock,
  Sparkles,
  Search,
  Upload,
  Link2,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Server,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const CatalogView = ({
  songs,
  onOpenSongInStudio,
  onOpenImportModal,
  onOpenBackendModal,
  backendOnline,
  processingJob,
  onDeleteSong,
  onResetCatalog,
  previewingId = null,
  onTogglePreview = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'presets' | 'imported'
  const [internalPreviewingId, setInternalPreviewingId] = useState(null);
  const [songToDelete, setSongToDelete] = useState(null);

  const activePreviewId = previewingId !== null ? previewingId : internalPreviewingId;

  const filteredSongs = songs.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.originalKey.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedFilter === 'presets') return !song.id.startsWith('local-') && !song.id.startsWith('yt-');
    if (selectedFilter === 'imported') return song.id.startsWith('local-') || song.id.startsWith('yt-');
    return true;
  });

  const togglePreview = (song) => {
    if (onTogglePreview) {
      onTogglePreview(song);
    } else {
      setInternalPreviewingId((prev) => (prev === song.id ? null : song.id));
    }
  };

  const confirmDelete = () => {
    if (songToDelete && onDeleteSong) {
      onDeleteSong(songToDelete.id);
      setSongToDelete(null);
    }
  };

  return (
    <div className="h-screen w-full bg-[#090D0B] text-slate-100 flex flex-col font-sans overflow-y-auto overscroll-contain">
      {/* Modal de Confirmação de Exclusão */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141C17] border border-rose-900/60 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Excluir Música?</h3>
                <p className="text-[11px] text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Tem certeza que deseja remover <strong className="text-white">"{songToDelete.title}"</strong> da sua biblioteca?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSongToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header do Catálogo */}
      <header className="sticky top-0 z-30 bg-[#0E1612]/95 backdrop-blur-md border-b border-emerald-950/90 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-emerald-300/30">
            <Sliders className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-white text-lg leading-none">
                DAVI
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                STUDIO AI
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Catálogo de Músicas & Separador de Stems
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenBackendModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14201A] hover:bg-slate-800 border border-emerald-900/50 text-xs font-semibold text-slate-300 transition-colors"
            title="Status do Servidor Python Demucs"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <Server className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[11px]">{backendOnline ? 'Demucs Online' : 'Servidor Python'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nova Música</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal do Catálogo com Rolagem Total */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6 pb-20">
        {/* Banner de Boas-Vindas & Busca */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#121C16] via-[#101914] to-[#0E1511] p-5 rounded-2xl border border-emerald-900/40 shadow-inner">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Minha Biblioteca de Faixas</span>
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Escolha uma música abaixo para abrir o estúdio interativo com controle individual de stems, cifras sincronizadas e transposição de tom em tempo real.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar título, artista ou tom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B100D] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Filtros em Abas + Botão Restaurar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({songs.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('presets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedFilter === 'presets'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Demonstrações Studio
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('imported')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedFilter === 'imported'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Importadas / Uploads
            </button>
          </div>

          {onResetCatalog && (
            <button
              type="button"
              onClick={onResetCatalog}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors px-2 py-1 rounded"
              title="Restaurar faixas padrão do catálogo"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar Catálogo</span>
            </button>
          )}
        </div>

        {/* Card de Processamento Ativo (se houver importação em andamento) */}
        {processingJob && (
          <div className="bg-gradient-to-r from-cyan-950/40 via-emerald-950/30 to-[#0F1612] border border-cyan-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-bold text-cyan-400">
                      Processando Nova Música
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                      IA Demucs v4 / DSP
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {processingJob.title}
                  </h3>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300 font-medium">
                <span>{processingJob.stepMessage}</span>
                <span className="font-mono text-cyan-400">{processingJob.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${processingJob.percent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Lista de Músicas do Catálogo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
              Faixas Prontas para Tocar ({filteredSongs.length})
            </span>
            <span className="text-xs text-slate-500">
              Role a página para ver todas as músicas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSongs.map((song) => {
              const minutes = Math.floor(song.duration / 60);
              const seconds = Math.floor(song.duration % 60);
              const durationFormatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

              return (
                <div
                  key={song.id}
                  className="group bg-[#111915] hover:bg-[#15211C] border border-emerald-950/80 hover:border-emerald-600/60 rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 shadow-lg shadow-black/30 hover:shadow-emerald-950/20"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Capa / Thumbnail da Música */}
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${
                        song.coverGradient || 'from-emerald-600 to-teal-900'
                      } flex items-center justify-center shrink-0 shadow-md border border-white/10 relative overflow-hidden`}
                    >
                      {song.thumbnail ? (
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-6 h-6 sm:w-7 sm:h-7 text-white/90" />
                      )}
                      <button
                        type="button"
                        onClick={() => togglePreview(song)}
                        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all ${
                          activePreviewId === song.id
                            ? 'opacity-100 bg-emerald-950/60'
                            : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
                        }`}
                        title={activePreviewId === song.id ? 'Pausar Prévia' : 'Tocar Prévia'}
                      >
                        {activePreviewId === song.id ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse">
                            <Pause className="w-4 h-4 fill-current" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/20 hover:bg-emerald-500 text-white hover:text-slate-950 flex items-center justify-center transition-colors">
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Informações da Faixa */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                          {song.title}
                        </h3>
                        {song.id.startsWith('yt-') && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0">
                            YouTube
                          </span>
                        )}
                        {song.id.startsWith('local-') && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shrink-0">
                            Upload
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {song.artist}
                      </p>

                      {/* Badges Técnicas */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#16241E] text-emerald-300 border border-emerald-900/50 font-bold">
                          Tom: {song.originalKey}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#16241E] text-slate-300 border border-slate-800">
                          {song.bpm} BPM
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#16241E] text-slate-400 border border-slate-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {durationFormatted}
                        </span>
                        <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          4 Stems + Click
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ação Principal: Abrir no Estúdio + Botão Deletar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                    <span className="text-[11px] text-slate-400">
                      Mixador, Cifras & Pitch Shifter
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Botão Deletar Visível em Todos os Cards */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSongToDelete(song);
                        }}
                        className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Excluir música da biblioteca"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenSongInStudio(song.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        <span>Abrir no Estúdio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bloco de Ações Rápidas de Importação */}
        <div className="bg-[#0F1713] border border-emerald-900/50 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Adicionar Nova Música para Separação</span>
              </h3>
              <p className="text-xs text-slate-400">
                Você pode importar qualquer áudio do seu celular/computador ou colar um link do YouTube.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="p-4 rounded-xl bg-[#14201A] hover:bg-[#182620] border border-slate-800 hover:border-emerald-500/60 text-left transition-all flex items-start gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/25">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300">
                  Enviar Arquivo MP3 / WAV / M4A
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Separação client-side via DSP Mid-Side com o áudio REAL do seu arquivo.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenImportModal}
              className="p-4 rounded-xl bg-[#14201A] hover:bg-[#182620] border border-slate-800 hover:border-cyan-500/60 text-left transition-all flex items-start gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/25">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300">
                  Link do YouTube (Demucs v4)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Extração neural com yt-dlp + Demucs v4 via servidor local ou modo simulação.
                </p>
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
