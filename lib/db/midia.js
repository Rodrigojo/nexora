'use client';
// Guarda vídeos e imagens criados no próprio aparelho (IndexedDB), para reabrir a conversa e ver de novo.
const BANCO = 'nexora-midia';
function abrir() {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}
export function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export async function guardar(id, blob) {
  try {
    const db = await abrir();
    await new Promise((ok, falha) => { const t = db.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').put(blob, id); t.oncomplete = ok; t.onerror = () => falha(t.error); });
  } catch (e) { console.error('midia', e); }
}
export async function pegar(id) {
  try {
    const db = await abrir();
    return await new Promise((ok) => { const r = db.transaction('arquivos').objectStore('arquivos').get(id); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
  } catch { return null; }
}
const MARCA = /\[(vídeo criado|imagem criada) #([a-z0-9]+)\]/;
export function lerMarca(texto) {
  const a = /\[avatares criados ((?:#[a-z0-9]+ ?)+)\]/.exec(texto || '');
  if (a) return { tipo: 'avatares', ids: a[1].trim().split(/\s+/).map((x) => x.slice(1)) };
  const m = MARCA.exec(texto || '');
  return m ? { tipo: m[1].startsWith('v') ? 'video' : 'imagem', id: m[2] } : null;
}
