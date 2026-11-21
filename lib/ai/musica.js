/**
 * NEXORA MUSIC — música instrumental grátis (capacidade 11) com o Lyria RealTime (experimental, Gemini API).
 * Conexão WebSocket: manda o estilo, grava ~N segundos do áudio (PCM 16 bits, 48 kHz, estéreo)
 * e devolve um WAV mono 24 kHz (pequeno para o celular).
 */
const URL_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';
import { pcmParaWav } from './voz.js';
import { TEXTO } from './modelos.js';

const ESTILO = `Rewrite this music request as a short English list of musical styles, instruments and mood for an instrumental music generator (comma separated, max 25 words). Reply with the list only.`;

export async function estiloEmIngles({ pedido, apiKey, fetchImpl = fetch }) {
  for (const modelo of TEXTO.slice(0, 3)) try {
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${ESTILO}\n\n${String(pedido).slice(0, 600)}` }] }],
        generationConfig: { temperature: 0.4 } }),
    });
    if (!r.ok) continue;
    const j = await r.json();
    const t = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (t) return t.replace(/\s+/g, ' ').slice(0, 250);
  } catch {}
  return 'upbeat pop, acoustic guitar, warm piano, happy';
}

/** Junta os pedaços PCM estéreo 48 kHz e converte para mono 24 kHz. */
export function estereo48ParaMono24(buf) {
  const quadros = Math.floor(buf.length / 4);
  const n = Math.floor(quadros / 2);
  const out = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const a = buf.readInt16LE(i * 8), b = buf.readInt16LE(i * 8 + 2), c = buf.readInt16LE(i * 8 + 4), d = buf.readInt16LE(i * 8 + 6);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((a + b + c + d) / 4))), i * 2);
  }
  return out;
}

export function gerarMusica({ estilo, segundos = 20, bpm, apiKey, WS = globalThis.WebSocket, limiteMs = 50000 }) {
  if (!apiKey) return Promise.reject(new Error('SEM_CHAVE'));
  if (!WS) return Promise.reject(new Error('SEM_WS'));
  const alvo = segundos * 48000 * 4;
  return new Promise((ok, falha) => {
    const partes = []; let total = 0; let fim = false;
    const ws = new WS(`${URL_WS}?key=${encodeURIComponent(apiKey)}`);
    const acabar = (erro) => {
      if (fim) return; fim = true; clearTimeout(timer);
      try { ws.send(JSON.stringify({ playbackControl: 'STOP' })); } catch {}
      try { ws.close(); } catch {}
      if (total > 48000 * 4 * 5) {
        const mono = estereo48ParaMono24(Buffer.concat(partes).subarray(0, alvo));
        ok({ audio: pcmParaWav(mono, 24000).toString('base64'), mime: 'audio/wav', segundos: Math.round(mono.length / 48000) });
      } else falha(new Error(erro || 'SEM_AUDIO'));
    };
    const timer = setTimeout(() => acabar('TEMPO'), limiteMs);
    ws.onopen = () => ws.send(JSON.stringify({ setup: { model: 'models/lyria-realtime-exp' } }));
    ws.onerror = () => acabar('WS_ERRO');
    ws.onclose = (e) => acabar(`FECHOU:${e?.code || ''}:${String(e?.reason || '').slice(0, 120)}`);
    ws.onmessage = async (ev) => {
      let txt = ev.data;
      if (typeof txt !== 'string') txt = Buffer.from(txt instanceof Blob ? await txt.arrayBuffer() : txt).toString('utf8');
      let m; try { m = JSON.parse(txt); } catch { return; }
      if (m.setupComplete) {
        ws.send(JSON.stringify({ clientContent: { weightedPrompts: [{ text: estilo, weight: 1.0 }] } }));
        ws.send(JSON.stringify({ musicGenerationConfig: { temperature: 1.0, ...(bpm ? { bpm } : {}) } }));
        ws.send(JSON.stringify({ playbackControl: 'PLAY' }));
        return;
      }
      if (m.filteredPrompt) { acabar('FILTRADO'); return; }
      for (const c of m.serverContent?.audioChunks || []) {
        const b = Buffer.from(c.data, 'base64'); partes.push(b); total += b.length;
      }
      if (total >= alvo) acabar();
    };
  });
}
