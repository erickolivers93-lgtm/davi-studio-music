import React, { useState } from 'react';
import { Terminal, X, Copy, Check, Cpu, Globe, Server, RefreshCw } from 'lucide-react';
import { PYTHON_SERVER_CODE, COLAB_NOTEBOOK_CODE } from '../constants/musicConstants';

export const BackendModal = ({
  showBackendModal,
  setShowBackendModal,
  backendOnline,
  checkLocalBackend,
  backendUrl,
  setBackendUrl
}) => {
  const [activeTab, setActiveTab] = useState('colab'); // 'colab' | 'local' | 'docker'
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputUrl, setInputUrl] = useState(backendUrl || 'http://localhost:8000');
  const [isTesting, setIsTesting] = useState(false);

  if (!showBackendModal) return null;

  const handleSaveAndTest = async (e) => {
    e.preventDefault();
    const clean = inputUrl.trim().replace(/\/+$/, '');
    setBackendUrl(clean);
    localStorage.setItem('davi_studio_backend_url', clean);
    setIsTesting(true);
    await checkLocalBackend(clean);
    setIsTesting(false);
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#121A15] border border-emerald-900/60 rounded-2xl max-w-3xl w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Servidor de IA & Extração (yt-dlp + Demucs v4)
              </h3>
              <p className="text-[11px] text-slate-400">
                Conecte seu backend local ou na nuvem para download direto do YouTube e separação neural
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBackendModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuração da URL do Servidor */}
        <form onSubmit={handleSaveAndTest} className="p-3 rounded-xl bg-[#0D1310] border border-emerald-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>URL do Servidor / Túnel Colab:</span>
            </label>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              backendOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {backendOnline ? 'Conectado & Pronto' : 'Desconectado'}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="ex: http://localhost:8000 ou https://xxxx.trycloudflare.com"
              className="flex-1 bg-[#121A15] border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
            >
              {isTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Salvar & Testar</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Dica: Se estiver rodando o Google Colab, cole o link seguro <code>.trycloudflare.com</code> acima para usar pelo celular!
          </p>
        </form>

        {/* Abas de Opções de Backend */}
        <div className="grid grid-cols-3 gap-1 bg-[#0D1310] p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('colab')}
            className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'colab'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Google Colab (GPU Grátis)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'local'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Servidor Local (Python)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('docker')}
            className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'docker'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Cobalt / Docker</span>
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0B0E14] border border-slate-800 rounded-xl">
          {activeTab === 'colab' && (
            <>
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#0F141C] border-b border-slate-800 text-xs">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span>⚡ 1-Clique no Google Colab com GPU T4 Gratuita</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(COLAB_NOTEBOOK_CODE)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Código Copiado' : 'Copiar Script Colab'}</span>
                </button>
              </div>
              <div className="p-3 text-[11px] font-mono text-slate-300 overflow-y-auto flex-1 leading-relaxed space-y-2">
                <div className="text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <p className="text-white font-bold mb-1">Como usar no Google Colab em 3 passos:</p>
                  1. Acesse <strong>colab.research.google.com</strong> e crie um novo notebook.<br />
                  2. Vá em <em>Ambiente de execução &gt; Alterar tipo</em> e escolha <strong>GPU T4</strong>.<br />
                  3. Cole o código abaixo e execute. Ele exibirá um link <code>.trycloudflare.com</code> para colar no campo acima!
                </div>
                <pre className="text-emerald-300/90 whitespace-pre-wrap">{COLAB_NOTEBOOK_CODE}</pre>
              </div>
            </>
          )}

          {activeTab === 'local' && (
            <>
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#0F141C] border-b border-slate-800 text-xs">
                <span className="text-slate-300 font-mono">server.py</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(PYTHON_SERVER_CODE)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Código Copiado' : 'Copiar server.py'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-y-auto flex-1 leading-relaxed whitespace-pre-wrap">
                {PYTHON_SERVER_CODE}
              </pre>
            </>
          )}

          {activeTab === 'docker' && (
            <div className="p-4 text-xs text-slate-300 space-y-3 overflow-y-auto">
              <h4 className="font-bold text-white text-sm">Opção Open-Source Cobalt (Docker / API)</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                O <strong>Cobalt</strong> (<code>imputnet/cobalt</code>) é o projeto open source mais moderno para downloads sem anúncios do YouTube em MP3.
                Você pode subir sua própria instância com 1 único comando no seu computador ou servidor (Railway, Render, VPS):
              </p>
              <pre className="p-3 rounded-lg bg-[#070A0E] border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                docker run -d -p 9000:9000 --name cobalt-api ghcr.io/imputnet/cobalt:10
              </pre>
              <p className="text-slate-400 text-xs leading-relaxed">
                Ele expõe um endpoint REST limpo <code>POST /</code> com parâmetro <code>{`{ "url": "...", "downloadMode": "audio" }`}</code> que retorna o MP3 direto com CORS liberado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
