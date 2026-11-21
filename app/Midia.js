'use client';
import { useEffect, useState } from 'react';
import { pegar } from '../lib/db/midia.js';
import Site from './Site';

/** Mostra de novo um vídeo ou imagem guardado neste aparelho. */
export default function Midia({ id, tipo, ids }) {
  if (tipo === 'avatares') return <div className="avatares">{ids.map((x) => <Midia key={x} id={x} tipo="imagem" />)}</div>;
  return <Uma id={id} tipo={tipo} />;
}

function Uma({ id, tipo }) {
  const [url, setUrl] = useState(null);
  const [html, setHtml] = useState(null);
  const [falta, setFalta] = useState(false);
  useEffect(() => {
    let u;
    pegar(id).then((b) => { if (b && tipo === 'site') b.text().then(setHtml); else if (b) { u = URL.createObjectURL(b); setUrl(u); } else setFalta(true); });
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  if (falta) return <p className="hint">(Criado em outro aparelho ou navegador.)</p>;
  if (tipo === 'site') return html ? <Site html={html} /> : null;
  if (!url) return null;
  if (tipo === 'musica') return (
    <div className="video-box"><audio src={url} controls style={{ width: '100%' }} /><a className="baixar" href={url} download="nexora-musica.wav">⬇️ Baixar música</a></div>
  );
  const ext = tipo === 'video' ? 'mp4' : 'jpg';
  return tipo === 'video' ? (
    <div className="video-box">
      <video className="video-gerado" src={url} controls playsInline />
      <a className="baixar" href={url} download={`nexora-video.${ext}`}>⬇️ Baixar vídeo</a>
    </div>
  ) : (
    <a href={url} download="nexora-imagem.jpg"><img src={url} alt="Imagem criada pela NEXORA" className="imagem-gerada" /></a>
  );
}
