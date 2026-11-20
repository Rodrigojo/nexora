/**
 * NEXORA CORE — Identificação de intenção.
 * Etapa 1: classificação local por palavras-chave (rápida e sem custo de API).
 * Etapa 3: o modelo de IA confirma/ajusta a intenção quando houver dúvida.
 */
import { CAPABILITIES, getCapability } from './capabilities.js';

const normalize = (t) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PEDIDO_IMAGEM = /\b(cri[ae]r?|ger[ae]r?|fa(z|ca|zer)|desenh[ae]r?|produz[ae]?|mont[ae]r?|me (de|da|manda|mande))\b(\s+\S+){0,3}?\s+(uma?\s+)?(uma arte|imagem|imagens|foto|fotos|desenho|ilustracao|figura|logo|logotipo|avatar|personagem|wallpaper|papel de parede|poster|cartaz)\b/;

// Pedido de vídeo (capacidade 5): "crie um vídeo", "faz uma propaganda em vídeo", "gera um reels"...
const PEDIDO_VIDEO = /\b(cri[ae]r?|ger[ae]r?|fa(z|ca|zer)|produz[ae]?|mont[ae]r?|me (de|da|manda|mande)|quero)\b(\s+\S+){0,4}?\s+(uma?\s+)?(video|videos|reels|reel|clipe|propaganda em video|comercial)\b/;
export function pedidoVideo(message) {
  const t = normalize(message);
  return PEDIDO_VIDEO.test(t) && !/\b(roteiro|legenda|ideias?|texto|script|musica|trilha|thumbnail|capa)\b|\bpara (o |um |meu |minha |seu )?video/.test(t);
}

// Com foto: pedido para criar/transformar a partir dela (capacidade 4), em vez de só analisar (23).
const PEDIDO_EDICAO = /\b(coloc|coloqu|ponha|poe\b|bot[ae]|transform|mud[ae]|troc[ae]|troqu|remov|tir[ae] o fundo|edit|mont[ae]|cri[ae]|ger[ae]|fa(z|ca|zer)\b|deix[ae]|adicion|melhor|cenario|fundo|propaganda|estilo)/;
export function pedidoEdicao(message) {
  const t = normalize(message);
  return PEDIDO_EDICAO.test(t) && !/^(o )?(que|qual|quais|quem|quanto|onde|leia|descreva|explique|analise)\b/.test(t.trim());
}

// Pedido de site/página (capacidade 18): "crie um site", "faz uma landing page", "monta uma página para minha loja".
const PEDIDO_SITE = /\b(cri[ae]r?|ger[ae]r?|fa(z|ca|zer)|mont[ae]r?|quero|me (de|da|manda|mande)|desenvolv[ae]r?|program[ae]r?)\b(\s+\S+){0,4}?\s+(uma?\s+)?(site|sites|landing ?page|pagina (de|da|do|para|pra|web|na internet)|pagina web|cardapio digital|loja virtual)\b/;
export function pedidoSite(message) {
  const t = normalize(message);
  return PEDIDO_SITE.test(t) && !/\b(ideias?|nome para|texto para|legenda)\b/.test(t);
}

// Apresentador virtual (capacidade 8): com ou sem foto.
export function pedidoApresentador(message) {
  return /\b(apresentador|apresentadora|apresentadores|ancora de jornal|jornalista virtual)\b/.test(normalize(message));
}

// Com foto: animar a foto (capacidade 6) — "anime essa foto", "dá vida", "coloca movimento".
const PEDIDO_ANIMAR = /\b(anim(a|ar|e|ada|ado|acao)|da(r|ndo)? vida|ganh(a|ar|e) vida|movimento|mex(a|er|endo))\b/;
export function pedidoAnimar(message) {
  const t = normalize(message);
  return PEDIDO_ANIMAR.test(t) && !/avatar|personagem|pixar|disney|quadrinho|(estilo|desenho|versao|versoes) (de )?anime|em anime/.test(t);
}

// Com foto: transformar a pessoa em avatar/personagem (capacidade 7).
const PEDIDO_AVATAR = /\b(avatar|avatares|personagem|anime|pixar|disney|desenho 3d|cartoon|quadrinhos?|super ?heroi|me (transform|desenh|deix)|vers(ao|oes) (de )?(desenho|anime))/;
export function pedidoAvatar(message) { return PEDIDO_AVATAR.test(normalize(message)); }

export function detectIntent(message) {
  const text = normalize(message);
  if (!text.trim()) return { capability: getCapability(1), score: 0, disponivel: true };
  if (pedidoApresentador(message)) {
    const cap = getCapability(8);
    return { capability: cap, score: 99, disponivel: cap.status === 'ativa' };
  }
  if (pedidoSite(message)) {
    const cap = getCapability(18);
    return { capability: cap, score: 99, disponivel: cap.status === 'ativa' };
  }
  if (pedidoVideo(message)) {
    const cap = getCapability(5);
    return { capability: cap, score: 99, disponivel: cap.status === 'ativa' };
  }
  // Pedido de criar imagem, em qualquer forma do verbo ("cria", "crie", "gera", "faz", "desenha"...).
  if (PEDIDO_IMAGEM.test(text)) {
    const cap = getCapability(3);
    return { capability: cap, score: 99, disponivel: cap.status === 'ativa' };
  }
  let best = null;
  let bestScore = 0;
  for (const cap of CAPABILITIES) {
    let score = 0;
    for (const p of cap.palavras) if (text.includes(normalize(p))) score += normalize(p).length;
    if (score > bestScore) { best = cap; bestScore = score; }
  }
  const capability = best || getCapability(1); // padrão: conversa
  return { capability, score: bestScore, disponivel: capability.status === 'ativa' };
}

/** Mensagem honesta quando a capacidade ainda não existe. */
export function unavailableMessage(cap) {
  return `A capacidade "${cap.nome}" faz parte da NEXORA, mas ainda não está disponível. ` +
    'Não vou simular um resultado. Posso ajudar com o planejamento ou o texto dessa tarefa.';
}
