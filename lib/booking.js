const { sha256, phoneHash } = require('./util');
const { confirmacaoExplicita } = require('./consent');
const { dataHoraTexto } = require('./slots');

// ID determinístico do evento no Google Agenda (base32hex: 0-9a-v; hex serve).
// Tentar criar o mesmo (profissional, horário) duas vezes gera 409 -> trava atômica contra corrida.
function eventoId(profId, inicioIso) { return sha256(`vs|${profId}|${new Date(inicioIso).toISOString()}`).slice(0, 32); }
function novoAtendimentoId(telefone, conversaId) { return 'ATD-' + sha256(`${telefone}|${conversaId}`).slice(0, 10).toUpperCase(); }

function nomeCompletoOk(n) { return /^\S{2,}(\s+\S{2,})+$/.test(String(n || '').trim()); }

function validarProposta(state, args, cfg, servicoFn) {
  const { acao } = args;
  if (!['agendar', 'remarcar', 'cancelar'].includes(acao)) return { ok: false, erro: 'acao_invalida' };
  if (state.consentimento !== 'sim') return { ok: false, erro: 'sem_consentimento' };
  if (acao === 'agendar' || acao === 'remarcar') {
    const slot = (state.slots_oferecidos || []).find(s => s.slot_id === args.slot_id);
    if (!slot) return { ok: false, erro: 'slot_nao_oferecido', dica: 'Use apenas slot_id retornado por consultar_agenda nesta conversa.' };
    const nome = args.nome_completo || state.paciente.nome;
    if (!nomeCompletoOk(nome)) return { ok: false, erro: 'nome_completo_necessario' };
    const codigo = args.servico_codigo || state.paciente.servico_codigo;
    if (!codigo || !servicoFn(cfg, codigo)) return { ok: false, erro: 'servico_invalido' };
    if (acao === 'remarcar' && !args.evento_id_atual) return { ok: false, erro: 'evento_atual_necessario' };
    return { ok: true, pendente: { acao, slot, nome, servico_codigo: codigo, evento_id_atual: args.evento_id_atual || null } };
  }
  if (!args.evento_id_atual) return { ok: false, erro: 'evento_atual_necessario' };
  return { ok: true, pendente: { acao, evento_id_atual: args.evento_id_atual } };
}

// Só executa se: há proposta feita em turno ANTERIOR, ainda válida, e a mensagem atual do paciente é um "sim" inequívoco.
function validarExecucao(state, textoAtual, agoraMs, ttlMin = 30) {
  const p = state.pendente;
  if (!p) return { ok: false, erro: 'nada_pendente' };
  if (state.consentimento !== 'sim') return { ok: false, erro: 'sem_consentimento' };
  if (!(state.turno > p.proposto_no_turno)) return { ok: false, erro: 'confirmacao_no_mesmo_turno' };
  if (agoraMs - Date.parse(p.proposto_em) > ttlMin * 60000) return { ok: false, erro: 'proposta_expirada' };
  if (!confirmacaoExplicita(textoAtual)) return { ok: false, erro: 'confirmacao_nao_explicita' };
  return { ok: true, pendente: p };
}

function montarEvento({ evento_id, nome, servico, prof, inicioIso, fimIso, telefone, atendimentoId, cfg }) {
  return {
    id: evento_id,
    summary: `${nome} — ${servico.nome}`,
    location: cfg.clinica.endereco,
    description: `Agendado pelo assistente virtual. Atendimento: ${atendimentoId}. Profissional: ${prof.nome}.`,
    start: { dateTime: inicioIso }, end: { dateTime: fimIso },
    reminders: { useDefault: false },
    extendedProperties: { private: { clinica: 'vamos-sorrir', telefone, telefone_hash: phoneHash(telefone), servico_codigo: servico.codigo, atendimento_id: atendimentoId, profissional_id: prof.id, nome_paciente: nome } },
  };
}
// Mensagem determinística de confirmação (não passa pelo LLM).
function mensagemConfirmacao({ nome, inicioMs, offset, prof, cfg, remarcado }) {
  const { data, hora } = dataHoraTexto(inicioMs, offset);
  const orient = cfg.agenda.orientacoes_consulta && !String(cfg.agenda.orientacoes_consulta).includes('__PREENCHER__') ? `\n\nℹ️ ${cfg.agenda.orientacoes_consulta}` : '';
  return `Perfeito${nome ? ', ' + nome.split(' ')[0] : ''}! 😊 Sua consulta na ${cfg.clinica.nome} está ${remarcado ? 'remarcada e ' : ''}confirmada!\n\n📅 Data: ${data}\n⏰ Horário: ${hora}\n🦷 Profissional: ${prof.nome}\n📍 Endereço: ${cfg.clinica.endereco}${orient}\n\nSerá um prazer receber você!`;
}
module.exports = { eventoId, novoAtendimentoId, nomeCompletoOk, validarProposta, validarExecucao, montarEvento, mensagemConfirmacao };
