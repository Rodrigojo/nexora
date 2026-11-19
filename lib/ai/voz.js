/**
 * NEXORA VOICE — narração com o Gemini TTS (plano gratuito, mesma chave GEMINI_API_KEY).
 * O Gemini devolve áudio PCM (16 bits, 24 kHz, mono); aqui embrulhamos em WAV para o celular tocar.
 */
const MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const MAX_VOZ = 1500; // caracteres (~1 a 2 minutos de fala)
export const VOZES = { feminina: 'Kore', masculina: 'Charon' };

/** Tira marcas de formatação (**, #, -) para a voz não ler símbolos. */
export function limparTexto(t) {
  return String(t || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, MAX_VOZ);
}

/** Cabeçalho WAV para PCM 16 bits mono. */
export function pcmParaWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function narrar({ texto, voz = 'feminina', apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const limpo = limparTexto(texto);
  if (!limpo) throw new Error('VAZIO');
  const body = {
    contents: [{ parts: [{ text: `Leia em português do Brasil, com voz natural e clara:\n${limpo}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZES[voz] || VOZES.feminina } } },
    },
  };
  const errors = [];
  for (const model of MODELS) {
    let res;
    try {
      res = await fetchImpl(`${BASE}/${model}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(40000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch (err) { errors.push(err?.name === 'TimeoutError' ? `TEMPO:${model}` : 'REDE'); break; }
    if (res.status === 429) throw new Error('LIMITE');
    if (res.status === 404) { errors.push(`404:${model}`); continue; }
    if (!res.ok) {
      let why = ''; try { why = (await res.json())?.error?.message?.slice(0, 80) || ''; } catch {}
      errors.push(`${res.status}:${model}:${why}`); continue;
    }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) { errors.push(`VAZIO:${model}`); continue; }
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
    const wav = pcmParaWav(Buffer.from(part.inlineData.data, 'base64'), rate);
    return { audio: wav.toString('base64'), mime: 'audio/wav', model };
  }
  throw new Error(errors.join('|') || 'FALHA');
}
