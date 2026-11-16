/**
 * NEXORA CORE — Identificação de intenção.
 * Etapa 1: classificação local por palavras-chave (rápida e sem custo de API).
 * Etapa 3: o modelo de IA confirma/ajusta a intenção quando houver dúvida.
 */
import { CAPABILITIES, getCapability } from './capabilities.js';

const normalize = (t) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function detectIntent(message) {
  const text = normalize(message);
  if (!text.trim()) return { capability: getCapability(1), score: 0, disponivel: true };
  let best = null;
  let bestScore = 0;
  for (const cap of CAPABILITIES) {
    let score = 0;
    for (const p of cap.palavras) if (text.includes(normalize(p))) score += normalize(p).length;
    if (score > bestScore) { best = cap; bestScore = score; }
  }
  const capability = best || getCapability(1); // padrão: conversa
  return { capability, score: bestScore, disponivel: capability.versao === 1 };
}

/** Mensagem honesta quando a capacidade ainda não existe. */
export function unavailableMessage(cap) {
  return `A capacidade "${cap.nome}" faz parte da NEXORA, mas ainda não está disponível. ` +
    'Não vou simular um resultado. Posso ajudar com o planejamento ou o texto dessa tarefa.';
}
