import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, VERSION_1 } from '../lib/core/capabilities.js';
import { detectIntent } from '../lib/core/router.js';

test('as 25 capacidades estão registradas, com ids únicos de 1 a 25', () => {
  assert.equal(CAPABILITIES.length, 25);
  assert.deepEqual(CAPABILITIES.map((c) => c.id), Array.from({ length: 25 }, (_, i) => i + 1));
});

test('a versão 1 tem exatamente as 11 capacidades combinadas', () => {
  assert.deepEqual(VERSION_1.map((c) => c.id), [1, 2, 13, 14, 15, 16, 17, 20, 21, 22, 24]);
});

test('ativas: as 11 da versão 1 + análise de fotos (23)', () => {
  assert.deepEqual(CAPABILITIES.filter((c) => c.status === 'ativa').map((c) => c.id), [1, 2, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24]);
});

test('o núcleo identifica intenções', () => {
  assert.equal(detectIntent('Crie um anúncio para minha loja').capability.id, 13);
  assert.equal(detectIntent('Tenho um erro no código python').capability.id, 17);
  assert.equal(detectIntent('Monte um simulado de matemática').capability.id, 15);
  assert.equal(detectIntent('Olá, tudo bem?').capability.id, 1);
});

test('capacidades futuras são marcadas como indisponíveis', () => {
  const r = detectIntent('Faça uma música para meu vídeo');
  assert.equal(r.disponivel, false);
});

test('roteiro para vídeo é texto e fica disponível', () => {
  assert.equal(detectIntent('Escreva um roteiro para meu vídeo do TikTok').disponivel, true);
  assert.equal(detectIntent('Crie um vídeo do meu produto').capability.id, 5);
});

import { validateChat, validateImage } from '../lib/core/validate.js';
import { askGemini } from '../lib/ai/gemini.js';

test('validação recusa vazio e corta excesso', () => {
  assert.equal(validateChat({}).ok, false);
  assert.equal(validateChat({ history: [{ role: 'model', text: 'oi' }] }).ok, false);
  const r = validateChat({ history: [{ role: 'user', text: 'x'.repeat(9000) }] });
  assert.equal(r.ok, true);
  assert.equal(r.history[0].text.length, 4000);
});

test('Gemini: usa a chave no cabeçalho, troca de modelo no 404 e lê a resposta', async () => {
  const calls = [];
  const fake = async (url, opt) => {
    calls.push({ url, key: opt.headers['x-goog-api-key'] });
    if (calls.length === 1) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Olá!' }] } }] }) };
  };
  const r = await askGemini({ history: [{ role: 'user', text: 'oi' }], cap: null, apiKey: 'k', fetchImpl: fake });
  assert.equal(r.text, 'Olá!');
  assert.equal(calls.length, 3); // 404, lista de modelos, próximo modelo
  assert.ok(calls.every((c) => c.key === 'k' && !c.url.includes('key=')));
});

test('Gemini: sem chave dá erro claro', async () => {
  await assert.rejects(askGemini({ history: [], apiKey: '' }), /SEM_CHAVE/);
});

test('foto: aceita JPEG válido, recusa outros formatos', () => {
  assert.equal(validateImage(null).imagem, null);
  assert.equal(validateImage({ mime: 'image/jpeg', data: 'QUJD' }).ok, true);
  assert.equal(validateImage({ mime: 'image/gif', data: 'QUJD' }).ok, false);
  assert.equal(validateImage({ mime: 'image/png', data: 'x y' }).ok, false);
});

test('Gemini: envia a foto junto da última mensagem', async () => {
  let body;
  const fake = async (url, opt) => { body = JSON.parse(opt.body); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Um gato.' }] } }] }) }; };
  await askGemini({ history: [{ role: 'user', text: 'o que é?' }], apiKey: 'k', imagem: { mime: 'image/jpeg', data: 'QUJD' }, fetchImpl: fake });
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
  assert.equal(body.contents[0].parts[1].text, 'o que é?');
});
