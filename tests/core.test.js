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

test('nenhuma capacidade aparece como ativa antes da integração real', () => {
  assert.ok(CAPABILITIES.every((c) => c.status === 'planejada'));
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
