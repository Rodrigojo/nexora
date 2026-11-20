import { detectIntent, unavailableMessage, pedidoEdicao, pedidoAvatar, pedidoAnimar } from '../../../lib/core/router.js';
import { getCapability } from '../../../lib/core/capabilities.js';
import { askGemini } from '../../../lib/ai/gemini.js';
import { validateChat, validateImage, validateAudio } from '../../../lib/core/validate.js';
import { SISTEMA_TRADUCAO, lerTraducao } from '../../../lib/ai/traducao.js';
import { gerarImagem, editarFoto, promptEmIngles } from '../../../lib/ai/imagem.js';
import { roteiroVideo, roteiroFoto } from '../../../lib/ai/video.js';
import { estilosDoPedido } from '../../../lib/ai/avatar.js';
import { criarSite } from '../../../lib/ai/site.js';

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

  const au = validateAudio(input.audio);
  if (!au.ok) return Response.json({ erro: au.erro }, { status: 400 });

  const last = check.history[check.history.length - 1].text;
  // Áudio enviado: tradução/dublagem (capacidade 10). O app fala só a tradução.
  if (au.audio) {
    try {
      const pedido = last.replace(/^🎤 \[áudio\]\s*/, '') || 'Traduza este áudio.';
      const { text } = await askGemini({ history: [{ role: 'user', text: pedido }], audio: au.audio, sistema: SISTEMA_TRADUCAO,
        temperatura: 0.2, apiKey: process.env.GEMINI_API_KEY });
      const t = lerTraducao(text);
      const resposta = t.original
        ? `🗣️ **Você disse:** ${t.original}\n\n**Tradução${t.idioma ? ` (${t.idioma})` : ''}:** ${t.traducao || '—'}`
        : t.traducao;
      return Response.json({ resposta, fala: t.traducao || '', capacidade: 10, ia: true });
    } catch (e) {
      console.error('audio_error', e.message);
      const msg = ERRORS[e.message] || 'Não consegui ouvir o áudio agora. Tente de novo.';
      return Response.json({ erro: msg, codigo: String(e.message).slice(0, 200) }, { status: e.message === 'LIMITE' ? 429 : 502 });
    }
  }
  // Site (capacidade 18): o Gemini escreve a página inteira; o celular mostra a prévia.
  if (!img.imagem && detectIntent(last).capability.id === 18) {
    try {
      const s = await criarSite({ pedido: last, apiKey: process.env.GEMINI_API_KEY });
      return Response.json({ resposta: `🌐 **${s.titulo}**`, site: s, capacidade: 18, ia: true });
    } catch (e) {
      console.error('site_error', e.message);
      const msgs = { SEM_CHAVE: 'A criação de sites ainda não está conectada.', LIMITE: 'Limite de hoje atingido. Tente amanhã.' };
      return Response.json({ erro: msgs[e.message] || 'Não consegui criar o site agora. Tente de novo.', codigo: String(e.message).slice(0, 200) }, { status: 502 });
    }
  }
  // Animar foto (capacidade 6): roteiro curto a partir da foto; o celular anima a própria foto.
  if (img.imagem && !input.produto && pedidoAnimar(last)) {
    try {
      const r = await roteiroFoto({ pedido: last.replace(/^📷 \[foto\] /, ''), imagem: img.imagem, apiKey: process.env.GEMINI_API_KEY });
      return Response.json({ resposta: `✨ **${r.titulo}**`, video: r, capacidade: 6, ia: true });
    } catch (e) {
      console.error('animar_error', e.message);
      return Response.json({ erro: e.message === 'LIMITE' ? 'Limite de hoje atingido. Tente amanhã.' : 'Não consegui animar a foto agora.', codigo: String(e.message).slice(0, 200) }, { status: 502 });
    }
  }
  // Vídeo (capacidade 5): roteiro + cenas aqui; o celular junta com a narração e grava o vídeo.
  if (input.video || (!img.imagem && detectIntent(last).capability.id === 5)) {
    try {
      const pedido = last.replace(/^📷 \[foto\] /, '');
      const roteiro = await roteiroVideo({ pedido, apiKey: process.env.GEMINI_API_KEY });
      return Response.json({ resposta: `🎬 **${roteiro.titulo}**`, video: { ...roteiro, comFoto: Boolean(img.imagem?.ref) },
        capacidade: 5, ia: true });
    } catch (e) {
      console.error('video_error', e.message);
      const msgs = { SEM_CHAVE: 'A criação de vídeos ainda não está conectada.', LIMITE: 'Limite de hoje atingido. Tente amanhã.', TEMPO: 'Demorou demais. Tente de novo.' };
      return Response.json({ erro: msgs[e.message] || 'Não consegui criar o vídeo agora.', codigo: String(e.message).slice(0, 200) }, { status: 502 });
    }
  }
  // Avatares (capacidade 7): o celular pede cada estilo em /api/cena com a foto.
  if (img.imagem?.ref && !input.produto && pedidoAvatar(last)) {
    return Response.json({ resposta: '🧑‍🎨 **Seus avatares**', avatares: estilosDoPedido(last), capacidade: 7, ia: true });
  }
  const editar = img.imagem?.ref && (pedidoEdicao(last) || Boolean(input.produto));
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
            prompt: `Keep the product/subject from image 0 exactly as it is: same shape, same colors, and copy the printed label text letter by letter without changing, adding or misspelling any letter${typeof input.produto === 'string' ? ` (the product name printed on it is "${input.produto.slice(0, 40)}")` : ''}. Keep the product sharp and large in the frame. ${prompt}` })
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
