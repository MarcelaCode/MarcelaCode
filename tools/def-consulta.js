// Workflow 06 - Criação e gestão de consultas (agendar / remarcar / cancelar / listar / confirmar presença)
const { WF } = require('./wf-lib');
const { CFG, ECO } = require('./def-base');
const CAL = 'https://www.googleapis.com/calendar/v3/calendars/';
const LIBS = ['config', 'slots', 'booking', 'sheets'];

function wf06() {
  const w = new WF('06', '06 - Criacao e gestao de consulta');
  w.trigger();
  w.code('Prep', LIBS, CFG + String.raw`
const e = $input.first().json, tel = normalizePhone(e.telefone);
if (!cfg || !tel) return [{ json: { erro: 'configuracao_ou_telefone_invalido', e } }];
let rota6 = 'criar';
if (e.op === 'listar') rota6 = 'listar'; else if (e.op === 'confirmar_presenca') rota6 = 'confirmar'; else if (e.op === 'executar' && e.acao === 'cancelar') rota6 = 'cancelar';
else if (e.op !== 'executar') return [{ json: { erro: 'operacao_invalida', e } }];
const precisaBusca = rota6 !== 'criar' || e.acao === 'remarcar';
return [{ json: { e, tel, rota6, precisaBusca } }];`);
  w.if_('Prep ok?', '={{ !$json.erro }}', 'true');
  w.if_('Precisa buscar consultas?', '={{ $json.precisaBusca }}', 'true');
  // --- busca de consultas futuras do paciente (por telefone, em cada agenda) ---
  w.code('Montar buscas', LIBS, CFG + String.raw`
const b = $input.first().json, agora = Date.now();
return cfg.profissionais.map(p => ({ json: { calendar_id: p.calendar_id, timeMin: new Date(agora - 3600000).toISOString(), timeMax: new Date(agora + 180 * 86400000).toISOString(), tel: b.tel } }));`);
  w.http('Google Agenda - listar eventos do paciente', 'GET', "=" + CAL + "{{ encodeURIComponent($json.calendar_id) }}/events",
    { auth: 'google', query: { timeMin: '={{ $json.timeMin }}', timeMax: '={{ $json.timeMax }}', singleEvents: 'true', orderBy: 'startTime', privateExtendedProperty: '=telefone={{ $json.tel }}', maxResults: '50' }, erro: 'continueRegularOutput' });
  w.code('Resolver evento', LIBS, CFG + String.raw`
const b = $('Prep').first().json, e = b.e, off = cfg.agenda.fuso_offset_minutos;
const itens = $input.all(), consultas = [];
let falhas = 0;
for (const it of itens) {
  if (it.json.error) { falhas++; continue; }
  for (const ev of (it.json.items || [])) {
    const p = (ev.extendedProperties && ev.extendedProperties.private) || {};
    if (p.clinica !== 'vamos-sorrir' || p.telefone !== b.tel || ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) continue;
    const prof = profissional(cfg, p.profissional_id), ms = Date.parse(ev.start.dateTime);
    if (!prof || ms < Date.now()) continue;
    consultas.push({ evento_id: ev.id, calendar_id: prof.calendar_id, profissional_id: prof.id, profissional_nome: prof.nome, inicio_ms: ms, fim: ev.end && ev.end.dateTime, rotulo: rotulo(ms, off), servico_codigo: p.servico_codigo, atendimento_id: p.atendimento_id, nome: p.nome_paciente, presenca_confirmada: p.presenca_confirmada === 'sim' });
  }
}
consultas.sort((a, c) => a.inicio_ms - c.inicio_ms);
const alvoId = e.evento_id_atual || e.evento_id;
const alvo = alvoId ? consultas.find(c => c.evento_id === alvoId) : null; // só enxerga eventos do próprio telefone
let erro = null;
if (falhas === itens.length) erro = 'agenda_indisponivel';
else if (['confirmar', 'cancelar'].includes(b.rota6) || e.acao === 'remarcar') { if (!alvo) erro = falhas ? 'agenda_indisponivel' : 'consulta_nao_encontrada'; }
return [{ json: { ...b, consultas, alvo, erro } }];`);
  w.if_('Busca ok?', '={{ !$json.erro }}', 'true');
  w.switch_('Qual operação?', '={{ $json.rota6 }}', ['listar', 'confirmar', 'cancelar', 'criar']);
  // --- listar ---
  w.code('Resultado listar', [], ECO + String.raw`
const b = $input.first().json;
return [{ json: { ok: true, total: b.consultas.length, consultas: b.consultas.map(c => ({ evento_id: c.evento_id, quando: c.rotulo, profissional: c.profissional_nome, servico_codigo: c.servico_codigo, presenca_confirmada: c.presenca_confirmada })), _ctx } }];`);
  // --- confirmar presença ---
  w.http('Google Agenda - marcar presença', 'PATCH', "=" + CAL + "{{ encodeURIComponent($json.alvo.calendar_id) }}/events/{{ $json.alvo.evento_id }}",
    { auth: 'google', body: "={{ JSON.stringify({ extendedProperties: { private: { presenca_confirmada: 'sim' } } }) }}" });
  w.code('Registrar presença', ['util'], String.raw`
const b = $('Resolver evento').first().json;
return [{ json: { op: 'upsert_atendimento', dados: { id_atendimento: b.alvo.atendimento_id, presenca_confirmada: 'sim' }, _ctx: {} } }];`);
  w.exec('Registrar presença (07)', '07');
  w.code('Resultado presença', [], ECO + String.raw`const b = $('Resolver evento').first().json; return [{ json: { ok: true, acao: 'confirmar_presenca', quando: b.alvo.rotulo, _ctx } }];`);
  // --- cancelar ---
  w.http('Google Agenda - cancelar evento', 'DELETE', "=" + CAL + "{{ encodeURIComponent($json.alvo.calendar_id) }}/events/{{ $json.alvo.evento_id }}", { auth: 'google', query: { sendUpdates: 'none' } });
  w.code('Registrar cancelamento', ['util'], String.raw`
const b = $('Resolver evento').first().json;
return [{ json: { op: 'upsert_atendimento', dados: { id_atendimento: b.alvo.atendimento_id, status: 'Cancelado' }, _ctx: {} } }];`);
  w.exec('Registrar cancelamento (07)', '07');
  w.code('Auditar cancelamento', ['util'], String.raw`
const b = $('Resolver evento').first().json;
return [{ json: { op: 'auditoria', dados: { evento: 'consulta_cancelada', telefone_hash: phoneHash(b.tel), referencia: b.alvo.evento_id }, _ctx: {} } }];`);
  w.exec('Auditar cancelamento (07)', '07');
  w.code('Resultado cancelamento', [], ECO + String.raw`
const b = $('Resolver evento').first().json, r = $('Registrar cancelamento (07)').first().json;
return [{ json: { ok: true, acao: 'cancelar', consulta_cancelada: b.alvo.rotulo, registro_planilha_ok: !!(r && r.ok), mensagem_fixa: 'Pronto, sua consulta foi cancelada. Se quiser remarcar, é só me avisar. 😊', _ctx } }];`);
  // --- criar (agendar/remarcar) ---
  w.code('Preparar criação', LIBS, CFG + String.raw`
const b = $input.first().json, e = b.e, s = e.slot;
const sv = servico(cfg, e.servico_codigo), prof = s && profissional(cfg, s.profissional_id);
const ini = s && Date.parse(s.inicio), fim = s && Date.parse(s.fim);
if (!sv || !prof || !(ini > Date.now()) || !(fim > ini) || !nomeCompletoOk(e.nome)) return [{ json: { ...b, erro: 'dados_invalidos' } }];
const id = eventoId(prof.id, s.inicio);
const atendId = (e.acao === 'remarcar' && b.alvo && b.alvo.atendimento_id) || e.atendimento_id;
const evento = montarEvento({ evento_id: id, nome: e.nome, servico: sv, prof, inicioIso: s.inicio, fimIso: s.fim, telefone: b.tel, atendimentoId: atendId, cfg });
return [{ json: { ...b, evento_id: id, evento, calendar_id: prof.calendar_id, atend_id: atendId, ini, fim, fb: { timeMin: new Date(ini).toISOString(), timeMax: new Date(fim).toISOString(), timeZone: 'UTC', items: [{ id: prof.calendar_id }] } } }];`);
  w.if_('Criação válida?', '={{ !$json.erro }}', 'true');
  w.http('Agenda - evento já existe?', 'GET', "=" + CAL + "{{ encodeURIComponent($json.calendar_id) }}/events/{{ $json.evento_id }}", { auth: 'google', retry: false });
  w.code('Classificar evento existente', LIBS, String.raw`
const b = $('Preparar criação').first().json, ex = $input.first().json;
const p = (ex.extendedProperties && ex.extendedProperties.private) || {};
let modo;
if (ex.status === 'cancelled') modo = 'ressuscitar';
else if (p.telefone_hash === phoneHash(b.tel)) modo = 'idempotente'; // retentativa do mesmo paciente
else modo = 'bloqueado';
return [{ json: { ...b, modo, etag: ex.etag } }];`);
  w.code('Sem evento existente', [], String.raw`const b = $('Preparar criação').first().json; return [{ json: { ...b, modo: 'inserir' } }];`);
  w.switch_('Modo de criação', '={{ $json.modo }}', ['inserir', 'ressuscitar', 'idempotente', 'bloqueado']);
  w.http('Agenda - freeBusy (revalidar)', 'POST', 'https://www.googleapis.com/calendar/v3/freeBusy', { auth: 'google', body: '={{ JSON.stringify($json.fb) }}' });
  w.code('Ainda livre?', LIBS, ECO + String.raw`
const b = $('Modo de criação').first().json, r = $input.first().json, c = (r.calendars || {})[b.calendar_id];
if (!c || c.errors) return [{ json: { ok: false, erro: 'agenda_indisponivel', _ctx } }];
if ((c.busy || []).length) return [{ json: { ok: false, erro: 'horario_indisponivel', _ctx } }];
return [{ json: b }];`);
  w.if_('Horário livre?', '={{ $json.ok !== false }}', 'true');
  w.switch_('Inserir ou reativar', '={{ $json.modo }}', ['inserir', 'ressuscitar']);
  w.http('Agenda - criar evento (id determinístico)', 'POST', "=" + CAL + "{{ encodeURIComponent($json.calendar_id) }}/events", { auth: 'google', query: { sendUpdates: 'none' }, body: '={{ JSON.stringify($json.evento) }}', retry: false });
  w.http('Agenda - reativar evento (If-Match)', 'PUT', "=" + CAL + "{{ encodeURIComponent($json.calendar_id) }}/events/{{ $json.evento_id }}",
    { auth: 'google', query: { sendUpdates: 'none' }, headers: { 'If-Match': '={{ $json.etag }}' }, body: "={{ JSON.stringify({ ...$json.evento, status: 'confirmed' }) }}", retry: false });
  w.code('Erro de criação', [], ECO + String.raw`
const it = $input.first().json, st = Number(it.error && (it.error.httpCode || it.httpCode)) || 0;
const conflito = [409, 412].includes(st) || /409|412|already exists|Precondition/i.test(JSON.stringify(it.error || {}));
return [{ json: { ok: false, erro: conflito ? 'horario_indisponivel' : 'agenda_indisponivel', _ctx } }];`);
  w.code('Horário bloqueado', [], ECO + "\nreturn [{ json: { ok: false, erro: 'horario_indisponivel', _ctx } }];");
  w.code('Pós-criação', LIBS, CFG + String.raw`
const b = $('Modo de criação').first().json, e = b.e, s = e.slot, off = cfg.agenda.fuso_offset_minutos;
const remarcar = e.acao === 'remarcar', dt = dataHoraTexto(b.ini, off);
const dados = { id_atendimento: b.atend_id, nome_paciente: e.nome, whatsapp: b.tel, motivo_contato: e.motivo_texto || '', tipo_consulta: servico(cfg, e.servico_codigo).nome, data_agendamento: dt.data.slice(0, 10), horario: dt.hora, profissional: profissional(cfg, s.profissional_id).nome, status: remarcar ? 'Remarcado' : 'Agendado', evento_id: b.evento_id, presenca_confirmada: 'não' };
if (e.consentimento_em) dados.consentimento_em = e.consentimento_em;
return [{ json: { ...b, dados, remarcar, op: 'upsert_atendimento', _ctx: {} } }];`);
  w.if_('É remarcação?', '={{ $json.remarcar }}', 'true');
  w.http('Agenda - cancelar consulta antiga', 'DELETE', "=" + CAL + "{{ encodeURIComponent($json.alvo.calendar_id) }}/events/{{ $json.alvo.evento_id }}", { auth: 'google', query: { sendUpdates: 'none' }, erro: 'continueRegularOutput' });
  w.exec('Registrar agendamento (07)', '07');
  w.code('Auditar agendamento', ['util'], String.raw`
const b = $('Pós-criação').first().json;
return [{ json: { op: 'auditoria', dados: { evento: b.remarcar ? 'consulta_remarcada' : 'consulta_criada', telefone_hash: phoneHash(b.tel), referencia: b.evento_id }, _ctx: {} } }];`);
  w.exec('Auditar agendamento (07)', '07');
  w.code('Resultado criação', LIBS, CFG + ECO + String.raw`
const b = $('Pós-criação').first().json, e = b.e, s = e.slot, off = cfg.agenda.fuso_offset_minutos;
const reg = $('Registrar agendamento (07)').first().json, prof = profissional(cfg, s.profissional_id);
const msg = mensagemConfirmacao({ nome: e.nome, inicioMs: b.ini, offset: off, prof, cfg, remarcado: b.remarcar });
const c = cfg.clinica;
const loc = (typeof c.latitude === 'number' && typeof c.longitude === 'number')
  ? { tipo: 'localizacao', localizacao: { lat: c.latitude, lng: c.longitude, nome: c.nome, endereco: c.endereco } }
  : { tipo: 'texto', texto: '📍 Como chegar: ' + c.maps_link };
return [{ json: { ok: true, acao: e.acao, evento_id: b.evento_id, quando: s.rotulo, registro_planilha_ok: !!(reg && reg.ok), mensagens_fixas: [{ tipo: 'texto', texto: msg }, loc], _ctx } }];`);
  w.code('Resultado erro', [], ECO + String.raw`
const b = $input.first().json; return [{ json: { ok: false, erro: b.erro || 'erro_desconhecido', _ctx } }];`);

  // ligações
  w.chain('Entrada', 'Prep', 'Prep ok?');
  w.link('Prep ok?', 'Precisa buscar consultas?', 0); w.link('Prep ok?', 'Resultado erro', 1);
  w.link('Precisa buscar consultas?', 'Montar buscas', 0); w.link('Precisa buscar consultas?', 'Preparar criação', 1);
  w.link('Montar buscas', 'Google Agenda - listar eventos do paciente');
  w.link('Google Agenda - listar eventos do paciente', 'Resolver evento');
  w.chain('Resolver evento', 'Busca ok?');
  w.link('Busca ok?', 'Qual operação?', 0); w.link('Busca ok?', 'Resultado erro', 1);
  w.link('Qual operação?', 'Resultado listar', 0);
  w.link('Qual operação?', 'Google Agenda - marcar presença', 1);
  w.link('Qual operação?', 'Google Agenda - cancelar evento', 2);
  w.link('Qual operação?', 'Preparar criação', 3);
  w.link('Google Agenda - marcar presença', 'Registrar presença'); w.link('Google Agenda - marcar presença', 'Resultado erro', 1);
  w.chain('Registrar presença', 'Registrar presença (07)', 'Resultado presença');
  w.link('Google Agenda - cancelar evento', 'Registrar cancelamento'); w.link('Google Agenda - cancelar evento', 'Resultado erro', 1);
  w.chain('Registrar cancelamento', 'Registrar cancelamento (07)', 'Auditar cancelamento', 'Auditar cancelamento (07)', 'Resultado cancelamento');
  w.chain('Preparar criação', 'Criação válida?');
  w.link('Criação válida?', 'Agenda - evento já existe?', 0); w.link('Criação válida?', 'Resultado erro', 1);
  w.link('Agenda - evento já existe?', 'Classificar evento existente', 0); w.link('Agenda - evento já existe?', 'Sem evento existente', 1);
  w.link('Classificar evento existente', 'Modo de criação'); w.link('Sem evento existente', 'Modo de criação');
  w.link('Modo de criação', 'Agenda - freeBusy (revalidar)', 0); w.link('Modo de criação', 'Agenda - freeBusy (revalidar)', 1);
  w.link('Modo de criação', 'Pós-criação', 2); w.link('Modo de criação', 'Horário bloqueado', 3);
  w.chain('Agenda - freeBusy (revalidar)', 'Ainda livre?', 'Horário livre?');
  w.link('Agenda - freeBusy (revalidar)', 'Erro de criação', 1);
  w.link('Horário livre?', 'Inserir ou reativar', 0); w.link('Horário livre?', 'Resultado erro', 1);
  w.link('Inserir ou reativar', 'Agenda - criar evento (id determinístico)', 0); w.link('Inserir ou reativar', 'Agenda - reativar evento (If-Match)', 1);
  for (const n of ['Agenda - criar evento (id determinístico)', 'Agenda - reativar evento (If-Match)']) { w.link(n, 'Pós-criação', 0); w.link(n, 'Erro de criação', 1); }
  w.chain('Pós-criação', 'É remarcação?');
  w.link('É remarcação?', 'Agenda - cancelar consulta antiga', 0); w.link('É remarcação?', 'Registrar agendamento (07)', 1);
  w.link('Agenda - cancelar consulta antiga', 'Registrar agendamento (07)');
  w.chain('Registrar agendamento (07)', 'Auditar agendamento', 'Auditar agendamento (07)', 'Resultado criação');
  return w;
}
module.exports = { wf06 };
