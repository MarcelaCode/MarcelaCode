#!/usr/bin/env node
// Gera a linha do tempo da demonstração executando os Code nodes REAIS (workflows/*.json) com n8n simulado.
// Claude, Google Agenda e WhatsApp são SIMULADOS (marcados como tal). Saída: JSON em stdout.
const fs = require('fs');
const path = require('path');
const { cfgTeste } = require('../test/helpers');
const { serializar } = require('../lib/session');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const WDIR = path.join(__dirname, '..', 'workflows');
const cache = {};
const wf = p => { const f = fs.readdirSync(WDIR).find(x => x.startsWith(p + '-')); return cache[f] ||= JSON.parse(fs.readFileSync(path.join(WDIR, f), 'utf8')); };
const ENV = { CLINICA_CONFIG_JSON: JSON.stringify(cfgTeste()) };
async function rodar(p, no, { input = [{}], refs = {}, env = {}, helpers = {} } = {}) {
  const node = wf(p).nodes.find(n => n.name === no);
  const itens = input.map(j => ({ json: j }));
  const $ = n => { const l = refs[n].map(j => ({ json: j })); return { first: () => l[0], all: () => l }; };
  const fn = new AsyncFunction('$input', '$', '$env', 'require', node.parameters.jsCode);
  return (await fn.call({ helpers }, { first: () => itens[0], all: () => itens }, $, { ...ENV, ...env }, require)).map(i => i.json);
}
const ev = [];
const say = (tipo, texto) => ev.push({ tipo, texto });
const TEL = '5511999998888';
let estado = null;

async function turno(texto) {
  const linha = estado ? { telefone: TEL, ...serializar(estado) } : {};
  const r = (await rodar('03', 'Preparar turno', { input: [linha], refs: { 'Validar configuração': [{ telefone: TEL, nome_contato: 'Ana', texto, origem: 'texto', wamid: 'w', timestamp: new Date().toISOString() }] } }))[0];
  estado = r.estado; estado.tmp = { acao_ok: false, fixas: [] };
  return r;
}
async function resposta(r) {
  const o = (await rodar('03', 'Compor resposta fixa', { input: [{ ok: true, alertado: true }], refs: { 'Preparar triagem': [r] } }))[0];
  return o.itens[0].texto;
}
async function ferramenta(nome, input, texto) {
  estado.mensagens.push({ role: 'assistant', content: [{ type: 'tool_use', id: 'tu' + estado.mensagens.length, name: nome, input }] });
  return (await rodar('03', 'Despachar ferramenta', { input: [{ estado, toolUse: { id: 'tu' + (estado.mensagens.length - 1), name: nome, input }, iter: 0 }] }))[0];
}
(async () => {
  // 1. primeiro contato
  say('titulo', '1) Primeiro contato: transparência e consentimento (LGPD)');
  say('paciente', 'Oi, quero marcar uma avaliação');
  let r = await turno('Oi, quero marcar uma avaliação');
  say('sistema', `rota = ${r.rota}  |  consentimento = ${r.estado.consentimento}`);
  say('bot', await resposta(r));
  say('paciente', 'sim');
  r = await turno('sim');
  say('sistema', `rota = ${r.rota}  |  consentimento = ${r.estado.consentimento}  |  mensagem original recuperada`);


  // 2. áudio
  say('titulo', '2) Mensagem de ÁUDIO (transcrição SIMULADA; demais etapas REAIS)');
  const U = require('../lib/util');
  const bodyWa = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }], messages: [{ id: 'wamid.AUDIO1', from: TEL, timestamp: String(Math.floor(Date.now() / 1000)), type: 'audio', audio: { id: 'MEDIA123', mime_type: 'audio/ogg; codecs=opus' } }] } }] }] });
  say('paciente', '🎤 Mensagem de voz (0:07)');
  const assinar = h => ({ first: () => ({ json: { headers: h }, binary: { data: {} } }) });
  const nodeW = wf('01').nodes.find(n => n.name === 'Validar assinatura e normalizar');
  const runW = async h => (await new AsyncFunction('$input', '$env', 'require', nodeW.parameters.jsCode).call({ helpers: { getBinaryDataBuffer: async () => Buffer.from(bodyWa) } }, assinar(h), { WHATSAPP_APP_SECRET: 'segredo' }, require))[0].json;
  const ruim = await runW({ 'x-hub-signature-256': 'sha256=00' });
  say('bloqueio', `Webhook com assinatura inválida → rejeitado (assinatura_ok = ${ruim.assinatura_ok})`);
  const bom = await runW({ 'x-hub-signature-256': 'sha256=' + U.hmacSha256('segredo', bodyWa) });
  const exp = (await rodar('01', 'Expandir mensagens', { input: [bom] }))[0];
  say('ok', `Assinatura válida → mensagem normalizada: tipo = "${exp.mensagem.tipo}", roteada como "${exp.mensagem.tipo_logico}", media_id = ${exp.mensagem.media_id}`);
  say('sistema', 'Fluxo: baixar mídia na Meta → enviar à transcrição → avaliar qualidade → agente (áudio nunca é salvo)');
  const semCfg = (await rodar('02', 'Preparar', { input: [{ media_id: 'MEDIA123', _ctx: {} }] }))[0];
  say('bloqueio', `Sem serviço de transcrição configurado → falha controlada: ${semCfg.falha}`);
  const comCfg = (await rodar('02', 'Preparar', { input: [{ media_id: 'MEDIA123', _ctx: {} }], env: { TRANSCRIBE_API_URL: 'https://exemplo', TRANSCRIBE_API_KEY: 'x' } }))[0];
  say('ok', `Com serviço configurado → segue para download (media_id = ${comCfg.media_id})`);
  say('sistema', 'Respostas do serviço de transcrição abaixo são SIMULADAS; a avaliação de qualidade é REAL');
  const avaliar = async r => (await rodar('02', 'Avaliar qualidade', { input: [r], refs: { Entrada: [{ _ctx: {} }] } }))[0];
  let a = await avaliar({ text: 'Oi, queria marcar uma limpeza', segments: [{ avg_logprob: -0.2, no_speech_prob: 0.02 }] });
  say('ok', `Áudio claro → ok = ${a.ok}, texto = "${a.texto}"`);
  for (const [nome, r] of [['Áudio mudo', { text: ' ', segments: [] }], ['Só ruído', { text: 'hum', segments: [{ avg_logprob: -0.3, no_speech_prob: 0.92 }] }], ['Fala ininteligível', { text: 'blá blá ahn', segments: [{ avg_logprob: -1.9, no_speech_prob: 0.1 }] }]]) {
    a = await avaliar(r); say('bloqueio', `${nome} → descartado (${a.motivo}); não segue com texto duvidoso`);
  }
  const m0 = { wamid: 'wamid.AUDIO2', telefone: TEL, timestamp: new Date().toISOString() };
  const aviso = (await rodar('01b', 'Msg áudio ruim', { input: [{}], refs: { Entrada: [{ mensagem: m0 }] } }))[0];
  say('bot', aviso.itens[0].texto);
  const entAg = (await rodar('01b', 'Entrada do agente (áudio)', { input: [{ ok: true, texto: 'Estou com muita dor no dente e o rosto inchado, queria marcar' }], refs: { Entrada: [{ mensagem: { ...m0, nome_contato: 'Ana' } }] } }))[0];
  say('paciente', '🎤 (transcrito) ' + entAg.texto);
  estado = null; await turno('oi'); await turno('sim'); // paciente já consentiu
  const linhaAudio = { telefone: TEL, ...serializar(estado) };
  const ra = (await rodar('03', 'Preparar turno', { input: [linhaAudio], refs: { 'Validar configuração': [entAg] } }))[0];
  estado = ra.estado;
  const ctxl = estado.mensagens.at(-1).content[0].text.split('\n').filter(l => /^(origem|alerta_pre_triagem)/.test(l));
  ctxl.forEach(l => say('sistema', 'Contexto enviado ao Claude → ' + l));
  say('ok', `Urgência detectada no ÁUDIO pelas regras (antes do Claude): ${ra.urg.nivel} (${ra.urg.sinais.join(', ')})`);

  // 3. agenda em tempo real (Google simulado)
  say('titulo', '3) Consulta de agenda (Google Agenda SIMULADO; cálculo REAL)');
  const prep = (await rodar('05', 'Preparar consulta', { input: [{ servico_codigo: 'avaliacao', _ctx: {} }] }))[0];
  const ocupado = [{ start: new Date(prep.de + 2 * 3600000).toISOString(), end: new Date(prep.de + 30 * 3600000).toISOString() }];
  const cal = (await rodar('05', 'Calcular horários livres', { input: [{ calendars: { 'cal1@example.com': { busy: ocupado } } }], refs: { Entrada: [{ servico_codigo: 'avaliacao', _ctx: {} }], 'Preparar consulta': [prep] } }))[0];
  say('sistema', `freeBusy simulado: agenda ocupada nas próximas ~30h → ${cal.total_livres} horários livres calculados`);
  cal.slots.forEach((s, i) => say('bot', `Opção ${i + 1}: ${s.rotulo} com ${s.profissional_nome}`));
  const res = { ...cal }; delete res._ctx;
  estado.mensagens.push({ role: 'assistant', content: [{ type: 'tool_use', id: 'tuA', name: 'consultar_agenda', input: {} }] });
  const ap = (await rodar('03', 'Anexar tool_result', { input: [{ ...res, _ctx: { estado, tool_use_id: 'tuA', tool_name: 'consultar_agenda', iter: 0 } }] }))[0];
  estado = ap.estado; say('sistema', `slots guardados na sessão: ${estado.slots_oferecidos.length}`);

  // 3. guardas de confirmação
  say('titulo', '4) Guardas: nunca agenda sem confirmação explícita');
  say('paciente', 'a primeira opção, meu nome é Ana Souza');
  r = await turno('a primeira opção, meu nome é Ana Souza');
  let d = await ferramenta('salvar_dados_paciente', { nome_completo: 'Ana Souza', servico_codigo: 'avaliacao' });
  say('sistema', '[Claude simulado] salvar_dados_paciente → ok');
  d = await ferramenta('propor_acao', { acao: 'agendar', slot_id: estado.slots_oferecidos[0].slot_id });
  say('sistema', `[Claude simulado] propor_acao → ${JSON.stringify({ ok: d.ok, status: d.status })}`);
  d = await ferramenta('executar_acao_confirmada', {});
  say('bloqueio', `Claude tentou executar no MESMO turno → BLOQUEADO pelo código: ${d.erro}`);
  say('bot', 'Posso confirmar sua avaliação? (resumo enviado ao paciente)');
  say('paciente', 'sim, mas pode ser outro horário?');
  r = await turno('sim, mas pode ser outro horário?');
  d = await ferramenta('executar_acao_confirmada', {});
  say('bloqueio', `"sim, mas…" não vale como confirmação → BLOQUEADO: ${d.erro}`);
  say('paciente', 'sim, pode confirmar');
  r = await turno('sim, pode confirmar');
  d = await ferramenta('executar_acao_confirmada', {});
  say('ok', `Confirmação inequívoca em turno posterior → liberado: rota = ${d.rota_tool}, ação = ${d.acao}`);

  // 4. criação do evento (Google simulado)
  say('titulo', '5) Criação do evento (anti-conflito; Google SIMULADO)');
  const prepC = (await rodar('06', 'Prep', { input: [{ op: 'executar', acao: d.acao, telefone: TEL, atendimento_id: estado.atendimento_id, nome: d.nome, servico_codigo: d.servico_codigo, slot: d.slot }] }))[0];
  const c = (await rodar('06', 'Preparar criação', { input: [prepC] }))[0];
  say('sistema', `ID do evento determinístico: ${c.evento_id}`);
  say('sistema', 'Se 2 pacientes disputarem o mesmo horário, o 2º recebe 409 → horario_indisponivel');
  const pos = (await rodar('06', 'Pós-criação', { input: [{}], refs: { 'Modo de criação': [{ ...c, modo: 'inserir' }] } }))[0];
  const fim = (await rodar('06', 'Resultado criação', { input: [{}], refs: { Entrada: [{ _ctx: {} }], 'Pós-criação': [pos], 'Registrar agendamento (07)': [{ ok: true }] } }))[0];
  say('ok', 'Planilha: linha gravada com status "' + pos.dados.status + '"');
  fim.mensagens_fixas.forEach(m => say('bot', m.texto));

  // 5. guardrail de saída
  say('titulo', '6) Guardrails de saída do modelo');
  const g = async t => (await rodar('03', 'Guardrails de saída', { input: [{ estado: { telefone: TEL, tmp: { acao_ok: false, fixas: [] }, mensagens: [] }, texto: t, iter: 1 }] }))[0].rota;
  for (const t of ['Pronto! Sua consulta está confirmada para amanhã.', 'Tome ibuprofeno 600 mg de 8 em 8 horas.', 'Você tem uma cárie profunda.', 'A limpeza custa R$ 150.']) say(await g(t) === 'guardrail' ? 'bloqueio' : 'sistema', `Modelo (simulado) diria: "${t}" → ${await g(t) === 'guardrail' ? 'BLOQUEADO e encaminhado a humano' : 'liberado'}`);
  say('ok', `Resposta normal ("Qual seu nome completo?") → ${await g('Qual seu nome completo?') === 'ok' ? 'liberada' : 'bloqueada'}`);

  // 6. urgência
  say('titulo', '7) Urgência: regra determinística, antes do Claude');
  estado = null;
  for (const t of ['estou com dificuldade para respirar e o rosto inchado', 'quero falar com uma pessoa']) {
    say('paciente', t); r = await turno(t);
    say('sistema', `rota = ${r.rota}`); say('bot', await resposta(r));
  }

  // 7. lembretes
  say('titulo', '8) Lembretes: sem envio duplicado');
  const amanha = new Date(Date.now() + 86400000).toISOString();
  const evg = id => ({ id, status: 'confirmed', start: { dateTime: amanha }, extendedProperties: { private: { clinica: 'vamos-sorrir', telefone: TEL, nome_paciente: 'Ana Souza', profissional_id: 'dr1' } } });
  const cand = (await rodar('09', 'Montar candidatos', { input: [{ items: [evg('e1'), evg('e2')] }] }))[0];
  say('sistema', `Agenda de amanhã (simulada): ${cand.candidatos.length} consultas`);
  let f = await rodar('09', 'Filtrar (deduplicação)', { input: [{}], refs: { 'Montar candidatos': [cand] } });
  say('ok', `1ª execução das 9h → ${f.length} lembretes a enviar`);
  f = await rodar('09', 'Filtrar (deduplicação)', { input: [{ chave: 'e1:D-1', status: 'ENVIADO' }, { chave: 'e2:D-1', status: 'ENVIADO' }], refs: { 'Montar candidatos': [cand] } });
  say('ok', `Reexecução (log mostra ENVIADO) → ${f.length} lembretes (nenhum duplicado)`);
  console.log(JSON.stringify(ev));
})().catch(e => { console.error(e); process.exit(1); });
