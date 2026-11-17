/** NEXORA SECURITY — valida o que chega do navegador antes de ir para a IA. */
export const MAX_MSG = 4000;
export const MAX_HISTORY = 12;

export function validateChat(input) {
  const list = Array.isArray(input?.history) ? input.history : null;
  if (!list || list.length === 0) return { ok: false, erro: 'Mensagem vazia.' };
  const history = list.slice(-MAX_HISTORY).map((m) => ({
    role: m?.role === 'model' ? 'model' : 'user',
    text: String(m?.text ?? '').slice(0, MAX_MSG),
  })).filter((m) => m.text.trim());
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history[history.length - 1].role !== 'user') return { ok: false, erro: 'Mensagem vazia.' };
  return { ok: true, history };
}
