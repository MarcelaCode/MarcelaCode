const { sanitizeCell } = require('./util');
const STATUS = ['Novo contato', 'Em atendimento', 'Aguardando confirmação', 'Agendado', 'Remarcado', 'Cancelado', 'Concluído', 'Encaminhado para atendimento humano'];
// Transições permitidas (evita regressões do tipo Cancelado -> Em atendimento por mensagem atrasada).
const TRANSICOES = {
  '': STATUS,
  'Novo contato': STATUS,
  'Em atendimento': ['Em atendimento', 'Aguardando confirmação', 'Agendado', 'Cancelado', 'Concluído', 'Encaminhado para atendimento humano'],
  'Aguardando confirmação': ['Em atendimento', 'Aguardando confirmação', 'Agendado', 'Cancelado', 'Encaminhado para atendimento humano'],
  'Agendado': ['Agendado', 'Remarcado', 'Cancelado', 'Concluído', 'Encaminhado para atendimento humano'],
  'Remarcado': ['Agendado', 'Remarcado', 'Cancelado', 'Concluído', 'Encaminhado para atendimento humano'],
  'Cancelado': ['Cancelado', 'Em atendimento', 'Encaminhado para atendimento humano'],
  'Concluído': ['Concluído'],
  'Encaminhado para atendimento humano': STATUS,
};
function transicaoValida(de, para) { return STATUS.includes(para) && (TRANSICOES[de || ''] || STATUS).includes(para); }

const COLUNAS = {
  Atendimentos: ['id_atendimento', 'nome_paciente', 'whatsapp', 'motivo_contato', 'tipo_consulta', 'data_agendamento', 'horario', 'profissional', 'status', 'data_criacao', 'ultima_atualizacao', 'evento_id', 'presenca_confirmada', 'consentimento_em'],
  Sessoes: ['telefone', 'estado_1', 'estado_2', 'estado_3', 'estado_4', 'consentimento', 'ultimo_inbound_em', 'atualizado_em', 'expira_em'],
  Fila_Entrada: ['wamid', 'telefone', 'tipo', 'texto', 'media_id', 'status', 'tentativas', 'proxima_tentativa_em', 'recebido_em', 'atualizado_em', 'nome_contato'],
  Lembretes: ['chave', 'evento_id', 'telefone_hash', 'status', 'tentativas', 'wamid_envio', 'criado_em', 'atualizado_em'],
  Erros: ['id', 'ocorrido_em', 'workflow', 'no', 'mensagem', 'execucao_id', 'chave_erro', 'notificado'],
  Auditoria: ['id', 'ocorrido_em', 'evento', 'ator', 'telefone_hash', 'referencia', 'detalhe'],
};
function linha(aba, dados) {
  const out = {};
  for (const c of COLUNAS[aba]) out[c] = sanitizeCell(dados[c]);
  return out;
}
// Só as colunas informadas (atualização parcial não apaga o que já existe).
function linhaParcial(aba, dados) {
  const out = {};
  for (const c of COLUNAS[aba]) if (dados[c] !== undefined && dados[c] !== null) out[c] = sanitizeCell(dados[c]);
  return out;
}
module.exports = { STATUS, COLUNAS, transicaoValida, linha, linhaParcial };
