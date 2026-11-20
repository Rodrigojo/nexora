/**
 * NEXORA VOICE — tradução de áudio (capacidade 10).
 * O Gemini ouve o áudio, transcreve e traduz; depois o app fala a tradução (Gemini TTS).
 */
export const SISTEMA_TRADUCAO = [
  'Você é o tradutor de áudio da NEXORA.',
  'Ouça o áudio, transcreva exatamente o que foi dito e traduza.',
  'Idioma de destino: o que o usuário pedir no texto. Se ele não disser, traduza português para inglês, e qualquer outro idioma para português do Brasil.',
  'Traduza de forma natural, como uma pessoa nativa falaria. Não invente nada que não foi dito. Se o áudio estiver mudo ou incompreensível, diga isso em ORIGINAL e deixe TRADUÇÃO vazia.',
  'Responda exatamente neste formato, sem mais nada:',
  'ORIGINAL: <transcrição>',
  'IDIOMA: <idioma de destino, em português>',
  'TRADUÇÃO: <tradução>',
].join('\n');

/** Separa a resposta do modelo em { original, idioma, traducao }. */
export function lerTraducao(texto) {
  const t = String(texto || '');
  const pega = (rotulo, prox) => {
    const m = t.match(new RegExp(`${rotulo}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${prox})\\s*:|$)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const original = pega('ORIGINAL', 'IDIOMA|TRADU[ÇC][ÃA]O');
  const idioma = pega('IDIOMA', 'TRADU[ÇC][ÃA]O|ORIGINAL');
  const traducao = pega('TRADU[ÇC][ÃA]O', 'ORIGINAL|IDIOMA');
  if (!original && !traducao) return { original: '', idioma: '', traducao: t.trim() };
  return { original, idioma, traducao };
}
