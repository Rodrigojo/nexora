/**
 * NEXORA BUSINESS — automação empresarial (capacidade 19), versão grátis:
 * o Gemini monta um kit pronto (mensagens automáticas do WhatsApp Business, sequência de acompanhamento
 * de clientes e passo a passo para ligar). O celular mostra cada mensagem com Copiar e Enviar no WhatsApp.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELOS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];

const INSTRUCAO = `Você é especialista em automação para pequenos negócios no Brasil (WhatsApp Business, Instagram, atendimento e vendas).
Monte um KIT DE AUTOMAÇÃO pronto para usar, em português do Brasil, simples para quem usa só o celular, para o pedido abaixo.
Responda SOMENTE com JSON neste formato:
{"titulo":"...","resumo":"1 ou 2 frases do que o kit faz",
"mensagens":[{"nome":"Saudação automática","quando":"quando o cliente manda a primeira mensagem","atalho":"","texto":"..."}],
"passos":["passo curto 1","passo curto 2"]}
Regras:
- 5 a 8 mensagens: saudação, ausência (fora do horário), respostas rápidas com atalho (ex.: "/precos", "/entrega", "/pagamento", "/catalogo") e 1 a 2 de acompanhamento (pós-venda, cliente que sumiu).
- "atalho" só nas respostas rápidas (começa com /); nas outras deixe "".
- Textos curtos, simpáticos, com 1 ou 2 emojis, prontos para copiar. Não invente preços, telefones ou endereços: use [preço], [endereço], [horário].
- "passos": 3 a 6 passos para ligar isso no WhatsApp Business do celular (Ferramentas comerciais > Mensagem de saudação / Mensagem de ausência / Respostas rápidas).`;

export function lerAutomacao(txt) {
  const t = String(txt || '');
  const i = t.indexOf('{'), f = t.lastIndexOf('}');
  if (i < 0 || f < i) return null;
  try {
    const j = JSON.parse(t.slice(i, f + 1));
    const mensagens = (Array.isArray(j.mensagens) ? j.mensagens : [])
      .filter((m) => m && m.texto)
      .slice(0, 10)
      .map((m) => ({ nome: String(m.nome || 'Mensagem').slice(0, 60), quando: String(m.quando || '').slice(0, 120), atalho: String(m.atalho || '').slice(0, 30), texto: String(m.texto).slice(0, 700) }));
    if (!mensagens.length) return null;
    return {
      titulo: String(j.titulo || 'Kit de automação').slice(0, 80),
      resumo: String(j.resumo || '').slice(0, 300),
      mensagens,
      passos: (Array.isArray(j.passos) ? j.passos : []).map((p) => String(p).slice(0, 200)).slice(0, 8),
    };
  } catch { return null; }
}

/** Texto simples do kit (fica no histórico da conversa). */
export function automacaoEmTexto(a) {
  return `⚙️ **${a.titulo}**\n\n${a.resumo}\n\n` +
    a.mensagens.map((m) => `**${m.nome}**${m.atalho ? ` (${m.atalho})` : ''}\n${m.texto}`).join('\n\n') +
    (a.passos.length ? `\n\n**Como ligar:**\n${a.passos.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '');
}

export async function criarAutomacao({ pedido, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const erros = [];
  for (const modelo of MODELOS) {
    try {
      const r = await fetchImpl(`${BASE}/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(40000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${INSTRUCAO}\n\nPedido: ${String(pedido).slice(0, 1500)}` }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 4000, responseMimeType: 'application/json', ...(modelo.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
        }),
      });
      if (r.status === 429) throw new Error('LIMITE');
      if (!r.ok) { erros.push(`${r.status}:${modelo}`); continue; }
      const j = await r.json();
      const a = lerAutomacao(j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''));
      if (a) return a;
      erros.push(`JSON:${modelo}`);
    } catch (e) {
      if (e.message === 'LIMITE') throw e;
      erros.push(e.name === 'TimeoutError' ? `TEMPO:${modelo}` : `REDE:${modelo}`);
      if (e.name === 'TimeoutError') break;
    }
  }
  throw new Error(erros.join('|') || 'AUTOMACAO');
}
