/**
 * NEXORA MIND — conexão com a IA (Google Gemini, plano gratuito).
 * A chave fica só na Vercel (GEMINI_API_KEY), nunca no código.
 */
const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
const TIMEOUT_MS = 15000;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function systemPrompt(cap) {
  return [
    'Você é a NEXORA, uma inteligência artificial brasileira. Slogan: "Uma inteligência. Múltiplas possibilidades."',
    'Não se apresente nem repita o slogan nas respostas; só diga quem você é se perguntarem. Vá direto ao assunto.',
    'Responda sempre em português do Brasil, de forma clara, útil e direta, com formatação simples.',
    'Seja honesta: se não souber algo, diga. Não invente fontes, números ou fatos.',
    'Você ainda não gera imagens, vídeos, áudios ou músicas; se pedirem, explique isso e ofereça ajuda em texto.',
    'Você consegue analisar fotos que o usuário enviar pelo botão de foto. Descreva só o que realmente aparece; se não tiver certeza, diga. Se pedirem análise sem foto, peça para tocar no botão de foto.',
    cap ? `Tarefa identificada pelo NEXORA CORE: ${cap.nome} (${cap.modulo}). Aja como especialista nessa área.` : '',
  ].filter(Boolean).join('\n');
}

/** history: [{ role: 'user'|'model', text }] */
export async function askGemini({ history, cap, apiKey, imagem = null, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const contents = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  if (imagem) contents[contents.length - 1].parts.unshift({ inlineData: { mimeType: imagem.mime, data: imagem.data } });
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(cap) }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  const errors = [];
  let models = [...MODELS];
  let discovered = false;
  for (let i = 0; i < models.length && i < 5; i++) {
    const model = models[i];
    let res;
    try {
      res = await fetchImpl(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch (err) {
      errors.push(err?.name === 'TimeoutError' ? `TEMPO:${model}` : `REDE:${err?.cause?.code || err?.name || ''}`);
      continue;
    }
    if (res.status === 404) {
      errors.push(`404:${model}`);
      if (!discovered) {
        discovered = true;
        const found = await listFlashModels(apiKey, fetchImpl);
        models = [...models.slice(0, i + 1), ...found.filter((m) => !models.includes(m)), ...models.slice(i + 1)];
      }
      continue;
    }
    if (res.status === 429) throw new Error('LIMITE');
    if (!res.ok) {
      let why = '';
      try { why = (await res.json())?.error?.status || ''; } catch {}
      errors.push(`${res.status}:${why}`);
      if (res.status === 400 || res.status === 401 || res.status === 403) break;
      continue;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (text) return { text, model };
    errors.push(`VAZIO:${model}`);
  }
  throw new Error(errors.join('|') || 'FALHA');
}

/** Descobre quais modelos "flash" esta chave pode usar (os nomes mudam com o tempo). */
export async function listFlashModels(apiKey, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${BASE}?pageSize=100`, {
      headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name).replace('models/', ''))
      .filter((n) => n.includes('flash') && !/image|tts|audio|live|thinking|exp/.test(n))
      .slice(0, 3);
  } catch { return []; }
}
