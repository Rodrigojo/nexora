import { narrar } from '../../../lib/ai/voz.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ERRORS = {
  SEM_CHAVE: 'A NEXORA ainda não está conectada à IA. Tente mais tarde.',
  LIMITE: 'Muitos áudios agora. Espere um minuto e tente de novo.',
  VAZIO: 'Não há texto para narrar.',
};

export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return Response.json({ erro: 'Pedido inválido.' }, { status: 400 }); }
  const texto = String(input?.texto || '');
  if (!texto.trim()) return Response.json({ erro: ERRORS.VAZIO }, { status: 400 });
  try {
    const r = await narrar({ texto, voz: input?.voz, apiKey: process.env.GEMINI_API_KEY });
    return Response.json({ audio: r.audio, mime: r.mime });
  } catch (e) {
    console.error('voz_error', e.message);
    return Response.json({ erro: ERRORS[e.message] || 'Não consegui gerar o áudio agora.', codigo: String(e.message).slice(0, 200) },
      { status: e.message === 'LIMITE' ? 429 : 502 });
  }
}
