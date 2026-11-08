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
async function rodar(p, no, { input = [{}], refs = {} } = {}) {
  const node = wf(p).nodes.find(n => n.name === no);
  const itens = input.map(j => ({ json: j }));
  const $ = n => { const l = refs[n].map(j => ({ json: j })); return { first: () => l[0], all: () => l }; };
  const fn = new AsyncFunction('$input', '$', '$env', 'require', node.parameters.jsCode);
  return (await fn.call({ helpers: {} }, { first: () => itens[0], all: () => itens }, $, ENV, require)).map(i => i.json);
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

  // 2. agenda em tempo real (Google simulado)
  say('titulo', '2) Consulta de agenda (Google Agenda SIMULADO; cálculo REAL)');
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
  say('titulo', '3) Guardas: nunca agenda sem confirmação explícita');
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
  say('titulo', '4) Criação do evento (anti-conflito; Google SIMULADO)');
  const prepC = (await rodar('06', 'Prep', { input: [{ op: 'executar', acao: d.acao, telefone: TEL, atendimento_id: estado.atendimento_id, nome: d.nome, servico_codigo: d.servico_codigo, slot: d.slot }] }))[0];
  const c = (await rodar('06', 'Preparar criação', { input: [prepC] }))[0];
  say('sistema', `ID do evento determinístico: ${c.evento_id}`);
  say('sistema', 'Se 2 pacientes disputarem o mesmo horário, o 2º recebe 409 → horario_indisponivel');
  const pos = (await rodar('06', 'Pós-criação', { input: [{}], refs: { 'Modo de criação': [{ ...c, modo: 'inserir' }] } }))[0];
  const fim = (await rodar('06', 'Resultado criação', { input: [{}], refs: { Entrada: [{ _ctx: {} }], 'Pós-criação': [pos], 'Registrar agendamento (07)': [{ ok: true }] } }))[0];
  say('ok', 'Planilha: linha gravada com status "' + pos.dados.status + '"');
  fim.mensagens_fixas.forEach(m => say('bot', m.texto));

  // 5. guardrail de saída
  say('titulo', '5) Guardrails de saída do modelo');
  const g = async t => (await rodar('03', 'Guardrails de saída', { input: [{ estado: { telefone: TEL, tmp: { acao_ok: false, fixas: [] }, mensagens: [] }, texto: t, iter: 1 }] }))[0].rota;
  for (const t of ['Pronto! Sua consulta está confirmada para amanhã.', 'Tome ibuprofeno 600 mg de 8 em 8 horas.', 'Você tem uma cárie profunda.', 'A limpeza custa R$ 150.']) say(await g(t) === 'guardrail' ? 'bloqueio' : 'sistema', `Modelo (simulado) diria: "${t}" → ${await g(t) === 'guardrail' ? 'BLOQUEADO e encaminhado a humano' : 'liberado'}`);
  say('ok', `Resposta normal ("Qual seu nome completo?") → ${await g('Qual seu nome completo?') === 'ok' ? 'liberada' : 'bloqueada'}`);

  // 6. urgência
  say('titulo', '6) Urgência: regra determinística, antes do Claude');
  estado = null;
  for (const t of ['estou com dificuldade para respirar e o rosto inchado', 'quero falar com uma pessoa']) {
    say('paciente', t); r = await turno(t);
    say('sistema', `rota = ${r.rota}`); say('bot', await resposta(r));
  }

  // 7. lembretes
  say('titulo', '7) Lembretes: sem envio duplicado');
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
