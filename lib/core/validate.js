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

/** Foto enviada para análise: só JPEG/PNG/WEBP, até ~3 MB (base64). */
export const IMG_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMG_B64 = 4_000_000;
export function validateImage(img) {
  if (img == null) return { ok: true, imagem: null };
  const mime = String(img?.mime || '');
  const data = String(img?.data || '');
  if (!IMG_TIPOS.includes(mime)) return { ok: false, erro: 'Formato de foto não aceito. Use JPG, PNG ou WEBP.' };
  if (!data || data.length > MAX_IMG_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, erro: 'Foto grande demais ou inválida.' };
  return { ok: true, imagem: { mime, data } };
}
