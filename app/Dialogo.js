'use client';
import { useEffect, useRef, useState } from 'react';
import { guardar } from '../lib/db/midia.js';

// Vídeo com 2 personagens conversando: cada um com sua imagem e sua voz.
// Quem fala aparece grande e "respira" com a voz; o outro fica pequeno no canto. Legenda com o nome.
const W = 720, H = 1280, FPS = 30;
const carregar = (src) => new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });

function cobrir(ctx, img, x, y, w, h, zoom = 1) {
  const k = Math.max(w / img.width, h / img.height) * zoom;
  const iw = img.width * k, ih = img.height * k;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * 0.35, iw, ih);
  ctx.restore();
}
function quebrar(ctx, texto, largura) {
  const linhas = []; let atual = '';
  for (const p of String(texto).split(/\s+/)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width > largura && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 4);
}

export default function Dialogo({ dialogo, midiaId }) {
  const [estado, setEstado] = useState('preparando');
  const [pct, setPct] = useState(0);
  const [url, setUrl] = useState(null);
  const [ext, setExt] = useState('mp4');
  const [aviso, setAviso] = useState('');
  const imgs = useRef([]);
  const som = useRef(null);
  const iniciou = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => ({}));
      const voz = post('/api/voz', { dialogo: { personagens: dialogo.personagens, falas: dialogo.falas } });
      const fotos = await Promise.all(dialogo.personagens.map((p) => post('/api/cena', { prompt: p.prompt })));
      const d = await voz;
      if (!vivo) return;
      if (fotos.some((f) => !f.imagem)) { setAviso('Não consegui criar os personagens agora (talvez o limite de imagens de hoje, que volta às 21h). Tente mais tarde.'); setEstado('erro'); return; }
      if (!d.audio) { setAviso('Não consegui criar as vozes agora. Tente de novo em alguns minutos.'); setEstado('erro'); return; }
      imgs.current = await Promise.all(fotos.map((f) => carregar(`data:${f.mime};base64,${f.imagem}`)));
      som.current = d.audio;
      setEstado('pronto'); montar(true);
    })();
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function montar(automatico = false) {
    if (iniciou.current) return;
    iniciou.current = true;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      await ac.resume().catch(() => {});
      if (ac.state !== 'running' && automatico) { iniciou.current = false; ac.close(); return; }
      const bytes = Uint8Array.from(atob(som.current), (c) => c.charCodeAt(0));
      const buf = await ac.decodeAudioData(bytes.buffer);
      const fonte = ac.createBufferSource(); fonte.buffer = buf;
      const dest = ac.createMediaStreamDestination(); fonte.connect(dest);
      const an = ac.createAnalyser(); an.fftSize = 512; fonte.connect(an);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const stream = cv.captureStream(FPS);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      // Tempo de cada fala proporcional ao tamanho do texto (pausa curta entre falas).
      const falas = dialogo.falas;
      const pesos = falas.map((f) => f.texto.length + 12);
      const soma = pesos.reduce((a, b) => a + b, 0);
      let acc = 0;
      const marcos = pesos.map((p) => { const ini = acc; acc += (p / soma) * buf.duration; return [ini, acc]; });
      const dur = buf.duration + 0.6;
      const tipo = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
      const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 3_000_000 });
      const partes = [];
      rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const parou = new Promise((ok) => { rec.onstop = ok; });
      setEstado('gravando');
      const a = new Uint8Array(an.fftSize);
      const desenhar = (t) => {
        let i = marcos.findIndex(([, f]) => t < f); if (i < 0) i = falas.length - 1;
        const quem = falas[i].p, outro = quem ? 0 : 1;
        an.getByteTimeDomainData(a); let amp = 0; for (const v of a) amp = Math.max(amp, Math.abs(v - 128) / 128);
        const [ini, fim] = marcos[i]; const p = Math.min(1, (t - ini) / Math.max(0.1, fim - ini));
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        cobrir(ctx, imgs.current[quem], 0, 0, W, H, 1.04 + 0.05 * p + 0.035 * amp);
        // O outro personagem, pequeno no canto de cima.
        const pw = 210, ph = 280, px = W - pw - 28, py = 40;
        ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle = '#fff'; ctx.fillRect(px - 5, py - 5, pw + 10, ph + 10); ctx.restore();
        cobrir(ctx, imgs.current[outro], px, py, pw, ph, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(px, py + ph - 40, pw, 40);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(dialogo.personagens[outro].nome, px + pw / 2, py + ph - 20);
        // Legenda: nome de quem fala + fala.
        ctx.font = 'bold 46px sans-serif';
        const linhas = quebrar(ctx, falas[i].texto, W - 110);
        const alto = linhas.length * 60 + 100;
        const y0 = H - 140 - alto;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect?.(40, y0, W - 80, alto, 24); ctx.fill();
        ctx.fillStyle = quem ? '#ff9ad5' : '#7fd8ff'; ctx.font = 'bold 38px sans-serif';
        ctx.fillText(dialogo.personagens[quem].nome, W / 2, y0 + 42);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 46px sans-serif';
        linhas.forEach((l, k) => ctx.fillText(l, W / 2, y0 + 100 + k * 60));
      };
      desenhar(0);
      rec.start(); fonte.start();
      const t0 = performance.now();
      await new Promise((ok) => {
        const passo = () => {
          const t = (performance.now() - t0) / 1000;
          if (t >= dur) { ok(); return; }
          desenhar(t); setPct(Math.round((t / dur) * 100));
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
      rec.stop(); await parou; ac.close();
      const blob = new Blob(partes, { type: (rec.mimeType || tipo || 'video/webm').split(';')[0] });
      setExt(blob.type.includes('mp4') ? 'mp4' : 'webm');
      setUrl(URL.createObjectURL(blob)); setEstado('feito');
      if (midiaId) guardar(midiaId, blob);
    } catch (e) {
      console.error(e); setAviso('Não consegui montar o vídeo neste aparelho.'); setEstado('erro');
    }
  }

  return (
    <div className="video-box">
      {estado === 'preparando' && <p className="hint">Criando os personagens e as vozes… (até 40 s)</p>}
      {estado === 'pronto' && <button type="button" onClick={() => montar(false)}>🎬 Montar vídeo</button>}
      {estado === 'gravando' && <p className="hint">Montando o vídeo… {pct}% (deixe esta tela aberta)</p>}
      {estado === 'feito' && url && (
        <>
          <video className="video-gerado" src={url} controls playsInline />
          <a className="baixar" href={url} download={`nexora-conversa.${ext}`}>⬇️ Baixar vídeo</a>
        </>
      )}
      {aviso && <p className="ouvir-erro">{aviso}</p>}
    </div>
  );
}
