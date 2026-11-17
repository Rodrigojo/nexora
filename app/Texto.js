// Mostra respostas da IA com negrito, títulos e listas, sem asteriscos crus.
function inline(t, k) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k + i}>{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={k + i}>{p.slice(1, -1)}</code>;
    return p.replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2');
  });
}

export default function Texto({ texto }) {
  const linhas = String(texto || '').split('\n');
  return linhas.map((l, i) => {
    const h = l.match(/^#{1,6}\s+(.*)/);
    if (h) return <div key={i} className="tit">{inline(h[1].replace(/\*\*/g, ''), i)}</div>;
    const b = l.match(/^\s*[*-]\s+(.*)/);
    if (b) return <div key={i} className="item">• {inline(b[1], i)}</div>;
    return <div key={i}>{l ? inline(l, i) : '\u00a0'}</div>;
  });
}
