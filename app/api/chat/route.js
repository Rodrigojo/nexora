import { detectIntent, unavailableMessage } from '../../../lib/core/router.js';
import { askGemini } from '../../../lib/ai/gemini.js';
import { validateChat } from '../../../lib/core/validate.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ERRORS = {
  SEM_CHAVE: 'A NEXORA ainda não está conectada à IA. Tente mais tarde.',
  LIMITE: 'Muitas mensagens agora. Espere um minuto e tente de novo.',
};

export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return Response.json({ erro: 'Pedido inválido.' }, { status: 400 }); }
  const check = validateChat(input);
  if (!check.ok) return Response.json({ erro: check.erro }, { status: 400 });

  const last = check.history[check.history.length - 1].text;
  const intent = detectIntent(last);
  const cap = intent.capability;
  if (!intent.disponivel && cap.versao > 1) {
    return Response.json({ resposta: unavailableMessage(cap), capacidade: cap.id, ia: false });
  }
  try {
    const { text } = await askGemini({ history: check.history, cap, apiKey: process.env.GEMINI_API_KEY });
    return Response.json({ resposta: text, capacidade: cap.id, ia: true });
  } catch (e) {
    const msg = ERRORS[e.message] || 'A IA não respondeu agora. Tente de novo em instantes.';
    console.error('chat_error', e.message);
    return Response.json({ erro: msg, codigo: String(e.message).slice(0, 60) }, { status: e.message === 'LIMITE' ? 429 : 502 });
  }
}
