/**
 * NEXORA BUILD — criação de sites (capacidade 18): o Gemini escreve uma página completa (um arquivo HTML).
 * O celular mostra a prévia (iframe isolado), abre em tela cheia e baixa o arquivo.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELOS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];

const INSTRUCAO = `Você é um web designer profissional. Crie UMA página de site completa, bonita e moderna, em português do Brasil, para o pedido abaixo.
Regras:
- Responda SOMENTE com o código HTML completo, começando com <!DOCTYPE html> e terminando com </html>. Nada antes ou depois.
- Tudo em um arquivo só: CSS dentro de <style>, JavaScript (se precisar) dentro de <script>. Sem frameworks, sem arquivos externos, exceto Google Fonts.
- Feita primeiro para celular (responsiva), visual caprichado: cores harmoniosas, cantos arredondados, sombras suaves, boa tipografia, espaçamento generoso.
- Sem imagens externas: use gradientes, emojis grandes e formas em CSS no lugar de fotos.
- Seções típicas: topo com nome e chamada forte, benefícios/serviços, produtos ou cardápio quando fizer sentido, depoimentos, contato (botão de WhatsApp com link https://wa.me/ sem número, para o dono completar) e rodapé.
- Não invente preços, endereços ou telefones que o pedido não deu; use textos como "Seu endereço aqui".`;

/** Tira o HTML da resposta, mesmo se vier entre \`\`\`html. */
export function lerHtml(txt) {
  const t = String(txt || '');
  const i = t.search(/<!doctype html|<html/i);
  const f = t.toLowerCase().lastIndexOf('</html>');
  if (i < 0 || f < i) return null;
  return t.slice(i, f + 7);
}
export function tituloHtml(html) {
  const m = /<title>([^<]{1,80})<\/title>/i.exec(html || '');
  return m ? m[1].trim() : 'Seu site';
}

export async function criarSite({ pedido, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const erros = [];
  for (const modelo of MODELOS) {
    try {
      const r = await fetchImpl(`${BASE}/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${INSTRUCAO}\n\nPedido: ${String(pedido).slice(0, 2000)}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 12000, ...(modelo.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
        }),
      });
      if (r.status === 429) throw new Error('LIMITE');
      if (!r.ok) { erros.push(`${r.status}:${modelo}`); continue; }
      const j = await r.json();
      const html = lerHtml(j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''));
      if (html) return { html, titulo: tituloHtml(html) };
      erros.push(`HTML:${modelo}`);
    } catch (e) {
      if (e.message === 'LIMITE') throw e;
      erros.push(e.name === 'TimeoutError' ? `TEMPO:${modelo}` : `REDE:${modelo}`);
      if (e.name === 'TimeoutError') break; // sem tempo para outro modelo dentro do limite da Vercel
    }
  }
  throw new Error(erros.join('|') || 'SITE');
}
