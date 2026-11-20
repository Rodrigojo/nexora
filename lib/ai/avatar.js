// Capacidade 7 — avatares: a foto da pessoa vira personagem em vários estilos (flux-2-klein, Cloudflare, grátis).
export const ESTILOS = [
  { nome: 'Desenho 3D', chave: /3d|pixar|disney/, prompt: 'as a cute 3D animated movie character, Pixar style, big expressive eyes, soft studio lighting, colorful background' },
  { nome: 'Anime', chave: /anime|manga|otaku/, prompt: 'as an anime character, Japanese anime illustration style, clean line art, vibrant colors, detailed eyes' },
  { nome: 'Quadrinhos', chave: /quadrinho|hq|gibi|comic|super ?heroi/, prompt: 'as a comic book superhero illustration, bold ink lines, dynamic pose, halftone shading, vivid colors' },
  { nome: 'Retrato profissional', chave: /profissional|linkedin|executiv|terno|curriculo/, prompt: 'as a professional corporate headshot photo, wearing elegant business attire, clean neutral studio background, soft lighting, ultra realistic' },
];
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Estilos pedidos: se a pessoa nomeou um estilo, só ele; senão, os 4. */
export function estilosDoPedido(texto) {
  const t = norm(texto);
  const achados = ESTILOS.filter((e) => e.chave.test(t));
  return (achados.length ? achados : ESTILOS).map(({ nome, prompt }) => ({ nome, prompt }));
}
export function promptAvatar(estilo) {
  return `Transform the person from image 0 ${String(estilo).slice(0, 400)}. Keep the same identity: same face shape, same facial features, same skin tone, same hair style and hair color, same gender and age. Portrait framing, face clearly visible, no text.`;
}
