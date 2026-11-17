/**
 * NEXORA MIND — conexão com a IA (Google Gemini, plano gratuito).
 * A chave fica só na Vercel (GEMINI_API_KEY), nunca no código.
 */
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function systemPrompt(cap) {
  return [
    'Você é a NEXORA, uma inteligência artificial brasileira. Slogan: "Uma inteligência. Múltiplas possibilidades."',
    'Responda sempre em português do Brasil, de forma clara, útil e direta, com formatação simples.',
    'Seja honesta: se não souber algo, diga. Não invente fontes, números ou fatos.',
    'Você ainda não gera imagens, vídeos, áudios ou músicas; se pedirem, explique isso e ofereça ajuda em texto.',
    cap ? `Tarefa identificada pelo NEXORA CORE: ${cap.nome} (${cap.modulo}). Aja como especialista nessa área.` : '',
  ].filter(Boolean).join('\n');
}

/** history: [{ role: 'user'|'model', text }] */
export async function askGemini({ history, cap, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(cap) }] },
    contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  let lastError = 'FALHA';
  for (const model of MODELS) {
    const res = await fetchImpl(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.status === 404) { lastError = 'MODELO'; continue; }
    if (res.status === 429) throw new Error('LIMITE');
    if (!res.ok) {
      let why = '';
      try { why = (await res.json())?.error?.status || ''; } catch {}
      lastError = `HTTP_${res.status}${why ? '_' + why : ''}`;
      if (res.status === 400 || res.status === 401 || res.status === 403) break;
      continue;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (text) return { text, model };
    lastError = 'VAZIO';
  }
  throw new Error(lastError);
}
