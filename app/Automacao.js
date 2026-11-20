'use client';
import { useState } from 'react';

/** Kit de automação (capacidade 19): cada mensagem com Copiar e Enviar no WhatsApp, e o passo a passo. */
export default function Automacao({ kit }) {
  const [copiado, setCopiado] = useState(-1);
  const copiar = async (t, i) => {
    try { await navigator.clipboard.writeText(t); } catch {
      const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
    }
    setCopiado(i); setTimeout(() => setCopiado(-1), 2000);
  };
  return (
    <div className="auto-box">
      <p><b>⚙️ {kit.titulo}</b></p>
      {kit.resumo && <p>{kit.resumo}</p>}
      {kit.mensagens.map((m, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, margin: '10px 0' }}>
          <p style={{ margin: 0 }}><b>{m.nome}</b>{m.atalho && <span style={{ opacity: 0.8 }}> · atalho {m.atalho}</span>}</p>
          {m.quando && <p style={{ margin: '4px 0', opacity: 0.7, fontSize: '0.9em' }}>{m.quando}</p>}
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>{m.texto}</p>
          <button type="button" onClick={() => copiar(m.texto, i)}>{copiado === i ? '✅ Copiado' : '📋 Copiar'}</button>{' '}
          <a className="baixar" href={`https://wa.me/?text=${encodeURIComponent(m.texto)}`} target="_blank" rel="noreferrer">📲 WhatsApp</a>
        </div>
      ))}
      {kit.passos.length > 0 && (
        <>
          <p><b>Como ligar no WhatsApp Business:</b></p>
          <ol>{kit.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
        </>
      )}
    </div>
  );
}
