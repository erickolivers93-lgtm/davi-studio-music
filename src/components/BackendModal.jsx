import React, { useState } from 'react';
import { Terminal, X, Copy, Check } from 'lucide-react';
import { PYTHON_SERVER_CODE } from '../constants/musicConstants';

export const BackendModal = ({
  showBackendModal,
  setShowBackendModal,
  backendOnline,
  checkLocalBackend
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!showBackendModal) return null;

  const copyPythonToClipboard = () => {
    const textArea = document.createElement('textarea');
    textArea.value = PYTHON_SERVER_CODE;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131824] border border-slate-800 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Servidor Local em Python (Custo Zero)
              </h3>
              <p className="text-[11px] text-slate-400">
                Rode localmente na sua máquina e migre o mesmo código para o Google Colab depois
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBackendModal(false)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-[#0D111A] border border-slate-800">
            <div className="font-bold text-cyan-400 mb-1">1. Instalar Dependências</div>
            <code className="text-[10px] text-slate-300 font-mono block">
              pip install fastapi uvicorn yt-dlp demucs librosa soundfile python-multipart
            </code>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0D111A] border border-slate-800">
            <div className="font-bold text-cyan-400 mb-1">2. Iniciar o Servidor</div>
            <code className="text-[10px] text-slate-300 font-mono block">
              python server.py
            </code>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0D111A] border border-slate-800 flex flex-col justify-between">
            <div className="font-bold text-cyan-400 mb-1">3. Status da Conexão</div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-300">
                {backendOnline ? 'Online em localhost:8000' : 'Aguardando localhost:8000'}
              </span>
              <button
                type="button"
                onClick={checkLocalBackend}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300"
              >
                Testar
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-[#0B0E14] border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2 bg-[#10141F] border-b border-slate-800">
            <span className="text-xs font-mono text-slate-300">server.py</span>
            <button
              type="button"
              onClick={copyPythonToClipboard}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Código Copiado' : 'Copiar server.py'}</span>
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-y-auto flex-1 leading-relaxed">
            {PYTHON_SERVER_CODE}
          </pre>
        </div>
      </div>
    </div>
  );
};
