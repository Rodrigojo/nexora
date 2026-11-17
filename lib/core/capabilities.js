/**
 * NEXORA CORE — Registro oficial das 25 capacidades.
 * status: "ativa" (implementada e testada), "planejada" (registrada, ainda não disponível).
 * Regra do projeto: nada é marcado "ativa" sem código real e teste passando.
 * 2026-11-16: as 11 da versão 1 passaram a "ativa" após o chat com Gemini ser verificado no ar.
 */
export const MODULES = {
  MIND: 'NEXORA MIND', KNOWLEDGE: 'NEXORA KNOWLEDGE', VISION: 'NEXORA VISION',
  MOTION: 'NEXORA MOTION', VOICE: 'NEXORA VOICE', MUSIC: 'NEXORA MUSIC',
  CODE: 'NEXORA CODE', BUSINESS: 'NEXORA BUSINESS', MEMORY: 'NEXORA MEMORY',
  SECURITY: 'NEXORA SECURITY',
};

const c = (id, nome, modulo, versao, palavras) =>
  Object.freeze({ id, nome, modulo, versao, status: versao === 1 ? 'ativa' : 'planejada', palavras });

export const CAPABILITIES = Object.freeze([
  c(1, 'Conversação e raciocínio', MODULES.MIND, 1, ['explique', 'por que', 'ajude', 'decida', 'compare']),
  c(2, 'Pesquisa e conhecimento', MODULES.KNOWLEDGE, 1, ['pesquise', 'pesquisa', 'resuma', 'relatório', 'fontes']),
  c(3, 'Criação de imagens', MODULES.VISION, 2, ['crie uma imagem', 'gere uma imagem', 'ilustração']),
  c(4, 'Transformação de fotografias', MODULES.VISION, 2, ['edite a foto', 'remova o fundo', 'restaure']),
  c(5, 'Geração de vídeos', MODULES.MOTION, 3, ['crie um vídeo', 'gere um vídeo', 'gerar vídeo', 'faça um vídeo', 'produza um vídeo', 'transforme em vídeo']),
  c(6, 'Animação de fotografias', MODULES.MOTION, 3, ['anime', 'animar']),
  c(7, 'Criação de avatares', MODULES.VISION, 3, ['avatar', 'personagem']),
  c(8, 'Apresentadores virtuais', MODULES.MOTION, 3, ['apresentador']),
  c(9, 'Vozes e narrações', MODULES.VOICE, 2, ['narração', 'narre', 'voz']),
  c(10, 'Dublagem e tradução de áudio', MODULES.VOICE, 2, ['dublagem', 'dublar', 'transcreva', 'legenda']),
  c(11, 'Criação de músicas', MODULES.MUSIC, 3, ['música', 'musica', 'melodia', 'trilha']),
  c(12, 'Edição profissional de vídeos', MODULES.MOTION, 3, ['edite o vídeo', 'cortar cenas']),
  c(13, 'Marketing e publicidade', MODULES.BUSINESS, 1, ['anúncio', 'campanha', 'propaganda', 'marketing', 'legenda para post']),
  c(14, 'Comércio eletrônico e vendas', MODULES.BUSINESS, 1, ['produto', 'shopee', 'mercado livre', 'tiktok shop', 'vender', 'descrição']),
  c(15, 'Estudos e educação', MODULES.KNOWLEDGE, 1, ['aula', 'estudar', 'exercícios', 'simulado', 'ensine']),
  c(16, 'Documentos e apresentações', MODULES.KNOWLEDGE, 1, ['documento', 'contrato', 'proposta', 'currículo', 'apresentação']),
  c(17, 'Programação e desenvolvimento', MODULES.CODE, 1, ['código', 'codigo', 'programa', 'erro no', 'javascript', 'python']),
  c(18, 'Criação de sites e aplicativos', MODULES.CODE, 3, ['crie um site', 'crie um aplicativo']),
  c(19, 'Automação empresarial', MODULES.BUSINESS, 3, ['automatize', 'automação']),
  c(20, 'Análise de dados', MODULES.KNOWLEDGE, 1, ['planilha', 'dados', 'gráfico', 'calcule', 'tendência']),
  c(21, 'Assistente pessoal', MODULES.MIND, 1, ['lembrete', 'compromisso', 'lista', 'rotina']),
  c(22, 'Organização e produtividade', MODULES.MIND, 1, ['organize', 'cronograma', 'prioridades', 'planejamento']),
  c(23, 'Análise de imagens, áudios e vídeos', MODULES.VISION, 2, ['analise esta imagem', 'o que tem na foto']),
  c(24, 'Assistência empresarial e profissional', MODULES.BUSINESS, 1, ['empresa', 'negócio', 'estratégia', 'clientes']),
  c(25, 'Expansão e evolução contínua', MODULES.SECURITY, 0, []),
]);

/** As 11 capacidades da versão 1. */
export const VERSION_1 = CAPABILITIES.filter((x) => x.versao === 1);

export function getCapability(id) {
  return CAPABILITIES.find((x) => x.id === id) || null;
}
