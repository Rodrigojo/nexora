/**
 * NEXORA MOTION — vídeo-propaganda grátis (capacidade 5, versão básica).
 * O servidor faz o roteiro (Gemini); o celular pede cada cena (/api/cena, Cloudflare flux) e junta tudo:
 * imagens com movimento + legendas + narração (Gemini TTS) e grava o vídeo (canvas + MediaRecorder).
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELOS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
export const N_CENAS = 4;

const INSTRUCAO = `Você é roteirista de vídeos curtos de propaganda para Reels/TikTok, em português do Brasil.
Crie um vídeo de ${N_CENAS} cenas para o pedido abaixo. Responda SOMENTE com JSON neste formato:
{"titulo":"...","narracao":"texto falado do vídeo inteiro, 35 a 55 palavras, animado e natural","cenas":[{"legenda":"frase curta da tela, até 7 palavras","prompt":"detailed English prompt for an image generator describing this scene, vertical composition, photorealistic, no text"}]}
Não invente preços, números ou promessas que o pedido não deu.`;

/** Lê o JSON do roteiro, mesmo se vier entre ```json. */
export function lerRoteiro(texto) {
  const m = String(texto || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const cenas = Array.isArray(j.cenas) ? j.cenas.filter((c) => c && c.prompt).slice(0, N_CENAS) : [];
  if (cenas.length < 2) return null;
  return {
    titulo: String(j.titulo || 'Vídeo NEXORA').slice(0, 80),
    narracao: String(j.narracao || '').slice(0, 600),
    cenas: cenas.map((c) => ({ legenda: String(c.legenda || '').slice(0, 60), prompt: String(c.prompt).slice(0, 900) })),
  };
}

export async function roteiroVideo({ pedido, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const erros = [];
  for (const modelo of MODELOS) {
    try {
      const r = await fetchImpl(`${BASE}/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${INSTRUCAO}\n\nPedido: ${String(pedido).slice(0, 1500)}` }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048, responseMimeType: 'application/json' },
        }),
      });
      if (r.status === 429) throw new Error('LIMITE');
      if (!r.ok) { erros.push(`${r.status}:${modelo}`); continue; }
      const j = await r.json();
      const txt = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
      const rot = lerRoteiro(txt);
      if (rot) return rot;
      erros.push(`JSON:${modelo}`);
    } catch (e) {
      if (e.message === 'LIMITE') throw e;
      erros.push(e.name === 'TimeoutError' ? `TEMPO:${modelo}` : `REDE:${modelo}`);
    }
  }
  throw new Error(erros.join('|') || 'ROTEIRO');
}

/** Prompt de cena com o produto salvo como base (mantém forma, cores e rótulo). */
export function promptCena(prompt, produto) {
  return `Keep the product from image 0 exactly as it is: same shape, colors and label text${produto ? ` ("${String(produto).slice(0, 40)}")` : ''}. Product large and sharp. ${prompt}`;
}
