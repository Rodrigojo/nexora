'use client';
import { useEffect, useRef, useState } from 'react';
import { guardar } from '../lib/db/midia.js';

// Capacidade 12: edição de vídeo feita no próprio celular (nada vai para a internet, não gasta limite).
const FILTROS = { Normal: 'none', 'Preto e branco': 'grayscale(1)', 'Cores vivas': 'saturate(1.5) contrast(1.1)', Quente: 'sepia(0.35) saturate(1.3)', Clarear: 'brightness(1.2)' };
const VELOCIDADES = [0.5, 1, 1.5, 2];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function quebrar(ctx, texto, largura) {
  const linhas = []; let atual = '';
  for (const p of String(texto).split(/\s+/)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width > largura && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 3);
}

export default function EditorVideo({ midiaId, pedido }) {
  const arquivo = useRef(null);
  const vid = useRef(null);
  const audio = useRef(null); // { ac, fonte } — o navegador só deixa ligar o som do vídeo uma vez
  const [src, setSrc] = useState(null);
  const [dur, setDur] = useState(0);
  const [ini, setIni] = useState(0);
  const [fim, setFim] = useState(0);
  const [vel, setVel] = useState(1);
  const [texto, setTexto] = useState('');
  const [posTexto, setPosTexto] = useState('baixo');
  const [filtro, setFiltro] = useState('Normal');
  const [mudo, setMudo] = useState(false);
  const [estado, setEstado] = useState('escolher'); // escolher | editar | gravando | feito | erro
  const [prog, setProg] = useState(0);
  const [url, setUrl] = useState(null);
  const [ext, setExt] = useState('mp4');
  const [auto, setAuto] = useState(''); // '' | 'analisando' | 'pronto'

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  function escolher(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    audio.current = null; setUrl(null); setSrc(URL.createObjectURL(f)); setEstado('editar');
  }
  function carregou() {
    const d = vid.current?.duration || 0;
    setDur(d); setIni(0); setFim(d);
  }
  function ver(t) { if (vid.current) { vid.current.currentTime = t; } }

  // ✨ Editar sozinho: tira 4 quadros do vídeo, a IA decide e o vídeo é gerado na hora.
  async function editarSozinho() {
    const v = vid.current; if (!v || !dur) return;
    setAuto('analisando');
    try {
      const k = Math.min(1, 320 / Math.max(v.videoWidth || 320, v.videoHeight || 320));
      const cv = document.createElement('canvas'); cv.width = Math.round((v.videoWidth || 320) * k); cv.height = Math.round((v.videoHeight || 320) * k);
      const g = cv.getContext('2d');
      const quadros = [];
      for (const f of [0.1, 0.35, 0.6, 0.85]) {
        const t = dur * f;
        v.currentTime = t;
        await new Promise((ok) => { v.onseeked = () => { v.onseeked = null; ok(); }; });
        g.drawImage(v, 0, 0, cv.width, cv.height);
        quadros.push({ t, data: cv.toDataURL('image/jpeg', 0.7).split(',')[1] });
      }
      const r = await fetch('/api/editar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quadros, duracao: dur, pedido }) }).then((x) => x.json());
      if (r.erro) { setAuto(''); alert(r.erro); return; }
      setIni(r.inicio); setFim(Math.min(dur, r.fim)); setVel(r.velocidade); setFiltro(r.filtro); setTexto(r.texto); setPosTexto(r.posicao);
      setAuto('pronto');
    } catch { setAuto(''); }
  }
  useEffect(() => { if (auto === 'pronto') { setAuto(''); gerar(); } }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps

  async function gerar() {
    const v = vid.current; if (!v) return;
    setEstado('gravando'); setProg(0);
    try {
      const largura0 = v.videoWidth || 720, altura0 = v.videoHeight || 1280;
      const k = Math.min(1, 1280 / Math.max(largura0, altura0));
      const W = Math.round(largura0 * k / 2) * 2, H = Math.round(altura0 * k / 2) * 2;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const stream = cv.captureStream(30);
      let dest = null;
      if (!mudo) {
        if (!audio.current) {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          const fonte = ac.createMediaElementSource(v);
          fonte.connect(ac.destination);
          audio.current = { ac, fonte };
        }
        const { ac, fonte } = audio.current;
        await ac.resume().catch(() => {});
        dest = ac.createMediaStreamDestination();
        fonte.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      v.muted = mudo; v.playbackRate = vel; v.preservesPitch = true;
      v.currentTime = ini;
      await new Promise((ok) => { v.onseeked = () => { v.onseeked = null; ok(); }; });
      const tipo = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
      const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 4_000_000 });
      const partes = [];
      rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const parou = new Promise((ok) => { rec.onstop = ok; });
      const desenhar = () => {
        ctx.filter = FILTROS[filtro]; ctx.drawImage(v, 0, 0, W, H); ctx.filter = 'none';
        if (texto.trim()) {
          const tam = Math.round(W / 13);
          ctx.font = `bold ${tam}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const linhas = quebrar(ctx, texto.trim(), W * 0.86);
          const alto = linhas.length * tam * 1.25;
          const y0 = posTexto === 'cima' ? H * 0.1 : posTexto === 'meio' ? (H - alto) / 2 : H * 0.88 - alto;
          linhas.forEach((l, i) => {
            const y = y0 + tam * 0.62 + i * tam * 1.25;
            ctx.lineWidth = tam / 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(l, W / 2, y);
            ctx.fillStyle = '#fff'; ctx.fillText(l, W / 2, y);
          });
        }
      };
      desenhar();
      rec.start();
      await v.play();
      await new Promise((ok) => {
        const passo = () => {
          desenhar();
          setProg(Math.min(1, (v.currentTime - ini) / Math.max(0.1, fim - ini)));
          if (v.currentTime >= fim || v.ended) ok(); else requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
      v.pause(); rec.stop(); await parou;
      if (dest && audio.current) { try { audio.current.fonte.disconnect(dest); } catch {} }
      const blob = new Blob(partes, { type: (rec.mimeType || tipo || 'video/webm').split(';')[0] });
      setExt(blob.type.includes('mp4') ? 'mp4' : 'webm');
      setUrl(URL.createObjectURL(blob)); setEstado('feito');
      if (midiaId) guardar(midiaId, blob);
    } catch (e) {
      console.error('editor', e); setEstado('erro');
    }
  }

  const durFinal = Math.max(0, (fim - ini) / vel);
  return (
    <div className="editor-video">
      <input ref={arquivo} type="file" accept="video/*" hidden onChange={escolher} />
      {estado === 'escolher' && <button type="button" onClick={() => arquivo.current?.click()}>📂 Escolher vídeo do celular</button>}
      {src && estado !== 'feito' && (
        <>
          <video ref={vid} src={src} playsInline controls={estado === 'editar'} onLoadedMetadata={carregou}
            style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 12, filter: FILTROS[filtro] }} />
          {estado === 'editar' && dur > 0 && (
            <div className="controles" style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={editarSozinho} disabled={auto === 'analisando'}>{auto === 'analisando' ? '⏳ A IA está assistindo o vídeo…' : '✨ Editar sozinho (a IA decide tudo)'}</button>
              <p className="hint" style={{ margin: 0 }}>Ou ajuste você mesmo:</p>
              <label>✂️ Começa em {fmt(ini)}
                <input type="range" min={0} max={dur} step={0.1} value={ini} style={{ width: '100%' }}
                  onChange={(e) => { const x = Math.min(+e.target.value, fim - 0.5); setIni(x); ver(x); }} /></label>
              <label>✂️ Termina em {fmt(fim)}
                <input type="range" min={0} max={dur} step={0.1} value={fim} style={{ width: '100%' }}
                  onChange={(e) => { const x = Math.max(+e.target.value, ini + 0.5); setFim(x); ver(x); }} /></label>
              <div>⏩ Velocidade:{' '}
                {VELOCIDADES.map((x) => <button key={x} type="button" onClick={() => setVel(x)} style={{ fontWeight: vel === x ? 'bold' : 'normal', opacity: vel === x ? 1 : 0.6, marginRight: 6 }}>{x}x</button>)}
              </div>
              <label>🔤 Texto na tela
                <input type="text" value={texto} maxLength={90} placeholder="Ex.: Promoção só hoje!" onChange={(e) => setTexto(e.target.value)} style={{ width: '100%' }} /></label>
              {texto.trim() && <div>Posição:{' '}
                {['cima', 'meio', 'baixo'].map((x) => <button key={x} type="button" onClick={() => setPosTexto(x)} style={{ fontWeight: posTexto === x ? 'bold' : 'normal', opacity: posTexto === x ? 1 : 0.6, marginRight: 6 }}>{x}</button>)}
              </div>}
              <div>🎨 Filtro:{' '}
                {Object.keys(FILTROS).map((x) => <button key={x} type="button" onClick={() => setFiltro(x)} style={{ fontWeight: filtro === x ? 'bold' : 'normal', opacity: filtro === x ? 1 : 0.6, margin: '0 6px 6px 0' }}>{x}</button>)}
              </div>
              <label><input type="checkbox" checked={mudo} onChange={(e) => setMudo(e.target.checked)} /> 🔇 Tirar o som</label>
              <button type="button" onClick={gerar}>✅ Gerar vídeo editado ({fmt(durFinal)})</button>
              <button type="button" onClick={() => arquivo.current?.click()} style={{ opacity: 0.7 }}>Trocar vídeo</button>
            </div>
          )}
          {estado === 'gravando' && <p>⏳ Gerando… {Math.round(prog * 100)}% (deixe a tela aberta)</p>}
        </>
      )}
      {estado === 'erro' && <p>Não consegui editar esse vídeo. <button type="button" onClick={() => setEstado('editar')}>Tentar de novo</button></p>}
      {estado === 'feito' && url && (
        <>
          <video src={url} controls playsInline style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 12 }} />
          <a className="baixar" href={url} download={`nexora-editado.${ext}`}>⬇️ Baixar vídeo</a>
          <button type="button" onClick={() => setEstado('editar')} style={{ marginLeft: 8 }}>✏️ Editar de novo</button>
        </>
      )}
    </div>
  );
}
