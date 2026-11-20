import { gerarImagem, editarFoto } from '../../../lib/ai/imagem.js';
import { promptCena } from '../../../lib/ai/video.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Uma cena do vídeo por pedido (cada imagem tem ~800 KB; juntas passariam do limite da Vercel). */
export async function POST(req) {
  let input;
  try { input = await req.json(); } catch { return Response.json({ erro: 'Pedido inválido.' }, { status: 400 }); }
  const prompt = String(input?.prompt || '').slice(0, 900);
  if (!prompt) return Response.json({ erro: 'Cena vazia.' }, { status: 400 });
  const ref = typeof input.ref === 'string' && input.ref.length < 700000 ? input.ref : null;
  const conta = { accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN };
  try {
    const r = ref
      ? await editarFoto({ ...conta, refB64: ref, prompt: promptCena(prompt, input.produto) })
      : await gerarImagem({ ...conta, prompt });
    return Response.json(r);
  } catch (e) {
    console.error('cena_error', e.message);
    return Response.json({ erro: e.message === 'LIMITE' ? 'Limite de imagens de hoje atingido.' : 'Não consegui criar a cena.', codigo: String(e.message).slice(0, 200) }, { status: 502 });
  }
}
