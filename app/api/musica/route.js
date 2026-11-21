import { gerarMusica, estiloEmIngles } from '../../../lib/ai/musica.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return Response.json({ erro: 'Pedido inválido.' }, { status: 400 }); }
  const pedido = String(input?.pedido || '').slice(0, 600);
  if (!pedido.trim()) return Response.json({ erro: 'Diga o estilo da música.' }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const estilo = input.estilo ? String(input.estilo).slice(0, 250) : await estiloEmIngles({ pedido, apiKey });
    const segundos = Math.min(30, Math.max(10, Number(input.segundos) || 20));
    const r = await gerarMusica({ estilo, segundos, apiKey });
    return Response.json({ ...r, estilo });
  } catch (e) {
    console.error('musica_error', e.message);
    return Response.json({ erro: 'Não consegui criar a música agora.', codigo: String(e.message).slice(0, 200) }, { status: 502 });
  }
}
