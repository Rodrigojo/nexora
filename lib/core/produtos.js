/**
 * Catálogo de produtos: o usuário salva a foto de um produto uma vez, com um nome.
 * Depois, "crie uma imagem do Essencial na praia" usa essa foto como base (capacidade 4).
 */
const normalize = (t) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** "salve como Essencial", "guarde esta foto como Perfume Essencial" → nome do produto (ou null). */
export function pedidoSalvarProduto(texto) {
  const m = String(texto || '').match(/\b(salv|guard|cadastr|registr)\S*\s+(.{0,40}?\s)?como\s+(?:o |a |produto )?["“']?([^"”'\n]{1,40})["”']?[.!]*\s*$/i);
  if (!m) return null;
  const nome = m[3].trim().replace(/[.!]+$/, '');
  return nome || null;
}

/** Procura no texto o nome de um produto salvo (o nome mais longo vence). */
export function acharProduto(texto, nomes) {
  const t = ` ${normalize(texto).replace(/[^a-z0-9 ]/g, ' ')} `;
  let achado = null;
  for (const n of nomes || []) {
    const k = normalize(n).replace(/[^a-z0-9 ]/g, ' ').trim();
    if (k && t.includes(` ${k} `) && (!achado || k.length > normalize(achado).length)) achado = n;
  }
  return achado;
}
