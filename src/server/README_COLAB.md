# 🚀 DAVI Studio AI - Guia de Conexão Backend & Extração de Áudio

Este documento explica como conectar o DAVI Studio a fontes reais de áudio e inteligência artificial para download direto do YouTube e separação em 4 stems (Vocais, Bateria, Baixo, Harmonia).

---

## 1. Google Colab (GPU T4 Gratuita - 1 Clique)

Você pode rodar a inteligência artificial **Demucs v4 (htdemucs)** e o **yt-dlp** em uma máquina com GPU potente na nuvem do Google de graça:

1. Acesse o [Google Colab](https://colab.research.google.com/) e clique em **Novo Notebook**.
2. No menu superior, vá em **Ambiente de Execução** > **Alterar tipo de ambiente de execução** e selecione **GPU T4**.
3. Crie uma célula de código, cole o conteúdo do arquivo `src/server/colab_runner.py` e aperte **Play**.
4. O script instalará o Demucs, yt-dlp e criará um túnel Cloudflare seguro. No final da execução, ele exibirá:
   ```text
   ============================================================
   ✅ SERVIDOR DAVI STUDIO ONLINE: https://exemplo-randomico.trycloudflare.com
   ============================================================
   ```
5. Abra o **DAVI Studio** (no celular ou computador), clique no ícone de **Servidor** no topo direito, cole essa URL e clique em **Salvar & Testar**.
6. Pronto! Agora qualquer link do YouTube colocado no app será baixado e separado com qualidade de estúdio profissional via IA!

---

## 2. Como Funciona o Cobalt (Open-Source Media Downloader)

O **Cobalt** (`imputnet/cobalt`) é o projeto de código aberto mais moderno e limpo para download de mídia do YouTube sem anúncios.
Você pode rodar sua própria instância do Cobalt via Docker:

```bash
docker run -d -p 9000:9000 --name cobalt-api ghcr.io/imputnet/cobalt:10
```

Ele expõe uma API REST rápida:
```bash
POST /
{
  "url": "https://www.youtube.com/watch?v=...",
  "downloadMode": "audio",
  "audioFormat": "mp3"
}
```

---

## 3. Atalho Y2Mate / Conversor Integrado no DAVI Studio

Para quem está usando o app diretamente no navegador ou celular sem nenhum servidor rodando:
1. Abra o modal **Adicionar & Separar Música**.
2. Cole o link do YouTube.
3. O app reconhece o vídeo, obtém o título, thumbnail e autor.
4. Clique em **Baixar no Y2Mate** ou **Baixar no Cobalt**. O link do vídeo já abre pronto para download em MP3.
5. Em 3 segundos após o download, solte o arquivo MP3 no campo **"Solte o MP3 baixado aqui para vincular"**.
6. O DAVI Studio faz a separação DSP Mid-Side (Vocais, Bateria, Baixo e Harmonia) diretamente no seu navegador, vincula com a capa do YouTube e salva no seu armazenamento local (IndexedDB)!

---

## 4. Link Direto de Áudio (MP3 / WAV da Web)

Na aba **Link MP3**, você pode colar qualquer URL direta de áudio (.mp3, .wav, .m4a) hospedada no Dropbox, Google Drive ou qualquer CDN pública. O app baixa o arquivo binário em tempo real, executa o motor DSP e salva na sua biblioteca.
