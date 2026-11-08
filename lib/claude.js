const { vazio, infoClinica, servico } = require('./config');
const { validarProposta, validarExecucao, novoAtendimentoId } = require('./booking');
const { dataHoraTexto } = require('./slots');

const MAX_ITER = 6;
const esc = s => String(s || '').replace(/<\/?\s*(contexto_sistema|mensagem_paciente)[^>]*>/gi, '');

function ferramentas() {
  const str = (d, extra) => ({ type: 'string', description: d, ...extra });
  const tool = (name, description, props, required = []) => ({ name, description, input_schema: { type: 'object', properties: props, required, additionalProperties: false } });
  return [
    tool('consultar_info_clinica', 'Consulta informações oficiais da clínica (endereço, telefone, horários, profissionais, serviços, preços, pagamento, orientações). Use SEMPRE em vez de responder de memória. Se vier "não configurado", não invente.',
      { topico: str('Tópico', { enum: ['endereco', 'telefone', 'horario_funcionamento', 'profissionais', 'servicos', 'precos', 'formas_pagamento', 'orientacoes_consulta'] }) }, ['topico']),
    tool('salvar_dados_paciente', 'Registra dados que o paciente informou (nome completo, serviço desejado, motivo em poucas palavras). Colete só o necessário.',
      { nome_completo: str('Nome completo informado pelo paciente'), servico_codigo: str('Código do serviço (ver lista de serviços)'), motivo_texto: str('Motivo em até 120 caracteres, sem detalhes clínicos desnecessários') }),
    tool('consultar_agenda', 'Consulta a agenda em tempo real e devolve até 2 horários livres. É o ÚNICO modo de saber se há horário disponível.',
      { servico_codigo: str('Código do serviço'), periodo: str('Preferência de período', { enum: ['manha', 'tarde', 'noite'] }), data_minima: str('Data mínima AAAA-MM-DD, se o paciente pediu'), profissional_id: str('Só se o paciente pediu um profissional específico'), urgencia: { type: 'boolean', description: 'true para caso de urgência: busca os primeiros horários' } }, ['servico_codigo']),
    tool('listar_minhas_consultas', 'Lista as consultas futuras do paciente atual (necessário para remarcar, cancelar ou confirmar presença).', {}),
    tool('propor_acao', 'Registra a PROPOSTA de agendar/remarcar/cancelar e a deixa aguardando confirmação. Depois de chamar, apresente o resumo ao paciente e peça confirmação explícita. NÃO executa nada.',
      { acao: str('Ação', { enum: ['agendar', 'remarcar', 'cancelar'] }), slot_id: str('slot_id retornado por consultar_agenda (agendar/remarcar)'), nome_completo: str('Nome completo'), servico_codigo: str('Código do serviço'), evento_id_atual: str('evento_id da consulta existente (remarcar/cancelar), de listar_minhas_consultas') }, ['acao']),
    tool('executar_acao_confirmada', 'Executa a proposta pendente. Só funciona se o paciente confirmou explicitamente DEPOIS do resumo (mensagem seguinte). Sem parâmetros.', {}),
    tool('confirmar_presenca', 'Marca presença confirmada quando o paciente responde a um lembrete confirmando que irá.', { evento_id: str('evento_id da consulta') }, ['evento_id']),
    tool('registrar_triagem_urgencia', 'Registra sinais de urgência e avisa a equipe. Use para dor intensa, inchaço, sangramento, trauma dentário, suspeita de infecção ou dificuldade de respirar/engolir.',
      { nivel: str('Nível', { enum: ['URGENTE', 'EMERGENCIA'] }), sinais: { type: 'array', items: { type: 'string' }, description: 'Sinais relatados, em poucas palavras' } }, ['nivel', 'sinais']),
    tool('encaminhar_humano', 'Encaminha a conversa para atendimento humano (pedido do paciente, assunto fora do escopo, dúvida clínica, falha repetida, direitos LGPD).',
      { motivo: str('Motivo resumido, sem dados clínicos desnecessários') }, ['motivo']),
  ];
}

function blocoClinica(cfg) {
  const L = [`Clínica: ${cfg.clinica.nome}`];
  if (!vazio(cfg.clinica.telefone)) L.push(`Telefone: ${cfg.clinica.telefone}`);
  const servs = (cfg.servicos || []).map(s => `- ${s.codigo}: ${s.nome}${s.agendavel_online === false ? ' (NÃO agendável online: encaminhar para a equipe)' : ''}`);
  L.push('Serviços (categorias configuradas):', ...servs);
  const profs = (cfg.profissionais || []).filter(p => !vazio(p.nome)).map(p => `- ${p.id}: ${p.nome}`);
  if (profs.length) L.push('Profissionais:', ...profs);
  return L.join('\n');
}

function contextoTurno(estado, cfg, texto, origem, agoraMs, urgencia) {
  const off = cfg.agenda.fuso_offset_minutos, { data, hora } = dataHoraTexto(agoraMs, off);
  const p = estado.paciente;
  const L = [`agora_local: ${data} ${hora}`, `origem: ${origem === 'audio' ? 'áudio transcrito automaticamente (pode conter erros; confirme nomes e horários)' : 'texto'}`,
    `consentimento: ${estado.consentimento}`, `nome_no_whatsapp: ${p.nome_contato || 'desconhecido'}`,
    `dados_coletados: nome_completo=${p.nome || '-'}; servico=${p.servico_codigo || '-'}`];
  if (estado.pendente) L.push(`proposta_pendente: ${estado.pendente.acao} (aguardando confirmação do paciente)`);
  if (urgencia && urgencia.nivel !== 'NENHUM') L.push(`alerta_pre_triagem: ${urgencia.nivel} (${urgencia.sinais.join(', ')})`);
  return `<contexto_sistema>\n${L.join('\n')}\n</contexto_sistema>\n\n<mensagem_paciente>\n${esc(texto)}\n</mensagem_paciente>`;
}

// Corpo da chamada POST /v1/messages. Modelo sem temperature/top_p/thinking budget (rejeitados nos modelos atuais).
function construirRequisicao({ cfg, systemPrompt, estado, modelo, esforco }) {
  return {
    model: modelo, max_tokens: 4096,
    system: [{ type: 'text', text: `${systemPrompt}\n\n# DADOS DA CLÍNICA (fonte oficial)\n${blocoClinica(cfg)}`, cache_control: { type: 'ephemeral' } }],
    tools: ferramentas(), tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    output_config: { effort: esforco || 'medium' },
    fallbacks: 'default',
    messages: estado.mensagens,
  };
}

function interpretar(resp) {
  if (!resp || !Array.isArray(resp.content)) return { stop: 'erro', texto: '', toolUse: null, content: [] };
  const texto = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const toolUse = resp.content.find(b => b.type === 'tool_use') || null;
  return { stop: resp.stop_reason, texto, toolUse, content: resp.content, usage: resp.usage };
}

// Decide para onde cada chamada de ferramenta vai. Valida no CÓDIGO tudo que é regra de negócio.
function despachar(tu, estado, cfg, ctx) {
  const e = estado, a = tu.input || {}, local = r => ({ rota: 'local', resultado: r });
  switch (tu.name) {
    case 'consultar_info_clinica': return local(infoClinica(cfg, a.topico));
    case 'salvar_dados_paciente': {
      if (a.nome_completo) e.paciente.nome = String(a.nome_completo).trim().slice(0, 120);
      if (a.servico_codigo) { if (!servico(cfg, a.servico_codigo)) return local({ ok: false, erro: 'servico_invalido' }); e.paciente.servico_codigo = a.servico_codigo; }
      if (a.motivo_texto) e.paciente.motivo_texto = String(a.motivo_texto).slice(0, 120);
      return local({ ok: true });
    }
    case 'propor_acao': {
      const v = validarProposta(e, a, cfg, servico);
      if (!v.ok) return local(v);
      e.pendente = { ...v.pendente, proposto_no_turno: e.turno, proposto_em: new Date(ctx.agoraMs).toISOString() };
      const s = e.pendente.slot;
      return local({ ok: true, status: 'aguardando_confirmacao_do_paciente', resumo: s ? { quando: s.rotulo, profissional_id: s.profissional_id, nome: e.pendente.nome } : { acao: 'cancelar' }, instrucao: 'Apresente o resumo e peça confirmação explícita. Não diga que está confirmado.' });
    }
    case 'consultar_agenda': {
      const sv = servico(cfg, a.servico_codigo);
      if (!sv) return local({ ok: false, erro: 'servico_invalido' });
      if (sv.agendavel_online === false) return local({ ok: false, erro: 'servico_nao_agendavel_online', instrucao: 'Encaminhe para a equipe.' });
      return { rota: 'agenda', entrada: { servico_codigo: a.servico_codigo, periodo: a.periodo || null, data_minima: a.data_minima || null, profissional_id: a.profissional_id || null, urgencia: !!(a.urgencia || e.urgencia === 'URGENTE') } };
    }
    case 'listar_minhas_consultas': return { rota: 'consulta_op', entrada: { op: 'listar', telefone: e.telefone } };
    case 'confirmar_presenca': return { rota: 'consulta_op', entrada: { op: 'confirmar_presenca', telefone: e.telefone, evento_id: a.evento_id } };
    case 'executar_acao_confirmada': {
      const v = validarExecucao(e, ctx.texto, ctx.agoraMs, (cfg.agenda && cfg.agenda.proposta_validade_min) || 30);
      if (!v.ok) return local(v);
      const p = v.pendente;
      return { rota: 'consulta_op', entrada: { op: 'executar', acao: p.acao, telefone: e.telefone, atendimento_id: e.atendimento_id, nome: p.nome, servico_codigo: p.servico_codigo, slot: p.slot, evento_id_atual: p.evento_id_atual, motivo_texto: e.paciente.motivo_texto, consentimento_em: e.consentimento_em } };
    }
    case 'registrar_triagem_urgencia': {
      const nivel = a.nivel === 'EMERGENCIA' ? 'EMERGENCIA' : 'URGENTE';
      if (nivel !== 'EMERGENCIA' || e.urgencia !== 'EMERGENCIA') e.urgencia = nivel;
      return { rota: 'triagem', entrada: { nivel, sinais: (a.sinais || []).slice(0, 6).map(String), telefone: e.telefone, atendimento_id: e.atendimento_id, nome: e.paciente.nome || e.paciente.nome_contato } };
    }
    case 'encaminhar_humano': { e.escalado = true; return { rota: 'triagem', entrada: { nivel: 'HUMANO', motivo: String(a.motivo || '').slice(0, 200), telefone: e.telefone, atendimento_id: e.atendimento_id, nome: e.paciente.nome || e.paciente.nome_contato } }; }
    default: return local({ ok: false, erro: 'ferramenta_desconhecida' });
  }
}

// Aplica o resultado de uma ferramenta ao estado (slots oferecidos, proposta pendente, etc.).
function aplicarResultado(estado, nome, r) {
  const e = estado;
  if (nome === 'consultar_agenda' && r && r.ok && Array.isArray(r.slots)) e.slots_oferecidos = r.slots;
  if (nome === 'executar_acao_confirmada' && r && r.ok) {
    e.pendente = null; e.slots_oferecidos = [];
    e.atendimento_id = novoAtendimentoId(e.telefone, e.conversa_id + ':' + (r.evento_id || Date.now())); // novo registro para assuntos seguintes
  }
  if (nome === 'executar_acao_confirmada' && r && !r.ok && ['horario_indisponivel', 'agenda_indisponivel'].includes(r.erro)) e.pendente = null;
  return e;
}
module.exports = { MAX_ITER, ferramentas, blocoClinica, contextoTurno, construirRequisicao, interpretar, despachar, aplicarResultado, esc };
