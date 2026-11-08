const { sha256 } = require('./util');
const { novoAtendimentoId } = require('./booking');
const PARTES = 4, TAM_PARTE = 45000; // célula do Google Sheets aceita ~50.000 caracteres
const LIMITE = PARTES * TAM_PARTE - 2000;

function novoEstado(telefone, nome, agoraIso) {
  const conversa = sha256(telefone + agoraIso).slice(0, 12);
  return { v: 1, telefone, conversa_id: conversa, atendimento_id: novoAtendimentoId(telefone, conversa), criado_em: agoraIso,
    consentimento: null, aviso_enviado: false, turno: 0, mensagem_pendente_consent: null,
    paciente: { nome: '', nome_contato: nome || '', servico_codigo: '', motivo_texto: '' },
    slots_oferecidos: [], pendente: null, urgencia: 'NENHUM', escalado: false, ultimo_inbound_em: agoraIso, mensagens: [] };
}
function serializar(estado) {
  const s = JSON.stringify(estado);
  if (s.length > LIMITE) return null;
  const out = {};
  for (let i = 0; i < PARTES; i++) out['estado_' + (i + 1)] = s.slice(i * TAM_PARTE, (i + 1) * TAM_PARTE);
  return out;
}
function deserializar(linha) {
  if (!linha) return null;
  const s = [1, 2, 3, 4].map(i => linha['estado_' + i] || '').join('');
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function expirou(estado, ttlDias, agoraMs) { return !estado || (agoraMs - Date.parse(estado.ultimo_inbound_em)) > ttlDias * 86400000; }
// O histórico é append-only (blocos de resposta do modelo, inclusive de raciocínio, devem voltar intactos).
// Ao estourar o limite, NÃO se corta o meio do histórico: inicia-se nova conversa preservando só dados estruturados.
function reiniciarComResumo(estado, agoraIso) {
  const n = novoEstado(estado.telefone, estado.paciente.nome_contato, agoraIso);
  n.consentimento = estado.consentimento; n.aviso_enviado = estado.aviso_enviado;
  n.paciente = { ...estado.paciente, motivo_texto: '' }; n.turno = 0;
  return n;
}
module.exports = { PARTES, TAM_PARTE, LIMITE, novoEstado, serializar, deserializar, expirou, reiniciarComResumo };
