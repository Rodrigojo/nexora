/**
 * NEXORA IMAGEM — gera imagens com Cloudflare Workers AI (flux-1-schnell, plano gratuito ~10.000 neurons/dia).
 * Variáveis: CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN (Segredo, na Vercel).
 */
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const MAX_PROMPT = 1500;

export async function gerarImagem({ prompt, accountId, token, fetchImpl = fetch, timeoutMs = 40000 }) {
  if (!accountId || !token) throw new Error('SEM_CHAVE');
  const p = String(prompt || '').trim().slice(0, MAX_PROMPT);
  if (!p) throw new Error('VAZIO');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: p, steps: 4 }),
      signal: ctrl.signal,
    });
    if (r.status === 429) throw new Error('LIMITE');
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.result?.image) throw new Error(`CF_${r.status}:${JSON.stringify(j?.errors || '').slice(0, 150)}`);
    return { imagem: j.result.image, mime: 'image/jpeg' };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('TEMPO');
    throw e;
  } finally { clearTimeout(t); }
}

/** Reescreve o pedido em inglês (o flux entende melhor). Se falhar, usa o texto original. */
export async function promptEmIngles({ texto, apiKey, fetchImpl = fetch }) {
  if (!apiKey) return texto;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text:
        'Rewrite this image request as one detailed English prompt for an image generator. Reply with the prompt only.\n\n' + texto }] }] }),
    });
    const j = await r.json();
    const out = j?.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('').trim();
    return out ? out.slice(0, MAX_PROMPT) : texto;
  } catch { return texto; } finally { clearTimeout(t); }
}
