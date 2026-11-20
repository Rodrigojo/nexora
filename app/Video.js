'use client';
import { useEffect, useRef, useState } from 'react';
import { guardar } from '../lib/db/midia.js';

const W = 720, H = 1280, FPS = 30;

function carregar(src) {
  return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });
}

/** Cópia pequena (até 510 px) para servir de referência ao modelo de imagem. */
async function reduzir(src) {
  try {
    const img = await carregar(src);
    const k = Math.min(1, 510 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.9).split(',')[1];
  } catch { return null; }
}

function quebrar(ctx, texto, largura) {
  const linhas = []; let atual = '';
  for (const p of String(texto).split(/\s+/)) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 3);
}

/** Desenha um quadro: imagem cobrindo a tela vertical, com zoom e deslize, e a legenda embaixo. */
function quadro(ctx, img, p, idx, legenda, alpha = 1, soLegenda = false) {
  if (!soLegenda) desenhar(ctx, img, p, idx, alpha);
  if (!legenda || alpha < 1) return;
  ctx.font = 'bold 52px sans-serif';
  const linhas = quebrar(ctx, legenda, W - 120);
  const alto = linhas.length * 66 + 40;
  const y0 = H - 220 - alto;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(40, y0, W - 80, alto, 24) : ctx.rect(40, y0, W - 80, alto); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  linhas.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 22 + i * 66));
}

function desenhar(ctx, img, p, idx, alpha) {
  const z = [1.05 + 0.15 * p, 1.14, 1.22 - 0.15 * p][idx % 3]; // aproxima, desliza, afasta
  const escala = Math.max(W / img.width, H / img.height) * z;
  const w = img.width * escala, h = img.height * escala;
  const folga = w - W;
  const x = idx % 2 === 0 ? -folga * p : -folga * (1 - p); // alterna o lado do deslize
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

export default function Video({ video, refFoto, produto, midiaId, fotoAnimar }) {
  const [estado, setEstado] = useState('narracao'); // narracao | pronto | gravando | feito | erro
  const [pct, setPct] = useState(0);
  const [url, setUrl] = useState(null);
  const [ext, setExt] = useState('mp4');
  const [aviso, setAviso] = useState('');
  const somB64 = useRef(null);
  const cenas = useRef([]);
  const iniciou = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
      const voz = video.narracao ? post('/api/voz', { texto: video.narracao }).catch(() => ({})) : Promise.resolve({});
      const cena = (c, extra) => post('/api/cena', { prompt: c.prompt, ...extra })
        .then((d) => (d.imagem ? { ...d, legenda: c.legenda } : null)).catch(() => null);
      let feitas;
      if (video.animar && fotoAnimar) {
        // Animar foto: a própria foto em 3 movimentos de câmera diferentes.
        // Foto inteira no centro, fundo da própria foto desfocado (não corta o rosto).
        const img = await carregar(fotoAnimar);
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        const capa = Math.max(W / img.width, H / img.height);
        g.filter = 'blur(28px) brightness(0.7)';
        g.drawImage(img, (W - img.width * capa) / 2, (H - img.height * capa) / 2, img.width * capa, img.height * capa);
        g.filter = 'none';
        const cab = Math.min(W / img.width, (H * 0.8) / img.height);
        g.drawImage(img, (W - img.width * cab) / 2, (H - img.height * cab) / 2, img.width * cab, img.height * cab);
        const dados = cv.toDataURL('image/jpeg', 0.9).split(',')[1];
        feitas = video.cenas.map((c) => ({ mime: 'image/jpeg', imagem: dados, legenda: c.legenda }));
      } else if (refFoto) feitas = await Promise.all(video.cenas.map((c) => cena(c, { ref: refFoto, produto })));
      else if (video.personagem) {
        // Mesmo personagem em todas as cenas: a 1ª cena vira a referência das outras.
        const primeira = await cena(video.cenas[0], {});
        const ref = primeira && await reduzir(`data:${primeira.mime};base64,${primeira.imagem}`);
        const resto = await Promise.all(video.cenas.slice(1).map((c) => cena(c, ref ? { ref, personagem: true } : {})));
        feitas = [primeira, ...resto];
      } else feitas = await Promise.all(video.cenas.map((c) => cena(c, {})));
      cenas.current = feitas.filter(Boolean);
      const d = await voz;
      if (d.audio) somB64.current = d.audio; else if (video.narracao) setAviso('Sem narração desta vez. O vídeo sai só com legendas.');
      if (!vivo) return;
      if (cenas.current.length < (video.apresentador ? 1 : 2)) { setAviso('Não consegui criar as cenas agora (talvez o limite de imagens de hoje). Tente mais tarde.'); setEstado('erro'); return; }
      setEstado('pronto'); montar(true);
    })();
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function montar(automatico = false) {
    if (iniciou.current) return;
    iniciou.current = true;
    try {
      const lista = cenas.current;
      const imgs = await Promise.all(lista.map((c) => carregar(`data:${c.mime};base64,${c.imagem}`)));
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const stream = cv.captureStream(FPS);
      let ac = null, fonte = null, analisador = null, dur = imgs.length * 3;
      if (somB64.current) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        await ac.resume().catch(() => {});
        if (ac.state !== 'running') {
          if (automatico) { iniciou.current = false; ac.close(); setEstado('pronto'); return; } // precisa de um toque
        }
        const bytes = Uint8Array.from(atob(somB64.current), (c) => c.charCodeAt(0));
        const buf = await ac.decodeAudioData(bytes.buffer);
        fonte = ac.createBufferSource(); fonte.buffer = buf;
        const dest = ac.createMediaStreamDestination();
        fonte.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        if (video.apresentador) { analisador = ac.createAnalyser(); analisador.fftSize = 512; fonte.connect(analisador); }
        dur = video.apresentador ? buf.duration + 0.8 : Math.max(dur, buf.duration + 0.8);
      }
      const tipo = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,opus', 'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
      const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 3_000_000 });
      const partes = [];
      rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const fim = new Promise((ok) => { rec.onstop = ok; });
      setEstado('gravando');
      const porCena = dur / imgs.length;
      quadro(ctx, imgs[0], 0, 0, lista[0].legenda);
      rec.start(); // sem fatias: o arquivo sai inteiro e a galeria lê a duração certa
      fonte?.start();
      const t0 = performance.now();
      await new Promise((ok) => {
        const passo = () => {
          const t = (performance.now() - t0) / 1000;
          if (t >= dur) { ok(); return; }
          const i = Math.min(imgs.length - 1, Math.floor(t / porCena));
          const p = (t - i * porCena) / porCena;
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
          if (video.apresentador) {
            // Apresentador: a imagem "respira" com a voz e as legendas seguem a fala.
            let amp = 0;
            if (analisador) { const a = new Uint8Array(analisador.fftSize); analisador.getByteTimeDomainData(a); for (const v of a) amp = Math.max(amp, Math.abs(v - 128) / 128); }
            const k = 1 + 0.04 * amp;
            ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.scale(k, k); ctx.translate(-W / 2, -H * 0.45 - 6 * amp);
            quadro(ctx, imgs[i], t / dur, 0, '');
            ctx.restore();
            quadro(ctx, imgs[i], t / dur, 0, lista[i].legenda, 1, true);
          } else if (i > 0 && p < 0.12) { quadro(ctx, imgs[i - 1], 1, i - 1, '', 1); quadro(ctx, imgs[i], p, i, '', p / 0.12); }
          else quadro(ctx, imgs[i], p, i, lista[i].legenda);
          setPct(Math.round((t / dur) * 100));
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
      rec.stop(); await fim;
      ac?.close();
      const blob = new Blob(partes, { type: (rec.mimeType || tipo || 'video/webm').split(';')[0] });
      setExt(blob.type.includes('mp4') ? 'mp4' : 'webm');
      setUrl(URL.createObjectURL(blob)); setEstado('feito');
      if (midiaId) guardar(midiaId, blob);
    } catch (e) {
      console.error(e); setAviso(`Não consegui montar o vídeo neste aparelho. (código: ${String(e?.name || e?.message || e).slice(0, 40)})`); setEstado('erro');
    }
  }

  return (
    <div className="video-box">
      {estado === 'narracao' && <p className="hint">{video.apresentador ? 'Preparando o apresentador… (até 30 s)' : video.animar ? 'Preparando a narração… (até 20 s)' : 'Criando as cenas e a narração… (até 40 s)'}</p>}
      {estado === 'pronto' && <button type="button" onClick={() => montar(false)}>🎬 Montar vídeo</button>}
      {estado === 'gravando' && <p className="hint">Montando o vídeo… {pct}% (deixe esta tela aberta)</p>}
      {estado === 'feito' && url && (
        <>
          <video className="video-gerado" src={url} controls playsInline />
          <a className="baixar" href={url} download={`nexora-video.${ext}`}>⬇️ Baixar vídeo</a>
        </>
      )}
      {aviso && <p className="ouvir-erro">{aviso}</p>}
    </div>
  );
}
