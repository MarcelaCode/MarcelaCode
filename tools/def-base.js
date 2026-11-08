// Workflows 02, 04, 05, 07, 08 (serviços reutilizáveis chamados por outros workflows)
const { WF } = require('./wf-lib');
const CFG = "const cfg = carregarConfig($env.CLINICA_CONFIG_JSON);";
const ECO = "const _ctx = ($('Entrada').first().json || {})._ctx;";

// ---------- 08 - Resposta WhatsApp ----------
function wf08() {
  const w = new WF('08', '08 - Resposta WhatsApp');
  w.trigger();
  w.code('Preparar envios', ['whatsapp'], String.raw`
const ent = $input.first().json, _ctx = ent._ctx, agora = Date.now();
const janela = janelaAberta(ent.ultimo_inbound_em, agora);
const out = [];
for (const it of (ent.itens || [])) {
  const partes = it.tipo === 'texto' ? dividirTexto(it.texto).map(t => ({ tipo: 'texto', texto: t })) : [it];
  for (const p of partes) {
    const r = montarEnvio(p, ent.telefone, janela);
    if (r.erro) return [{ json: { falha_previa: r.erro, _ctx } }];
    out.push({ json: { payload: r.payload, _ctx } });
  }
}
if (!out.length) return [{ json: { falha_previa: 'sem_itens', _ctx } }];
return out;`);
  w.if_('Falha prévia?', '={{ !!$json.falha_previa }}', 'true');
  w.http('Enviar via WhatsApp Cloud API', 'POST', '=https://graph.facebook.com/{{ $env.WHATSAPP_API_VERSION }}/{{ $env.WHATSAPP_PHONE_NUMBER_ID }}/messages',
    { body: '={{ JSON.stringify($json.payload) }}', headers: { Authorization: '=Bearer {{ $env.WHATSAPP_ACCESS_TOKEN }}', 'Content-Type': 'application/json' }, erro: 'continueRegularOutput' });
  w.code('Resumo do envio', [], String.raw`
const esperado = $('Preparar envios').all().length, _ctx = $('Preparar envios').first().json._ctx;
const itens = $input.all();
const ids = itens.map(i => i.json && i.json.messages && i.json.messages[0] && i.json.messages[0].id).filter(Boolean);
const ok = ids.length === esperado;
const falha = itens.find(i => i.json && i.json.error);
return [{ json: { ok, wamids: ids, erro: ok ? null : 'falha_envio_whatsapp', http_status: falha && falha.json.error && (falha.json.error.httpCode || null), _ctx } }];`);
  w.code('Resultado falha prévia', [], String.raw`const p = $input.first().json; return [{ json: { ok: false, erro: p.falha_previa, _ctx: p._ctx } }];`);
  w.chain('Entrada', 'Preparar envios', 'Falha prévia?');
  w.link('Falha prévia?', 'Resultado falha prévia', 0); w.link('Falha prévia?', 'Enviar via WhatsApp Cloud API', 1);
  w.link('Enviar via WhatsApp Cloud API', 'Resumo do envio');
  return w;
}

// ---------- 07 - Registro (Google Planilhas) ----------
function wf07() {
  const w = new WF('07', '07 - Registro Planilha');
  w.trigger();
  w.switch_('Operação', '={{ $json.op }}', ['upsert_atendimento', 'lembrete', 'auditoria']);
  w.link('Entrada', 'Operação');
  // upsert atendimento (valida transição de status; atualização parcial)
  w.code('Chave do atendimento', [], String.raw`const e = $input.first().json; return [{ json: { id_atendimento: e.dados.id_atendimento } }];`);
  w.lerPorColuna('Ler atendimento atual', 'Atendimentos', 'id_atendimento', '={{ $json.id_atendimento }}');
  w.code('Mesclar e validar', ['sheets'], String.raw`
const e = $('Entrada').first().json, d = { ...e.dados }, atual = $input.first().json || {};
const existe = !!atual.id_atendimento, agora = new Date().toISOString();
let statusIgnorado = null;
if (d.status && existe && !transicaoValida(atual.status, d.status)) { statusIgnorado = d.status; delete d.status; }
if (!existe) { d.data_criacao = agora; if (!d.status) d.status = 'Novo contato'; }
d.ultima_atualizacao = agora;
return [{ json: linhaParcial('Atendimentos', d), pairedItem: 0 }];`);
  w.upsert('Gravar atendimento', 'Atendimentos', 'id_atendimento');
  w.code('Ok atendimento', [], ECO + "\nreturn [{ json: { ok: true, _ctx } }];");
  w.chain('Chave do atendimento', 'Ler atendimento atual', 'Mesclar e validar', 'Gravar atendimento', 'Ok atendimento');
  // log de lembretes
  w.code('Preparar lembrete', ['sheets'], String.raw`
const d = $input.first().json.dados, agora = new Date().toISOString();
const r = { ...d, atualizado_em: agora }; if (d.novo) r.criado_em = agora; delete r.novo;
return [{ json: linhaParcial('Lembretes', r) }];`);
  w.upsert('Gravar lembrete', 'Lembretes', 'chave');
  w.code('Ok lembrete', [], ECO + "\nreturn [{ json: { ok: true, _ctx } }];");
  w.chain('Preparar lembrete', 'Gravar lembrete', 'Ok lembrete');
  // auditoria (sem dados clínicos nem conteúdo de mensagens)
  w.code('Preparar auditoria', ['sheets'], String.raw`
const d = $input.first().json.dados, agora = new Date().toISOString();
const id = sha256(agora + '|' + d.evento + '|' + (d.referencia || '') + '|' + Math.random()).slice(0, 16);
return [{ json: linhaParcial('Auditoria', { id, ocorrido_em: agora, evento: d.evento, ator: d.ator || 'sistema', telefone_hash: d.telefone_hash || '', referencia: d.referencia || '', detalhe: String(d.detalhe || '').slice(0, 200) }) }];`);
  w.append('Gravar auditoria', 'Auditoria');
  w.code('Ok auditoria', [], ECO + "\nreturn [{ json: { ok: true, _ctx } }];");
  w.chain('Preparar auditoria', 'Gravar auditoria', 'Ok auditoria');
  w.link('Operação', 'Chave do atendimento', 0); w.link('Operação', 'Preparar lembrete', 1); w.link('Operação', 'Preparar auditoria', 2);
  return w;
}

// ---------- 02 - Transcrição ----------
function wf02() {
  const w = new WF('02', '02 - Transcricao de audio');
  w.trigger();
  w.code('Preparar', [], String.raw`
const e = $input.first().json;
if (!$env.TRANSCRIBE_API_URL || !$env.TRANSCRIBE_API_KEY) return [{ json: { falha: 'transcricao_nao_configurada', _ctx: e._ctx } }];
return [{ json: { media_id: e.media_id, _ctx: e._ctx } }];`);
  w.if_('Configurado?', '={{ !$json.falha }}', 'true');
  w.http('Obter URL da mídia', 'GET', '=https://graph.facebook.com/{{ $env.WHATSAPP_API_VERSION }}/{{ $json.media_id }}', { headers: { Authorization: '=Bearer {{ $env.WHATSAPP_ACCESS_TOKEN }}' } });
  w.http('Baixar áudio', 'GET', '={{ $json.url }}', { headers: { Authorization: '=Bearer {{ $env.WHATSAPP_ACCESS_TOKEN }}' }, timeout: 60000, extraParams: { options: { timeout: 60000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } } } });
  w.add('Transcrever', 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST', url: '={{ $env.TRANSCRIBE_API_URL }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $env.TRANSCRIBE_API_KEY }}' }] },
    sendBody: true, contentType: 'multipart-form-data',
    bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }, { name: 'model', value: '={{ $env.TRANSCRIBE_MODEL }}' }, { name: 'language', value: 'pt' }, { name: 'response_format', value: 'verbose_json' }] },
    options: { timeout: 90000 },
  }, { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 3000 });
  w.code('Avaliar qualidade', ['transcription'], ECO + String.raw`
const r = avaliarTranscricao($input.first().json);
return [{ json: r.ok ? { ok: true, texto: r.texto, _ctx } : { ok: false, motivo: r.motivo, _ctx } }];`);
  w.code('Falha na transcrição', [], ECO + String.raw`
const d = $('Preparar').first().json; return [{ json: { ok: false, motivo: d.falha || 'falha_servico', _ctx } }];`);
  w.chain('Entrada', 'Preparar', 'Configurado?');
  w.link('Configurado?', 'Obter URL da mídia', 0); w.link('Configurado?', 'Falha na transcrição', 1);
  w.link('Obter URL da mídia', 'Baixar áudio'); w.link('Obter URL da mídia', 'Falha na transcrição', 1);
  w.link('Baixar áudio', 'Transcrever'); w.link('Baixar áudio', 'Falha na transcrição', 1);
  w.link('Transcrever', 'Avaliar qualidade'); w.link('Transcrever', 'Falha na transcrição', 1);
  return w;
}

// ---------- 05 - Consulta de agenda ----------
function wf05() {
  const w = new WF('05', '05 - Consulta de agenda');
  w.trigger();
  w.code('Preparar consulta', ['config', 'slots'], CFG + String.raw`
const e = $input.first().json, _ctx = e._ctx;
const sv = cfg && servico(cfg, e.servico_codigo);
if (!sv || !(sv.duracao_min > 0)) return [{ json: { falha: 'servico_invalido', _ctx } }];
const off = cfg.agenda.fuso_offset_minutos, agora = Date.now();
const prof = (e.profissional_id ? [e.profissional_id] : sv.profissional_ids).filter(id => sv.profissional_ids.includes(id) && profissional(cfg, id));
if (!prof.length) return [{ json: { falha: 'profissional_invalido', _ctx } }];
let de = agora;
if (e.data_minima && /^\d{4}-\d{2}-\d{2}$/.test(e.data_minima)) { const t = Date.parse(e.data_minima + 'T00:00:00Z') - off * 60000; if (t > de) de = t; }
const dias = e.urgencia ? Math.min(cfg.agenda.janela_busca_dias || 14, 3) : (cfg.agenda.janela_busca_dias || 14);
const ate = de + dias * 86400000;
return [{ json: { de, ate, prof, fb: { timeMin: new Date(de).toISOString(), timeMax: new Date(ate).toISOString(), timeZone: 'UTC', items: prof.map(id => ({ id: profissional(cfg, id).calendar_id })) }, _ctx } }];`);
  w.if_('Parâmetros válidos?', '={{ !$json.falha }}', 'true');
  w.http('Google Agenda - freeBusy', 'POST', 'https://www.googleapis.com/calendar/v3/freeBusy', { auth: 'google', body: "={{ JSON.stringify($json.fb) }}" });
  w.code('Calcular horários livres', ['config', 'slots'], CFG + ECO + String.raw`
const e = $('Entrada').first().json, p = $('Preparar consulta').first().json, r = $input.first().json;
const sv = servico(cfg, e.servico_codigo), off = cfg.agenda.fuso_offset_minutos, busy = {};
for (const id of p.prof) {
  const c = (r.calendars || {})[profissional(cfg, id).calendar_id];
  if (!c || c.errors) return [{ json: { ok: false, erro: 'agenda_indisponivel', _ctx } }];
  busy[id] = c.busy || [];
}
const slots = calcularSlots({ busy, profissionalIds: p.prof, horario: cfg.agenda.horario_funcionamento, feriados: cfg.agenda.feriados || [], duracaoMin: sv.duracao_min, passoMin: cfg.agenda.passo_minutos || 30, deMs: p.de, ateMs: p.ate, offset: off, antecedenciaMin: cfg.agenda.antecedencia_minima_minutos || 120, agoraMs: Date.now() });
const duas = escolherDuas(slots, { periodo: e.periodo, urgencia: e.urgencia, offset: off });
return [{ json: { ok: true, consultado_em: new Date().toISOString(), total_livres: slots.length, slots: duas.map(s => ({ slot_id: s.slot_id, profissional_id: s.profissional_id, profissional_nome: profissional(cfg, s.profissional_id).nome, rotulo: s.rotulo, inicio: s.inicio, fim: s.fim, inicio_ms: s.inicio_ms })), _ctx } }];`);
  w.code('Agenda indisponível', [], ECO + "\nreturn [{ json: { ok: false, erro: 'agenda_indisponivel', _ctx } }];");
  w.code('Parâmetros inválidos', [], ECO + String.raw`const d = $('Preparar consulta').first().json; return [{ json: { ok: false, erro: d.falha, _ctx } }];`);
  w.chain('Entrada', 'Preparar consulta', 'Parâmetros válidos?');
  w.link('Parâmetros válidos?', 'Google Agenda - freeBusy', 0); w.link('Parâmetros válidos?', 'Parâmetros inválidos', 1);
  w.link('Google Agenda - freeBusy', 'Calcular horários livres'); w.link('Google Agenda - freeBusy', 'Agenda indisponível', 1);
  return w;
}

// ---------- 04 - Triagem / encaminhamento humano ----------
function wf04() {
  const w = new WF('04', '04 - Triagem e encaminhamento');
  w.trigger();
  w.code('Preparar encaminhamento', ['sheets'], String.raw`
const e = $input.first().json;
const detalhe = e.nivel === 'HUMANO' ? (e.motivo || 'não informado') : (e.sinais || []).join(', ');
const dados = { id_atendimento: e.atendimento_id, nome_paciente: e.nome || '', whatsapp: e.telefone, status: 'Encaminhado para atendimento humano' };
if (e.nivel !== 'HUMANO') dados.tipo_consulta = 'Urgência';
return [{ json: { op: 'upsert_atendimento', dados, _ctx: {} } }];`);
  w.exec('Registrar status (07)', '07');
  w.code('Preparar auditoria', ['util'], String.raw`
const e = $('Entrada').first().json;
return [{ json: { op: 'auditoria', dados: { evento: e.nivel === 'HUMANO' ? 'encaminhado_humano' : 'triagem_' + e.nivel.toLowerCase(), telefone_hash: phoneHash(e.telefone), referencia: e.atendimento_id, detalhe: e.nivel === 'HUMANO' ? '' : (e.sinais || []).join(',') } , _ctx: {} } }];`);
  w.exec('Auditar (07)', '07');
  w.code('Preparar alerta à equipe', ['config', 'util'], CFG + String.raw`
const e = $('Entrada').first().json;
const rot = { EMERGENCIA: 'EMERGÊNCIA', URGENTE: 'Urgência', HUMANO: 'Pedido de atendimento humano' }[e.nivel] || e.nivel;
const lim = s => String(s || '').replace(/[\n\r\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 100) || '-';
const detalhe = e.nivel === 'HUMANO' ? e.motivo : (e.sinais || []).join(', ');
return [{ json: { telefone: cfg.equipe.whatsapp_alertas, ultimo_inbound_em: null, itens: [{ tipo: 'template', template: { nome: cfg.whatsapp.templates.alerta_equipe, idioma: cfg.whatsapp.templates.idioma || 'pt_BR', parametros: [rot, lim(e.nome), lim(e.telefone), lim(detalhe)] } }], _ctx: {} } }];`);
  w.exec('Avisar equipe (08)', '08');
  w.code('Resultado', [], ECO + "\nconst r = $input.first().json; return [{ json: { ok: true, alertado: !!r.ok, _ctx } }];");
  w.chain('Entrada', 'Preparar encaminhamento', 'Registrar status (07)', 'Preparar auditoria', 'Auditar (07)', 'Preparar alerta à equipe', 'Avisar equipe (08)', 'Resultado');
  return w;
}
module.exports = { wf02, wf04, wf05, wf07, wf08, CFG, ECO };
