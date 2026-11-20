/**
 * NEXORA CORE — Identificação de intenção.
 * Etapa 1: classificação local por palavras-chave (rápida e sem custo de API).
 * Etapa 3: o modelo de IA confirma/ajusta a intenção quando houver dúvida.
 */
import { CAPABILITIES, getCapability } from './capabilities.js';

const normalize = (t) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PEDIDO_IMAGEM = /\b(cri[ae]r?|ger[ae]r?|fa(z|ca|zer)|desenh[ae]r?|produz[ae]?|mont[ae]r?|me (de|da|manda|mande))\b(\s+\S+){0,3}?\s+(uma?\s+)?(uma arte|imagem|imagens|foto|fotos|desenho|ilustracao|figura|logo|logotipo|wallpaper|papel de parede|poster|cartaz)\b/;

// Com foto: pedido para criar/transformar a partir dela (capacidade 4), em vez de só analisar (23).
const PEDIDO_EDICAO = /\b(coloc|coloqu|ponha|poe\b|bot[ae]|transform|mud[ae]|troc[ae]|troqu|remov|tir[ae] o fundo|edit|mont[ae]|cri[ae]|ger[ae]|fa(z|ca|zer)\b|deix[ae]|adicion|melhor|cenario|fundo|propaganda|estilo)/;
export function pedidoEdicao(message) {
  const t = normalize(message);
  return PEDIDO_EDICAO.test(t) && !/^(o )?(que|qual|quais|quem|quanto|onde|leia|descreva|explique|analise)\b/.test(t.trim());
}

export function detectIntent(message) {
  const text = normalize(message);
  if (!text.trim()) return { capability: getCapability(1), score: 0, disponivel: true };
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
