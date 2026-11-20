import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, VERSION_1 } from '../lib/core/capabilities.js';
import { detectIntent, pedidoEdicao } from '../lib/core/router.js';

test('as 25 capacidades estão registradas, com ids únicos de 1 a 25', () => {
  assert.equal(CAPABILITIES.length, 25);
  assert.deepEqual(CAPABILITIES.map((c) => c.id), Array.from({ length: 25 }, (_, i) => i + 1));
});

test('a versão 1 tem exatamente as 11 capacidades combinadas', () => {
  assert.deepEqual(VERSION_1.map((c) => c.id), [1, 2, 13, 14, 15, 16, 17, 20, 21, 22, 24]);
});

test('ativas: as 11 da versão 1 + análise de fotos (23)', () => {
  assert.deepEqual(CAPABILITIES.filter((c) => c.status === 'ativa').map((c) => c.id), [1, 2, 3, 4, 5, 9, 10, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24]);
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

import { limparTexto, pcmParaWav, narrar } from '../lib/ai/voz.js';

test('voz: limpa a formatação e cria WAV válido', () => {
  assert.equal(limparTexto('**Olá** # mundo'), 'Olá  mundo');
  const wav = pcmParaWav(Buffer.alloc(100));
  assert.equal(wav.length, 144);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(detectIntent('Faça uma narração sobre o mar').capability.id, 9);
  assert.equal(detectIntent('Faça uma narração sobre o mar').disponivel, true);
});

test('voz: pede áudio ao Gemini e devolve WAV', async () => {
  let body;
  const fake = async (url, opt) => { body = JSON.parse(opt.body); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(10).toString('base64') } }] } }] }) }; };
  const r = await narrar({ texto: 'Oi', apiKey: 'k', fetchImpl: fake });
  assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(Buffer.from(r.audio, 'base64').length, 54);
});

import { gerarImagem } from '../lib/ai/imagem.js';
test('imagem: pedido detectado e Cloudflare chamado', async () => {
  assert.equal(detectIntent('Crie uma imagem de um gato astronauta').capability.id, 3);
  let url = '';
  const fake = async (u) => { url = u; return { ok: true, status: 200, json: async () => ({ result: { image: 'QUJD' }, success: true }) }; };
  const r = await gerarImagem({ prompt: 'cat', accountId: 'abc', token: 't', fetchImpl: fake });
  assert.equal(r.imagem, 'QUJD');
  assert.ok(url.includes('/accounts/abc/ai/run/@cf/black-forest-labs/flux-1-schnell'));
  await assert.rejects(() => gerarImagem({ prompt: 'x', fetchImpl: fake }), /SEM_CHAVE/);
});

test('imagem: variações do pedido', () => {
  for (const t of ['Cria uma imagem de perfume da natura essencial', 'gera uma foto de praia', 'faz um desenho de gato', 'desenha um logo pra minha loja', 'me dá uma imagem de bolo'])
    assert.equal(detectIntent(t).capability.id, 3, t);
  assert.notEqual(detectIntent('o que é uma imagem vetorial?').capability.id, 3);
});

test('foto: editar x analisar', () => {
  assert.equal(pedidoEdicao('coloque numa mesa com flores'), true);
  assert.equal(pedidoEdicao('crie uma propaganda com esse perfume'), true);
  assert.equal(pedidoEdicao('O que tem nesta foto?'), false);
  assert.equal(pedidoEdicao('leia o que está escrito'), false);
});

import { pedidoSalvarProduto, acharProduto } from '../lib/core/produtos.js';
test('catálogo: entende "salve como" e acha o produto no pedido', () => {
  assert.equal(pedidoSalvarProduto('salve como Essencial'), 'Essencial');
  assert.equal(pedidoSalvarProduto('Guarde esta foto como "Perfume Kaiak".'), 'Perfume Kaiak');
  assert.equal(pedidoSalvarProduto('o que tem nesta foto?'), null);
  assert.equal(acharProduto('crie uma imagem do essencial na praia', ['Kaiak', 'Essencial']), 'Essencial');
  assert.equal(acharProduto('crie uma imagem de um gato', ['Essencial']), null);
});

import { lerTraducao } from '../lib/ai/traducao.js';
import { validateAudio } from '../lib/core/validate.js';
test('tradução de áudio: lê o formato e valida o áudio', () => {
  const r = lerTraducao('ORIGINAL: Olá, tudo bem?\nIDIOMA: inglês\nTRADUÇÃO: Hi, how are you?');
  assert.deepEqual(r, { original: 'Olá, tudo bem?', idioma: 'inglês', traducao: 'Hi, how are you?' });
  assert.equal(validateAudio({ mime: 'audio/webm;codecs=opus', data: 'AAAA' }).ok, true);
  assert.equal(validateAudio({ mime: 'video/mp4', data: 'AAAA' }).ok, false);
  assert.equal(validateAudio(undefined).audio, null);
});

import { lerRoteiro } from '../lib/ai/video.js';
import { pedidoVideo } from '../lib/core/router.js';
test('vídeo: pedido é reconhecido e roteiro JSON é lido', () => {
  assert.equal(pedidoVideo('Cria um vídeo do Essencial na praia'), true);
  assert.equal(pedidoVideo('faz uma propaganda em vídeo da minha loja'), true);
  assert.equal(pedidoVideo('Escreva um roteiro para meu vídeo do TikTok'), false);
  assert.equal(detectIntent('Crie um vídeo de um café da manhã').disponivel, true);
  const r = lerRoteiro('```json\n{"titulo":"T","narracao":"oi","cenas":[{"legenda":"a","prompt":"x"},{"legenda":"b","prompt":"y"}]}\n```');
  assert.equal(r.cenas.length, 2);
  assert.equal(lerRoteiro('nada'), null);
});
