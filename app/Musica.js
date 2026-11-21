'use client';
import { useEffect, useRef, useState } from 'react';
import { guardar } from '../lib/db/midia.js';

/** Capacidade 11: pede a música instrumental em /api/musica e mostra o player com Baixar. */
export default function Musica({ pedido, midiaId }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');
  const [tent, setTent] = useState(0);
  const pediu = useRef(-1);
  useEffect(() => {
    if (pediu.current === tent) return; pediu.current = tent;
    setErro(''); setUrl(null);
    fetch('/api/musica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido, segundos: 30 }) })
      .then((r) => r.json())
      .then((d) => {
        if (!d.audio) { setErro(d.erro || 'Não consegui criar a música.'); return; }
        const bytes = Uint8Array.from(atob(d.audio), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'audio/wav' });
        setUrl(URL.createObjectURL(blob));
        if (midiaId) guardar(midiaId, blob);
      })
      .catch(() => setErro('Sem conexão. Tente de novo.'));
  }, [tent]);
  if (erro) return <p>{erro} <button type="button" onClick={() => setTent((x) => x + 1)}>Tentar de novo</button></p>;
  if (!url) return <p>🎵 Compondo a música… (uns 40 segundos)</p>;
  return (
    <div className="video-box">
      <audio src={url} controls style={{ width: '100%' }} />
      <a className="baixar" href={url} download="nexora-musica.wav">⬇️ Baixar música</a>{' '}
      <button type="button" onClick={() => setTent((x) => x + 1)}>🔄 Outra versão</button>
    </div>
  );
}
