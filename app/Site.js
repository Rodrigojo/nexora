'use client';
import { useState } from 'react';

/** Prévia do site criado (iframe isolado, sem acesso à NEXORA), tela cheia e download. */
export default function Site({ html, titulo }) {
  const [cheia, setCheia] = useState(false);
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${(titulo || 'site').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site'}.html`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <div className="site-box">
      <iframe className={cheia ? 'site-cheia' : 'site-previa'} srcDoc={html} sandbox="allow-scripts" title={titulo || 'Site criado'} />
      {cheia && <button type="button" className="site-fechar" onClick={() => setCheia(false)}>✕ Fechar</button>}
      <div className="site-botoes">
        <button type="button" onClick={() => setCheia(true)}>🔍 Tela cheia</button>
        <button type="button" onClick={baixar}>⬇️ Baixar site</button>
      </div>
    </div>
  );
}
