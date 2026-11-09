import React from 'react';

export const SidebarLibrary = ({
  songs,
  activeSong,
  setActiveSongId,
  mobileTab,
  setMobileTab,
  applyMixPreset
}) => {
  return (
    <aside
      className={`${
        mobileTab === 'library' ? 'flex' : 'hidden'
      } lg:flex w-full lg:w-60 bg-[#0D1411] border-b lg:border-b-0 lg:border-r border-emerald-950/80 p-3 flex-col justify-between gap-3 shrink-0 overflow-y-auto`}
    >
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Músicas DAVI
            </span>
            <span className="text-[10px] text-emerald-400/80 font-mono">{songs.length} faixas</span>
          </div>
          <div className="space-y-1.5">
            {songs.map((song) => {
              const active = song.id === activeSong.id;
              return (
                <button
                  type="button"
                  key={song.id}
                  onClick={() => {
                    setActiveSongId(song.id);
                    setMobileTab('mixer');
                  }}
                  className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                      : 'bg-[#131C18] border-slate-800/60 text-slate-300 hover:border-emerald-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{song.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{song.artist}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 block">
                      {song.originalKey}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Presets Rápidos
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => applyMixPreset('all')}
              className="p-1.5 rounded-lg bg-[#131C18] hover:bg-emerald-950/50 border border-slate-800 text-left text-[11px] text-slate-200"
            >
              Mix Completa
            </button>
            <button
              type="button"
              onClick={() => applyMixPreset('no-vocals')}
              className="p-1.5 rounded-lg bg-[#131C18] hover:bg-emerald-950/50 border border-slate-800 text-left text-[11px] text-slate-200"
            >
              Karaokê
            </button>
            <button
              type="button"
              onClick={() => applyMixPreset('no-drums')}
              className="p-1.5 rounded-lg bg-[#131C18] hover:bg-emerald-950/50 border border-slate-800 text-left text-[11px] text-slate-200"
            >
              Sem Bateria
            </button>
            <button
              type="button"
              onClick={() => applyMixPreset('no-bass')}
              className="p-1.5 rounded-lg bg-[#131C18] hover:bg-emerald-950/50 border border-slate-800 text-left text-[11px] text-slate-200"
            >
              Sem Baixo
            </button>
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-[#121D18] border border-emerald-900/40 text-[10px] text-slate-400">
        DAVI Studio AI • Multiplataforma & PWA Offline Ready.
      </div>
    </aside>
  );
};
