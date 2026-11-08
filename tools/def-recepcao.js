// Workflows 01, 01b, 09, 09b, 10
const { WF } = require('./wf-lib');
const { CFG } = require('./def-base');
const PATH = 'whatsapp-vamos-sorrir';

function respond(w, nome, corpo, codigo) {
  return w.add(nome, 'n8n-nodes-base.respondToWebhook', 1.1, { respondWith: 'text', responseBody: corpo, options: codigo ? { responseCode: codigo } : {} });
}

// ---------- 01 - Recepção WhatsApp ----------
function wf01() {
  const w = new WF('01', '01 - Recepcao WhatsApp');
  w.add('Webhook GET (verificação Meta)', 'n8n-nodes-base.webhook', 2, { httpMethod: 'GET', path: PATH, responseMode: 'responseNode', options: {} }, { webhookId: 'a1b2c3d4-0001-4000-8000-000000000001' });
  w.code('Validar token', [], String.raw`
const q = $input.first().json.query || {};
const ok = q['hub.mode'] === 'subscribe' && !!$env.WHATSAPP_VERIFY_TOKEN && q['hub.verify_token'] === $env.WHATSAPP_VERIFY_TOKEN;
return [{ json: { ok, challenge: q['hub.challenge'] || '' } }];`);
  w.if_('Token válido?', '={{ $json.ok }}', 'true');
  respond(w, 'Responder challenge', '={{ $json.challenge }}');
  respond(w, 'Responder 403', 'forbidden', 403);
  w.chain('Webhook GET (verificação Meta)', 'Validar token', 'Token válido?');
  w.link('Token válido?', 'Responder challenge', 0); w.link('Token válido?', 'Responder 403', 1);

  w.add('Webhook POST (mensagens)', 'n8n-nodes-base.webhook', 2, { httpMethod: 'POST', path: PATH, responseMode: 'responseNode', options: { rawBody: true } }, { webhookId: 'a1b2c3d4-0002-4000-8000-000000000002' });
  w.code('Validar assinatura e normalizar', ['whatsapp'], String.raw`
const it = $input.first();
try {
  if (!it.binary || !it.binary.data) return [{ json: { assinatura_ok: false } }];
  const raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
  const sig = (it.json.headers || {})['x-hub-signature-256'];
  if (!verifySignature(raw, sig, $env.WHATSAPP_APP_SECRET)) return [{ json: { assinatura_ok: false } }];
  const r = parseWebhook(JSON.parse(raw));
  return [{ json: { assinatura_ok: true, mensagens: r.mensagens } }];
} catch (e) { return [{ json: { assinatura_ok: false } }]; }`);
  w.if_('Assinatura válida?', '={{ $json.assinatura_ok }}', 'true');
  respond(w, 'Responder 200', 'EVENT_RECEIVED');
  respond(w, 'Responder 401', 'unauthorized', 401);
  w.code('Expandir mensagens', ['whatsapp'], String.raw`
const msgs = $input.first().json.mensagens || [];
return msgs.map(m => ({ json: { mensagem: { ...m, tipo_logico: tipoLogico(m) }, retry: false } }));`);
  w.exec('Processar mensagem (01b)', '01b', {}, { mode: 'each' });
  w.chain('Webhook POST (mensagens)', 'Validar assinatura e normalizar', 'Assinatura válida?');
  w.link('Assinatura válida?', 'Responder 200', 0); w.link('Assinatura válida?', 'Responder 401', 1);
  w.chain('Responder 200', 'Expandir mensagens', 'Processar mensagem (01b)');
  return w;
}

// ---------- 01b - Processar mensagem (uma execução por mensagem) ----------
function wf01b() {
  const w = new WF('01b', '01b - Processar mensagem');
  w.trigger();
  w.if_('É retentativa?', '={{ $json.retry }}', 'true');
  w.lerPorColuna('Buscar na fila (duplicidade)', 'Fila_Entrada', 'wamid', '={{ $json.mensagem.wamid }}');
  w.code('Já processada?', [], "const r = $input.first().json; return [{ json: { nova: !(r && r.wamid) } }];");
  w.if_('Mensagem nova?', '={{ $json.nova }}', 'true');
  w.code('Ignorar duplicada', [], "return [{ json: { ok: true, duplicada: true } }];");
  w.code('Registrar na fila', ['sheets'], String.raw`
const m = $('Entrada').first().json.mensagem, agora = new Date().toISOString();
return [{ json: linhaParcial('Fila_Entrada', { wamid: m.wamid, telefone: m.telefone, tipo: m.tipo, texto: m.tipo_logico === 'texto' ? m.texto : '', media_id: m.media_id || '', status: 'PROCESSANDO', tentativas: 1, recebido_em: m.timestamp, atualizado_em: agora, nome_contato: m.nome_contato }) }];`);
  w.upsert('Gravar na fila', 'Fila_Entrada', 'wamid');
  w.code('Marcar tentativa', ['sheets'], String.raw`
const e = $('Entrada').first().json, m = e.mensagem, agora = new Date().toISOString();
return [{ json: linhaParcial('Fila_Entrada', { wamid: m.wamid, status: 'PROCESSANDO', tentativas: (m.tentativas_anteriores || 0) + 1, atualizado_em: agora }) }];`);
  w.upsert('Gravar tentativa', 'Fila_Entrada', 'wamid');
  w.switch_('Tipo da mensagem', "={{ $('Entrada').first().json.mensagem.tipo_logico }}", ['texto', 'audio', 'nao_suportado']);
  // texto
  w.code('Entrada do agente (texto)', [], String.raw`
const m = $('Entrada').first().json.mensagem;
return [{ json: { telefone: m.telefone, nome_contato: m.nome_contato, texto: m.texto, origem: 'texto', wamid: m.wamid, timestamp: m.timestamp } }];`);
  w.exec('Agente Claude (03) - texto', '03');
  w.code('Resultado agente (texto)', [], "const r = $input.first().json; return [{ json: { ok: r.ok === true } }];");
  // áudio
  w.code('Entrada da transcrição', [], String.raw`const m = $('Entrada').first().json.mensagem; return [{ json: { media_id: m.media_id, _ctx: {} } }];`);
  w.exec('Transcrição (02)', '02');
  w.if_('Transcrição ok?', '={{ $json.ok === true }}', 'true');
  w.code('Entrada do agente (áudio)', [], String.raw`
const m = $('Entrada').first().json.mensagem, t = $input.first().json;
return [{ json: { telefone: m.telefone, nome_contato: m.nome_contato, texto: t.texto, origem: 'audio', wamid: m.wamid, timestamp: m.timestamp } }];`);
  w.exec('Agente Claude (03) - áudio', '03');
  w.code('Resultado agente (áudio)', [], "const r = $input.first().json; return [{ json: { ok: r.ok === true } }];");
  w.code('Msg áudio ruim', [], String.raw`
const m = $('Entrada').first().json.mensagem;
return [{ json: { telefone: m.telefone, ultimo_inbound_em: m.timestamp, itens: [{ tipo: 'texto', texto: 'Não consegui entender seu áudio. 😕 Pode enviar de novo em um lugar mais silencioso, ou escrever sua mensagem?' }], _ctx: {} } }];`);
  w.exec('Avisar áudio ruim (08)', '08');
  // não suportado
  w.code('Msg tipo não suportado', [], String.raw`
const m = $('Entrada').first().json.mensagem;
return [{ json: { telefone: m.telefone, ultimo_inbound_em: m.timestamp, itens: [{ tipo: 'texto', texto: 'Por aqui eu consigo ler mensagens de texto e ouvir áudios. 😊 Pode me escrever o que você precisa? Se preferir, posso chamar alguém da equipe.' }], _ctx: {} } }];`);
  w.exec('Avisar tipo não suportado (08)', '08');
  w.code('Resultado aviso', [], "const r = $input.first().json; return [{ json: { ok: r.ok === true } }];");
  // status da fila + escalonamento
  w.code('Montar status da fila', ['sheets', 'retry'], String.raw`
const e = $('Entrada').first().json, m = e.mensagem, ok = $input.first().json.ok === true, agora = Date.now();
const tent = (m.tentativas_anteriores || 0) + 1;
let status = 'CONCLUIDA', prox = '';
if (!ok) { const p = proximaTentativa(tent, agora); if (p) { status = 'ERRO_RETRY'; prox = p; } else status = 'ESGOTADO'; }
if (!ok && m.tipo_logico !== 'texto') status = 'CONCLUIDA'; // áudio/arquivo: paciente já foi orientado a reenviar
return [{ json: { row: linhaParcial('Fila_Entrada', { wamid: m.wamid, status, tentativas: tent, proxima_tentativa_em: prox, atualizado_em: new Date(agora).toISOString() }), esgotado: status === 'ESGOTADO' } }];`);
  w.code('Linha da fila', [], "return [{ json: $input.first().json.row }];");
  w.upsert('Atualizar fila', 'Fila_Entrada', 'wamid');
  w.if_('Esgotou tentativas?', "={{ $('Montar status da fila').first().json.esgotado }}", 'true');
  w.code('Preparar escalonamento', [], String.raw`
const m = $('Entrada').first().json.mensagem;
return [{ json: { nivel: 'HUMANO', motivo: 'falha técnica repetida no atendimento automatizado', telefone: m.telefone, atendimento_id: 'ATD-FALHA-' + m.wamid.slice(-8), nome: m.nome_contato, _ctx: {} } }];`);
  w.exec('Escalonar para humano (04)', '04');
  w.code('Msg falha técnica', ['config'], CFG + String.raw`
const m = $('Entrada').first().json.mensagem, ok = $input.first().json.alertado === true;
return [{ json: { telefone: m.telefone, ultimo_inbound_em: m.timestamp, itens: [{ tipo: 'texto', texto: 'Desculpe, tive um problema técnico para responder sua mensagem. 🙏' + (ok ? ' Já avisei a equipe, que vai falar com você.' : ' Por favor, ligue para ' + cfg.clinica.telefone + '.') }], _ctx: {} } }];`);
  w.exec('Avisar falha técnica (08)', '08');
  w.code('Fim (escalonado)', [], "return [{ json: { ok: false, escalonado: true } }];");
  w.code('Fim', [], "return [{ json: { ok: true } }];");

  w.chain('Entrada', 'É retentativa?');
  w.link('É retentativa?', 'Marcar tentativa', 0); w.link('É retentativa?', 'Buscar na fila (duplicidade)', 1);
  w.chain('Buscar na fila (duplicidade)', 'Já processada?', 'Mensagem nova?');
  w.link('Mensagem nova?', 'Registrar na fila', 0); w.link('Mensagem nova?', 'Ignorar duplicada', 1);
  w.chain('Registrar na fila', 'Gravar na fila', 'Tipo da mensagem');
  w.chain('Marcar tentativa', 'Gravar tentativa', 'Tipo da mensagem');
  w.link('Tipo da mensagem', 'Entrada do agente (texto)', 0); w.link('Tipo da mensagem', 'Entrada da transcrição', 1); w.link('Tipo da mensagem', 'Msg tipo não suportado', 2);
  w.chain('Entrada do agente (texto)', 'Agente Claude (03) - texto', 'Resultado agente (texto)', 'Montar status da fila');
  w.chain('Entrada da transcrição', 'Transcrição (02)', 'Transcrição ok?');
  w.link('Transcrição ok?', 'Entrada do agente (áudio)', 0); w.link('Transcrição ok?', 'Msg áudio ruim', 1);
  w.chain('Entrada do agente (áudio)', 'Agente Claude (03) - áudio', 'Resultado agente (áudio)', 'Montar status da fila');
  w.chain('Msg áudio ruim', 'Avisar áudio ruim (08)', 'Resultado aviso');
  w.chain('Msg tipo não suportado', 'Avisar tipo não suportado (08)');
  w.link('Avisar tipo não suportado (08)', 'Resultado aviso');
  w.link('Resultado aviso', 'Montar status da fila');
  w.chain('Montar status da fila', 'Linha da fila', 'Atualizar fila', 'Esgotou tentativas?');
  w.link('Esgotou tentativas?', 'Preparar escalonamento', 0); w.link('Esgotou tentativas?', 'Fim', 1);
  w.chain('Preparar escalonamento', 'Escalonar para humano (04)', 'Msg falha técnica', 'Avisar falha técnica (08)', 'Fim (escalonado)');
  return w;
}

// ---------- 09 - Lembretes ----------
function wf09() {
  const w = new WF('09', '09 - Lembretes automaticos');
  w.add('Todos os dias às 9h', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cron', expression: '0 9 * * *' }] } });
  w.add('Reprocessar falhas às 12h', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cron', expression: '0 12 * * *' }] } });
  w.add('Execução manual (teste)', 'n8n-nodes-base.manualTrigger', 1, {});
  w.code('Preparar janela de amanhã', ['config', 'reminders'], CFG + String.raw`
const v = validarConfig(cfg);
if (!v.ok) throw new Error('Configuração da clínica incompleta: ' + v.faltando.join(', '));
const iv = intervaloAmanha(Date.now(), cfg.agenda.fuso_offset_minutos);
return cfg.profissionais.map(p => ({ json: { calendar_id: p.calendar_id, timeMin: iv.timeMin, timeMax: iv.timeMax } }));`);
  w.http('Google Agenda - eventos de amanhã', 'GET', "=https://www.googleapis.com/calendar/v3/calendars/{{ encodeURIComponent($json.calendar_id) }}/events",
    { auth: 'google', query: { timeMin: '={{ $json.timeMin }}', timeMax: '={{ $json.timeMax }}', singleEvents: 'true', orderBy: 'startTime', maxResults: '250' }, erro: 'continueRegularOutput' });
  w.code('Montar candidatos', ['config', 'reminders'], CFG + String.raw`
const itens = $input.all(), falhas = itens.filter(i => i.json.error).length;
if (falhas === itens.length) throw new Error('Google Agenda indisponível: lembretes não puderam ser calculados');
const eventos = itens.flatMap(i => i.json.items || []);
return [{ json: { candidatos: candidatos(eventos, cfg.agenda.fuso_offset_minutos), agendas_com_falha: falhas } }];`);
  w.lerTudo('Ler log de lembretes', 'Lembretes');
  w.code('Filtrar (deduplicação)', ['config', 'reminders'], CFG + String.raw`
const base = $('Montar candidatos').first().json;
const log = $input.all().map(i => i.json).filter(r => r.chave);
const { enviar, pular } = filtrar(base.candidatos, log, Date.now());
return enviar.map(c => ({ json: { candidato: c, parametros: parametrosTemplate(c, cfg) } }));`);
  w.exec('Enviar lembrete (09b)', '09b', {}, { mode: 'each' });
  w.code('Resumo da execução', ['util'], String.raw`
const itens = $input.all().map(i => i.json), enviados = itens.filter(i => i.enviado).length;
return [{ json: { op: 'auditoria', dados: { evento: 'lembretes_executados', detalhe: 'enviados=' + enviados + ' falhas=' + (itens.length - enviados) }, _ctx: {} } }];`);
  w.exec('Auditar execução (07)', '07');
  w.link('Todos os dias às 9h', 'Preparar janela de amanhã'); w.link('Reprocessar falhas às 12h', 'Preparar janela de amanhã'); w.link('Execução manual (teste)', 'Preparar janela de amanhã');
  w.chain('Preparar janela de amanhã', 'Google Agenda - eventos de amanhã', 'Montar candidatos', 'Ler log de lembretes', 'Filtrar (deduplicação)', 'Enviar lembrete (09b)', 'Resumo da execução', 'Auditar execução (07)');
  return w;
}

// ---------- 09b - Enviar lembrete individual ----------
function wf09b() {
  const w = new WF('09b', '09b - Enviar lembrete individual');
  w.trigger();
  w.code('Reservar envio', ['util'], String.raw`
const c = $input.first().json.candidato;
return [{ json: { op: 'lembrete', dados: { chave: c.chave, evento_id: c.evento_id, telefone_hash: phoneHash(c.telefone), status: 'ENVIANDO', tentativas: (c.tentativas || 0) + 1, novo: !c.tentativas }, _ctx: {} } }];`);
  w.exec('Gravar reserva (07)', '07');
  w.if_('Reserva gravada?', '={{ $json.ok === true }}', 'true');
  w.code('Montar mensagem', ['config'], CFG + String.raw`
const e = $('Entrada').first().json;
return [{ json: { telefone: e.candidato.telefone, ultimo_inbound_em: null, itens: [{ tipo: 'template', template: { nome: cfg.whatsapp.templates.lembrete, idioma: cfg.whatsapp.templates.idioma || 'pt_BR', parametros: e.parametros } }], _ctx: {} } }];`);
  w.exec('Enviar template (08)', '08');
  w.code('Montar resultado', [], String.raw`
const e = $('Entrada').first().json, c = e.candidato, r = $input.first().json, ok = r.ok === true;
return [{ json: { op: 'lembrete', dados: { chave: c.chave, status: ok ? 'ENVIADO' : 'FALHOU', tentativas: (c.tentativas || 0) + 1, wamid_envio: (r.wamids || [])[0] || '' }, _ctx: {} } }];`);
  w.exec('Gravar resultado (07)', '07');
  w.code('Fim', [], String.raw`const d = $('Montar resultado').first().json.dados; return [{ json: { ok: true, enviado: d.status === 'ENVIADO' } }];`);
  w.code('Sem reserva (não envia)', [], "return [{ json: { ok: false, enviado: false, motivo: 'reserva_falhou' } }];");
  w.chain('Entrada', 'Reservar envio', 'Gravar reserva (07)', 'Reserva gravada?');
  w.link('Reserva gravada?', 'Montar mensagem', 0); w.link('Reserva gravada?', 'Sem reserva (não envia)', 1);
  w.chain('Montar mensagem', 'Enviar template (08)', 'Montar resultado', 'Gravar resultado (07)', 'Fim');
  return w;
}

// ---------- 10 - Erros e manutenção ----------
function wf10() {
  const w = new WF('10', '10 - Erros e manutencao', { erroWf: false });
  // A) erros
  w.add('Error Trigger', 'n8n-nodes-base.errorTrigger', 1, {});
  w.code('Sanitizar erro', ['errors'], String.raw`
const x = $input.first().json, wf = (x.workflow && x.workflow.name) || 'desconhecido';
const no = (x.execution && x.execution.error && x.execution.error.node && x.execution.error.node.name) || (x.execution && x.execution.lastNodeExecuted) || '';
const msg = sanitizarMensagem(x.execution && x.execution.error && x.execution.error.message);
return [{ json: { workflow: wf, no, mensagem: msg, execucao_id: (x.execution && x.execution.id) || '', chave_erro: chaveErro(wf, no, msg) } }];`);
  w.lerPorColuna('Buscar erros iguais', 'Erros', 'chave_erro', "={{ $json.chave_erro }}");
  w.code('Throttle de alertas', ['errors', 'sheets'], String.raw`
const e = $('Sanitizar erro').first().json, rows = $input.all().map(i => i.json).filter(r => r.chave_erro);
const notificar = deveNotificar(rows, Date.now(), 15), agora = new Date().toISOString();
const id = sha256(agora + e.chave_erro + Math.random()).slice(0, 16);
return [{ json: { notificar, row: linhaParcial('Erros', { id, ocorrido_em: agora, workflow: e.workflow, no: e.no, mensagem: e.mensagem, execucao_id: e.execucao_id, chave_erro: e.chave_erro, notificado: notificar ? 'sim' : 'suprimido' }) } }];`);
  w.code('Linha do erro', [], "return [{ json: $input.first().json.row }];");
  w.append('Gravar erro', 'Erros');
  w.if_('Notificar equipe?', "={{ $('Throttle de alertas').first().json.notificar }}", 'true');
  w.code('Preparar alerta de erro', ['config'], CFG + String.raw`
const e = $('Sanitizar erro').first().json;
const lim = s => String(s || '-').replace(/[\n\r\t]+/g, ' ').slice(0, 100);
return [{ json: { telefone: cfg.equipe.whatsapp_alertas, ultimo_inbound_em: null, itens: [{ tipo: 'template', template: { nome: cfg.whatsapp.templates.alerta_equipe, idioma: cfg.whatsapp.templates.idioma || 'pt_BR', parametros: ['Falha automática', lim(e.workflow), 'execução ' + lim(e.execucao_id), lim(e.no + ': ' + e.mensagem)] } }], _ctx: {} } }];`);
  w.exec('Alertar equipe (08)', '08');
  w.chain('Error Trigger', 'Sanitizar erro', 'Buscar erros iguais', 'Throttle de alertas', 'Linha do erro', 'Gravar erro', 'Notificar equipe?');
  w.link('Notificar equipe?', 'Preparar alerta de erro', 0);
  w.chain('Preparar alerta de erro', 'Alertar equipe (08)');

  // B) retentativas controladas da fila de entrada
  w.add('A cada 5 minutos', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } });
  w.lerPorColuna('Fila - erros a retentar', 'Fila_Entrada', 'status', 'ERRO_RETRY');
  w.code('Selecionar vencidas', ['retry'], String.raw`
const agora = Date.now();
return $input.all().map(i => i.json).filter(r => r.wamid && r.tipo === 'text' && Number(r.tentativas || 0) < MAX_TENTATIVAS_FILA && Date.parse(r.proxima_tentativa_em) <= agora)
  .slice(0, 10).map(r => ({ json: { retry: true, mensagem: { wamid: r.wamid, telefone: r.telefone, nome_contato: r.nome_contato, texto: r.texto, tipo: 'text', tipo_logico: 'texto', timestamp: r.recebido_em, tentativas_anteriores: Number(r.tentativas || 0) } } }));`);
  w.exec('Reprocessar mensagem (01b)', '01b', {}, { mode: 'each' });
  w.chain('A cada 5 minutos', 'Fila - erros a retentar', 'Selecionar vencidas', 'Reprocessar mensagem (01b)');

  // C) retenção e exclusão (LGPD)
  w.add('Todos os dias às 3h (retenção)', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cron', expression: '0 3 * * *' }] } });
  const abas = [['Sessoes', 'atualizado_em', 'sessoes_dias', 7, 'SHEET_GID_SESSOES'], ['Fila_Entrada', 'recebido_em', 'fila_dias', 7, 'SHEET_GID_FILA_ENTRADA'], ['Erros', 'ocorrido_em', 'erros_dias', 90, 'SHEET_GID_ERROS'], ['Lembretes', 'criado_em', 'lembretes_dias', 90, 'SHEET_GID_LEMBRETES'], ['Auditoria', 'ocorrido_em', null, 365, 'SHEET_GID_AUDITORIA']];
  for (const [aba, campo, chave, padrao, gid] of abas) {
    const ler = w.lerTudo(`Ler ${aba} (retenção)`, aba);
    const cod = w.code(`Expiradas em ${aba}`, ['config', 'retention'], CFG + `
const ret = (cfg.privacidade && cfg.privacidade.retencao) || {};
const dias = ${chave ? `ret.${chave} || ${padrao}` : `((ret.auditoria_meses || 12) * 30)`};
const gid = Number($env.${gid});
if (Number.isNaN(gid)) throw new Error('${gid} não configurado');
const linhas = $input.all().map(i => i.json).filter(r => r.row_number);
const ids = expiradas(linhas, '${campo}', dias, Date.now());
if (!ids.length) return [];
return [{ json: { requests: pedidosExclusao(gid, ids) } }];`);
    const http = w.http(`Excluir linhas expiradas de ${aba}`, 'POST', '=https://sheets.googleapis.com/v4/spreadsheets/{{ $env.SHEETS_ID }}:batchUpdate', { auth: 'sheets', body: '={{ JSON.stringify({ requests: $json.requests }) }}', erro: 'stopWorkflow' });
    w.link('Todos os dias às 3h (retenção)', ler); w.chain(ler, cod, http);
  }
  return w;
}
module.exports = { wf01, wf01b, wf09, wf09b, wf10 };
