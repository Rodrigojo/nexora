'use client';
import { useEffect, useRef, useState } from 'react';
import { guardar } from '../lib/db/midia.js';

/** Pede cada estilo de avatar em /api/cena (um por pedido) e mostra em grade. */
export default function Avatares({ estilos, refFoto, ids }) {
  const [itens, setItens] = useState(estilos.map((e) => ({ ...e, estado: 'criando' })));
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !refFoto) return;
    iniciou.current = true;
    estilos.forEach((e, i) => {
      fetch('/api/cena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: e.prompt, ref: refFoto, avatar: true }) })
        .then((r) => r.json())
        .then(async (d) => {
          if (!d.imagem) throw new Error(d.erro || 'falhou');
          const src = `data:${d.mime};base64,${d.imagem}`;
          if (ids?.[i]) fetch(src).then((r) => r.blob()).then((b) => guardar(ids[i], b)).catch(() => {});
          setItens((v) => v.map((x, j) => (j === i ? { ...x, estado: 'feito', src } : x)));
        })
        .catch(() => setItens((v) => v.map((x, j) => (j === i ? { ...x, estado: 'erro' } : x))));
    });
  }, [estilos, refFoto, ids]);
  if (!refFoto) return <p className="hint">Envie uma foto do rosto pelo 📷 junto com o pedido.</p>;
  return (
    <div className="avatares">
      {itens.map((x, i) => (
        <figure key={i} className="avatar">
          {x.estado === 'feito'
            ? <a href={x.src} download={`nexora-avatar-${i + 1}.jpg`}><img src={x.src} alt={x.nome} className="imagem-gerada" /></a>
            : <div className="avatar-espera">{x.estado === 'erro' ? 'Não consegui este estilo.' : 'Criando…'}</div>}
          <figcaption>{x.nome}</figcaption>
        </figure>
      ))}
    </div>
  );
}
