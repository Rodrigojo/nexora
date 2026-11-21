// Capacidade 12 — "Editar sozinho": o Gemini olha 4 quadros do vídeo e decide corte, texto, filtro e velocidade.
export const runtime = 'nodejs';
export const maxDuration = 30;
const FILTROS = ['Normal', 'Preto e branco', 'Cores vivas', 'Quente', 'Clarear'];

export function lerEdicao(txt, duracao) {
  const m = String(txt || '').match(/\{[\s\S]*\}/);
  let j = {}; try { j = m ? JSON.parse(m[0]) : {}; } catch {}
  const d = Math.max(1, Number(duracao) || 10);
  let ini = Math.max(0, Math.min(d - 1, Number(j.inicio) || 0));
  let fim = Math.max(ini + 1, Math.min(d, Number(j.fim) || d));
  if (fim - ini > 60) fim = ini + 60;
  return {
    inicio: Math.round(ini * 10) / 10, fim: Math.round(fim * 10) / 10,
    texto: String(j.texto || '').slice(0, 60),
    posicao: ['cima', 'meio', 'baixo'].includes(j.posicao) ? j.posicao : 'baixo',
    filtro: FILTROS.includes(j.filtro) ? j.filtro : 'Cores vivas',
    velocidade: [0.5, 1, 1.5, 2].includes(Number(j.velocidade)) ? Number(j.velocidade) : 1,
  };
}

export async function POST(req) {
  let input; try { input = await req.json(); } catch { return Response.json({ erro: 'Pedido inválido.' }, { status: 400 }); }
  const quadros = (Array.isArray(input?.quadros) ? input.quadros : []).filter((q) => typeof q?.data === 'string' && q.data.length < 300000).slice(0, 5);
  const duracao = Number(input?.duracao) || 10;
  if (!quadros.length) return Response.json({ erro: 'Sem quadros do vídeo.' }, { status: 400 });
  const instr = `Você é editor de vídeos curtos para Reels/TikTok. Recebeu ${quadros.length} quadros de um vídeo de ${duracao.toFixed(1)} segundos (tempos: ${quadros.map((q) => `${Number(q.t).toFixed(1)}s`).join(', ')}).
Decida a melhor edição. Responda SOMENTE com JSON: {"inicio":segundos,"fim":segundos,"texto":"frase curta e chamativa em português sobre o que aparece, até 6 palavras","posicao":"cima|meio|baixo","filtro":"Normal|Preto e branco|Cores vivas|Quente|Clarear","velocidade":0.5|1|1.5|2}
Corte partes paradas ou tremidas do começo e do fim; mantenha o melhor trecho (de preferência até 30 s). Use velocidade 1 se houver pessoas falando.${input?.pedido ? ` Pedido da pessoa: ${String(input.pedido).slice(0, 300)}` : ''}`;
  const parts = [{ text: instr }];
  for (const q of quadros) parts.push({ text: `Quadro em ${Number(q.t).toFixed(1)}s:` }, { inlineData: { mimeType: 'image/jpeg', data: q.data } });
  const erros = [];
  for (const modelo of ['gemini-2.5-flash', 'gemini-flash-latest']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } }),
      });
      if (r.status === 429) return Response.json({ erro: 'Limite de hoje atingido. Tente amanhã.' }, { status: 429 });
      if (!r.ok) { let w = ''; try { w = (await r.json())?.error?.message?.slice(0, 120) || ''; } catch {} erros.push(`${r.status}:${modelo}:${w}`); continue; }
      const j = await r.json();
      return Response.json(lerEdicao(j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''), duracao));
    } catch (e) { erros.push(`${e.name}:${modelo}`); }
  }
  return Response.json({ erro: 'Não consegui analisar o vídeo agora.', codigo: erros.join('|').slice(0, 300) }, { status: 502 });
}
