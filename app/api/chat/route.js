import { detectIntent, unavailableMessage, pedidoEdicao } from '../../../lib/core/router.js';
import { getCapability } from '../../../lib/core/capabilities.js';
import { askGemini } from '../../../lib/ai/gemini.js';
import { validateChat, validateImage } from '../../../lib/core/validate.js';
import { gerarImagem, editarFoto, promptEmIngles } from '../../../lib/ai/imagem.js';

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

  const img = validateImage(input.imagem);
  if (!img.ok) return Response.json({ erro: img.erro }, { status: 400 });

  const last = check.history[check.history.length - 1].text;
  const editar = img.imagem?.ref && pedidoEdicao(last);
  const intent = img.imagem ? { capability: getCapability(editar ? 4 : 23), disponivel: true } : detectIntent(last);
  const cap = intent.capability;
  if (!intent.disponivel && cap.versao > 1) {
    return Response.json({ resposta: unavailableMessage(cap), capacidade: cap.id, ia: false });
  }
  if (cap.id === 3 || cap.id === 4) {
    try {
      const pedido = last.replace(/^📷 \[foto\] /, '');
      const prompt = await promptEmIngles({ texto: pedido, apiKey: process.env.GEMINI_API_KEY });
      const conta = { accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN };
      const r = cap.id === 4
        ? await editarFoto({ ...conta, refB64: img.imagem.ref,
            prompt: `Keep the product/subject from image 0 exactly as it is (same shape, label, text and colors). ${prompt}` })
        : await gerarImagem({ prompt, ...conta });
      return Response.json({ resposta: 'Aqui está a sua imagem. Toque nela para salvar no celular.', imagemGerada: r, capacidade: cap.id, ia: true });
    } catch (e) {
      console.error('imagem_error', e.message);
      const msgs = { SEM_CHAVE: 'A criação de imagens ainda não está conectada.', LIMITE: 'Limite de imagens de hoje atingido. Tente amanhã.', TEMPO: 'A imagem demorou demais. Tente de novo.' };
      return Response.json({ erro: msgs[e.message] || 'Não consegui criar a imagem agora.', codigo: String(e.message).slice(0, 200) }, { status: 502 });
    }
  }
  try {
    const { text } = await askGemini({ history: check.history, cap, imagem: img.imagem, apiKey: process.env.GEMINI_API_KEY });
    return Response.json({ resposta: text, capacidade: cap.id, ia: true });
  } catch (e) {
    const msg = ERRORS[e.message] || 'A IA não respondeu agora. Tente de novo em instantes.';
    console.error('chat_error', e.message);
    return Response.json({ erro: msg, codigo: String(e.message).slice(0, 200) }, { status: e.message === 'LIMITE' ? 429 : 502 });
  }
}
