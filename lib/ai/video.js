/**
 * NEXORA MOTION — vídeo-propaganda grátis (capacidade 5, versão básica).
 * O servidor faz o roteiro (Gemini); o celular pede cada cena (/api/cena, Cloudflare flux) e junta tudo:
 * imagens com movimento + legendas + narração (Gemini TTS) e grava o vídeo (canvas + MediaRecorder).
 */
import { TEXTO } from './modelos.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELOS = TEXTO;
export const N_CENAS = 4;

const INSTRUCAO = `Você é roteirista de vídeos curtos de propaganda para Reels/TikTok, em português do Brasil.
Crie um vídeo de ${N_CENAS} cenas para o pedido abaixo. Responda SOMENTE com JSON neste formato:
{"titulo":"...","narracao":"texto falado do vídeo inteiro, 35 a 55 palavras, animado e natural","personagem":"English description of ONE main character who appears in every scene (age, skin, hair, face, clothes), or empty string if the video has no people","cenas":[{"legenda":"frase curta da tela, até 7 palavras","prompt":"detailed English prompt describing this scene with the main character doing something, vertical composition, no text"}]}
Use personagens (pessoas reais) sempre que fizer sentido para a propaganda, e o MESMO personagem em todas as cenas.
Não invente preços, números ou promessas que o pedido não deu.`;

/** Estilo de foto real, para as cenas parecerem gravadas de verdade. */
export const REALISMO = 'Ultra realistic photograph, shot on a full-frame camera with a 35mm lens, natural soft lighting, real skin texture with pores, natural imperfections, shallow depth of field, true-to-life colors, candid moment, not illustration, not CGI, not 3D render, no text, no watermark.';

/** Lê o JSON do roteiro, mesmo se vier entre ```json. */
export function lerRoteiro(texto) {
  const m = String(texto || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const cenas = Array.isArray(j.cenas) ? j.cenas.filter((c) => c && c.prompt).slice(0, N_CENAS) : [];
  if (cenas.length < 2) return null;
  const personagem = String(j.personagem || '').slice(0, 400);
  return {
    titulo: String(j.titulo || 'Vídeo NEXORA').slice(0, 80),
    personagem,
    narracao: String(j.narracao || '').slice(0, 600),
    cenas: cenas.map((c) => ({ legenda: String(c.legenda || '').slice(0, 60),
      prompt: `${personagem ? `Main character: ${personagem}. ` : ''}${String(c.prompt).slice(0, 700)} ${REALISMO}` })),
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
export function promptPersonagem(prompt) {
  return `Keep the same person from image 0: same face, same hair, same skin tone, same clothes. New scene: ${prompt}`;
}
export function promptCena(prompt, produto) {
  return `Keep the product from image 0 exactly as it is: same shape, colors and label text${produto ? ` ("${String(produto).slice(0, 40)}")` : ''}. Product large and sharp. ${prompt}`;
}

/** Capacidade 6 — animar foto: o Gemini olha a foto e escreve título, narração curta e 3 legendas. */
export async function roteiroFoto({ pedido, imagem, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const instr = `Você vai transformar a foto enviada em um vídeo curto animado (3 momentos com movimento de câmera), em português do Brasil.
Responda SOMENTE com JSON: {"titulo":"...","narracao":"texto falado, 20 a 35 palavras, sobre o que a foto mostra e o pedido","legendas":["frase curta até 6 palavras","...","..."]}
As legendas e a narração falam do CONTEÚDO da foto (quem/o quê, clima, emoção), nunca repetem o pedido (nada de "animar esta foto").
Pedido da pessoa: ${String(pedido).slice(0, 800)}
Não invente preços ou promessas.`;
  const erros = [];
  for (const modelo of MODELOS) {
    try {
      const r = await fetchImpl(`${BASE}/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(25000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: imagem.mime, data: imagem.data } }, { text: instr }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: 'application/json' },
        }),
      });
      if (r.status === 429) throw new Error('LIMITE');
      if (!r.ok) { erros.push(`${r.status}:${modelo}`); continue; }
      const j = await r.json();
      const m = String(j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '').match(/\{[\s\S]*\}/);
      const o = m ? JSON.parse(m[0]) : null;
      const leg = Array.isArray(o?.legendas) ? o.legendas.slice(0, 3) : [];
      while (leg.length < 3) leg.push('');
      if (o) return { titulo: String(o.titulo || 'Sua foto animada').slice(0, 80), narracao: String(o.narracao || '').slice(0, 400),
        cenas: leg.map((l) => ({ legenda: String(l).slice(0, 60) })), animar: true };
      erros.push(`JSON:${modelo}`);
    } catch (e) {
      if (e.message === 'LIMITE') throw e;
      erros.push(e.name === 'TimeoutError' ? `TEMPO:${modelo}` : `ERRO:${modelo}`);
    }
  }
  throw new Error(erros.join('|') || 'ROTEIRO');
}

/** Divide a fala em legendas de ~7 palavras (aparecem na ordem da narração). */
export function partesFala(texto, n = 7) {
  const p = String(texto || '').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < p.length; i += n) out.push(p.slice(i, i + n).join(' '));
  return out.length ? out : [''];
}

/** Capacidade 8 — apresentador: usa o texto da pessoa (depois de ":" ou entre aspas) ou o Gemini escreve a fala. */
export async function roteiroApresentador({ pedido, apiKey, fetchImpl = fetch }) {
  const limpo = String(pedido || '').replace(/^📷 \[foto\] /, '');
  const aspas = /["“]([^"”]{20,})["”]/.exec(limpo);
  const doisPontos = limpo.includes(':') ? limpo.slice(limpo.indexOf(':') + 1).trim() : '';
  let fala = aspas ? aspas[1] : doisPontos.split(/\s+/).length >= 8 ? doisPontos : '';
  let titulo = 'Seu apresentador';
  if (!fala) {
    if (!apiKey) throw new Error('SEM_CHAVE');
    const instr = `Escreva a fala de um apresentador de vídeo curto, em português do Brasil, simpático e natural, 40 a 60 palavras, sobre o pedido abaixo. Responda SOMENTE com JSON: {"titulo":"...","fala":"..."}. Não invente preços, endereços ou promessas.\nPedido: ${limpo.slice(0, 1200)}`;
    for (const modelo of MODELOS) {
      try {
        const r = await fetchImpl(`${BASE}/${modelo}:generateContent`, {
          method: 'POST', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: instr }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1024, responseMimeType: 'application/json' } }),
        });
        if (r.status === 429) throw new Error('LIMITE');
        if (!r.ok) continue;
        const j = await r.json();
        const m = String(j?.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '').match(/\{[\s\S]*\}/);
        const o = m ? JSON.parse(m[0]) : null;
        if (o?.fala) { fala = String(o.fala); titulo = String(o.titulo || titulo); break; }
      } catch (e) { if (e.message === 'LIMITE') throw e; }
    }
    if (!fala) throw new Error('ROTEIRO');
  }
  fala = fala.slice(0, 700);
  return {
    titulo: titulo.slice(0, 80), narracao: fala, apresentador: true,
    cenas: partesFala(fala).map((legenda) => ({ legenda })),
    prompt: `Friendly Brazilian TV presenter, medium close-up, looking straight at the camera, smiling, modern bright studio background, vertical composition. ${REALISMO}`,
  };
}

/** Vídeo com personagens conversando: 2 personagens, falas curtas, vozes diferentes (Gemini TTS multi-voz). */
const INSTRUCAO_DIALOGO = `Você é roteirista de vídeos curtos (Reels/TikTok) em português do Brasil com DOIS personagens conversando.
Responda SOMENTE com JSON:
{"titulo":"...","cenario":"English description of the place where they are","personagens":[{"nome":"primeiro nome","genero":"feminino ou masculino","descricao":"English description: age, skin, hair, face, clothes"},{"nome":"...","genero":"...","descricao":"..."}],"falas":[{"p":0,"texto":"fala curta e natural, até 18 palavras"}]}
Regras: 4 a 6 falas alternando os personagens (p = 0 ou 1), conversa natural e divertida sobre o pedido, com final que chama o público para agir quando for propaganda. Nomes diferentes. Não invente preços nem promessas que o pedido não deu.`;

export function lerDialogo(texto) {
  const m = String(texto || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const ps = (Array.isArray(j.personagens) ? j.personagens : []).slice(0, 2).map((p, i) => ({
    nome: String(p?.nome || (i ? 'Bia' : 'Leo')).replace(/[^\p{L} ]/gu, '').trim().slice(0, 20) || (i ? 'Bia' : 'Leo'),
    genero: /fem/i.test(p?.genero) ? 'feminino' : 'masculino',
    descricao: String(p?.descricao || 'a friendly adult').slice(0, 300),
  }));
  if (ps.length < 2) return null;
  if (ps[0].nome === ps[1].nome) ps[1].nome += ' 2';
  const falas = (Array.isArray(j.falas) ? j.falas : []).filter((f) => f && f.texto).slice(0, 6)
    .map((f) => ({ p: Number(f.p) === 1 ? 1 : 0, texto: String(f.texto).replace(/\s+/g, ' ').slice(0, 160) }));
  if (falas.length < 2) return null;
  const cenario = String(j.cenario || 'a bright modern shop').slice(0, 250);
  return {
    titulo: String(j.titulo || 'Conversa NEXORA').slice(0, 80), cenario, falas,
    personagens: ps.map((p) => ({ ...p, prompt: `Portrait of ${p.descricao}, talking and gesturing, looking at the camera, upper body, in ${cenario}. ${REALISMO}` })),
  };
}

export async function roteiroDialogo({ pedido, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('SEM_CHAVE');
  const erros = [];
  for (const modelo of MODELOS) {
    try {
      const r = await fetchImpl(`${BASE}/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${INSTRUCAO_DIALOGO}\n\nPedido: ${String(pedido).slice(0, 1500)}` }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048, responseMimeType: 'application/json' },
        }),
      });
      if (r.status === 429) throw new Error('LIMITE');
      if (!r.ok) { erros.push(`${r.status}:${modelo}`); continue; }
      const j = await r.json();
      const d = lerDialogo(j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''));
      if (d) return d;
      erros.push(`JSON:${modelo}`);
    } catch (e) {
      if (e.message === 'LIMITE') throw e;
      erros.push(e.name === 'TimeoutError' ? `TEMPO:${modelo}` : `REDE:${modelo}`);
    }
  }
  throw new Error(erros.join('|') || 'DIALOGO');
}
