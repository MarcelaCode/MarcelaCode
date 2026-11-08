// Workflow 03 - Agente Claude (loop de ferramentas controlado por código)
const fs = require('fs');
const path = require('path');
const { WF } = require('./wf-lib');
const { CFG } = require('./def-base');
const PROMPT = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'system_prompt.md'), 'utf8');
const LIBS = ['config', 'slots', 'booking', 'consent', 'triage', 'session', 'claude', 'guardrails', 'sheets'];

function wf03() {
  const w = new WF('03', '03 - Agente Claude');
  w.trigger();
  w.code('Validar configuração', LIBS, CFG + String.raw`
const e = $input.first().json, v = validarConfig(cfg);
return [{ json: { ...e, cfg_ok: v.ok, faltando: v.faltando } }];`);
  w.if_('Configuração completa?', '={{ $json.cfg_ok }}', 'true');
  w.code('Resposta config incompleta', [], String.raw`
const e = $input.first().json;
return [{ json: { telefone: e.telefone, ultimo_inbound_em: new Date().toISOString(), itens: [{ tipo: 'texto', texto: 'Olá! 😊 Estou com uma instabilidade no momento. Uma pessoa da equipe vai continuar seu atendimento em breve.' }], erro_config: e.faltando, _ctx: {} } }];`);
  w.exec('Avisar paciente (config)', '08');
  w.add('Falha de configuração', 'n8n-nodes-base.stopAndError', 1, { errorMessage: '={{ "Configuração da clínica incompleta: " + ($("Resposta config incompleta").first().json.erro_config || []).join(", ") }}' });
  w.lerPorColuna('Buscar sessão', 'Sessoes', 'telefone', "={{ $('Validar configuração').first().json.telefone }}");

  w.code('Preparar turno', LIBS, CFG + String.raw`
const e = $('Validar configuração').first().json, rowSessao = $input.first().json;
const agoraMs = Date.now(), agoraIso = new Date(agoraMs).toISOString();
const ttl = (cfg.privacidade.retencao && cfg.privacidade.retencao.sessoes_dias) || 7;
let estado = rowSessao && rowSessao.telefone ? deserializar(rowSessao) : null;
if (expirou(estado, ttl, agoraMs)) estado = novoEstado(e.telefone, e.nome_contato, agoraIso);
estado.turno += 1; estado.tmp = { acao_ok: false, fixas: [] };
estado.ultimo_inbound_em = e.timestamp || agoraIso;
if (e.nome_contato) estado.paciente.nome_contato = e.nome_contato;
let texto = e.texto || '';
const urg = classificarUrgencia(texto);
let rota = 'agente';
if (urg.nivel === 'EMERGENCIA') { rota = 'emergencia'; estado.urgencia = 'EMERGENCIA'; }
else if (direitosTitular(texto)) rota = 'direitos';
else if (querHumano(texto)) rota = 'humano';
else if (estado.consentimento === null) {
  if (!estado.aviso_enviado) { rota = urg.nivel === 'URGENTE' ? 'urgente_aviso' : 'aviso'; estado.aviso_enviado = true; estado.mensagem_pendente_consent = { texto, origem: e.origem }; if (urg.nivel === 'URGENTE') estado.urgencia = 'URGENTE'; }
  else {
    const c = interpretarConsentimento(texto);
    if (c === 'sim') { estado.consentimento = 'sim'; estado.consentimento_em = agoraIso; const p = estado.mensagem_pendente_consent; if (p && p.texto) texto = p.texto; estado.mensagem_pendente_consent = null; }
    else if (c === 'nao') { estado.consentimento = 'nao'; rota = 'consent_negado'; }
    else rota = 'aviso_repetir';
  }
} else if (estado.consentimento === 'nao') {
  if (interpretarConsentimento(texto) === 'sim') { estado.consentimento = 'sim'; estado.consentimento_em = agoraIso; } else rota = 'consent_negado';
}
if (rota === 'emergencia' && estado.consentimento === null) { estado.aviso_enviado = false; }
if (rota === 'agente') {
  if (urg.nivel === 'URGENTE') estado.urgencia = 'URGENTE';
  estado.mensagens.push({ role: 'user', content: [{ type: 'text', text: contextoTurno(estado, cfg, texto, e.origem, agoraMs, urg) }] });
}
return [{ json: { estado, rota, urg, origem: e.origem, wamid: e.wamid, iter: 0 } }];`);
  w.if_('Rota é agente?', "={{ $json.rota === 'agente' }}", 'true');
  w.if_('Exige encaminhamento humano?', "={{ ['emergencia','humano','direitos','urgente_aviso','erro_ia','guardrail'].includes($json.rota) }}", 'true');
  w.code('Preparar triagem', [], String.raw`
const j = $input.first().json, e = j.estado;
const map = { emergencia: ['EMERGENCIA', null, j.urg && j.urg.sinais], urgente_aviso: ['URGENTE', null, j.urg && j.urg.sinais], humano: ['HUMANO', 'paciente pediu atendimento humano'], direitos: ['HUMANO', 'direitos do titular (LGPD)'], erro_ia: ['HUMANO', 'falha técnica no atendimento automatizado'], guardrail: ['HUMANO', 'resposta bloqueada por regra de segurança'] };
const [nivel, motivo, sinais] = map[j.rota];
e.escalado = true;
return [{ json: { ...j, entrada: { nivel, motivo, sinais: sinais || [], telefone: e.telefone, atendimento_id: e.atendimento_id, nome: e.paciente.nome || e.paciente.nome_contato, _ctx: { j } } } }];`);
  w.code('Entrada da triagem', [], "return [{ json: $input.first().json.entrada }];");
  w.exec('Triagem (04)', '04');
  w.code('Compor resposta fixa', LIBS, CFG + String.raw`
let j = $input.first().json, alertado = false;
try { const pt = $('Preparar triagem').first(); if (pt) { j = pt.json; alertado = $input.first().json.alertado === true; } } catch (err) { /* caminho sem triagem */ }
const e = j.estado, tel = cfg.clinica.telefone;
const ligue = ' Se preferir, ligue para ' + tel + '.';
const avisei = alertado ? ' Já avisei nossa equipe.' : ligue;
let t;
switch (j.rota) {
  case 'emergencia': t = cfg.urgencia.texto_emergencia + avisei; break;
  case 'urgente_aviso': t = 'Sinto muito que esteja assim. 🙏' + (alertado ? ' Já avisei a equipe para priorizar seu caso.' : ligue) + ' Para seguir com horários, ' + textoAviso(cfg).replace(/^Olá! 😊 /, ''); break;
  case 'humano': t = 'Claro! Vou chamar uma pessoa da equipe para continuar com você. 😊' + (alertado ? '' : ligue); break;
  case 'direitos': t = 'Entendi. Pedidos sobre seus dados pessoais são tratados pela equipe da clínica (contato: ' + cfg.privacidade.contato_encarregado + ').' + (alertado ? ' Já avisei a equipe e você receberá retorno. 🙏' : ligue); break;
  case 'aviso': t = textoAviso(cfg); break;
  case 'aviso_repetir': t = 'Para continuar o atendimento automatizado preciso do seu OK sobre o uso dos dados (detalhes: ' + cfg.privacidade.politica_url + '). Responda *sim* para seguir ou *atendente* para falar com uma pessoa.'; break;
  case 'consent_negado': t = 'Tudo bem, sem problema! Sem o seu OK não sigo com o atendimento automatizado.' + ligue + ' 😊'; break;
  case 'guardrail': t = FALLBACK + (alertado ? '' : ligue); break;
  default: t = 'Desculpe, tive um problema técnico agora. 🙏' + avisei;
}
return [{ json: { estado: e, itens: [{ tipo: 'texto', texto: t }], rota: j.rota } }];`);

  // ---- loop do agente ----
  // A chamada à API é feita dentro do Code node: o estado acompanha a chamada (sem depender de referências a nós em loop)
  // e a retentativa controlada usa lib/retry.js (apenas erros retentáveis: rede, 408/409/425/429/5xx).
  w.code('Chamar Claude', LIBS.concat(['retry']), CFG + "\nconst SYSTEM_PROMPT = " + JSON.stringify(PROMPT) + String.raw`;
const j = $input.first().json, e = j.estado;
const body = construirRequisicao({ cfg, systemPrompt: SYSTEM_PROMPT, estado: e, modelo: $env.ANTHROPIC_MODEL, esforco: $env.ANTHROPIC_EFFORT });
let resp = null;
for (let t = 0; t < 3 && !resp; t++) {
  try {
    resp = await this.helpers.httpRequest({ method: 'POST', url: ($env.ANTHROPIC_API_URL || 'https://api.anthropic.com') + '/v1/messages', json: true, timeout: 120000, body,
      headers: { 'x-api-key': $env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'content-type': 'application/json' } });
  } catch (err) {
    const st = Number(err.httpCode || err.statusCode || (err.response && err.response.status)) || null;
    if (!retentavel(st) || t === 2) break;
    await new Promise(r => setTimeout(r, 2000 * Math.pow(2, t)));
  }
}
const r = interpretar(resp);
const falha = { estado: e, tipo: 'erro', rota: 'erro_ia', urg: j.urg, iter: j.iter };
if (!resp || r.stop === 'refusal' || r.stop === 'erro' || (r.stop === 'max_tokens' && !r.texto)) return [{ json: falha }];
e.mensagens.push({ role: 'assistant', content: r.content }); // append-only: blocos do modelo voltam intactos
if (r.stop === 'tool_use' && r.toolUse) return [{ json: { estado: e, tipo: 'tool', toolUse: r.toolUse, iter: j.iter, urg: j.urg } }];
return [{ json: { estado: e, tipo: 'final', texto: r.texto, iter: j.iter, urg: j.urg } }];`);
  w.switch_('Tipo de resposta', '={{ $json.tipo }}', ['tool', 'final', 'erro']);
  w.code('Despachar ferramenta', LIBS, CFG + String.raw`
const j = $input.first().json, e = j.estado, tu = j.toolUse;
if ((j.iter || 0) >= MAX_ITER) return [{ json: { rota_tool: 'estouro', estado: e, urg: j.urg, _ctx: { estado: e, tool_use_id: tu.id, tool_name: tu.name, iter: j.iter } } }];
const ultimo = e.mensagens.filter(m => m.role === 'user' && Array.isArray(m.content) && m.content[0] && m.content[0].type === 'text').pop();
const mm = ultimo && /<mensagem_paciente>\n([\s\S]*?)\n<\/mensagem_paciente>/.exec(ultimo.content[0].text);
const textoAtual = mm ? mm[1] : '';
const d = despachar(tu, e, cfg, { agoraMs: Date.now(), texto: textoAtual });
const _ctx = { estado: e, tool_use_id: tu.id, tool_name: tu.name, iter: j.iter };
if (d.rota === 'local') return [{ json: { rota_tool: 'local', ...d.resultado, _ctx } }];
return [{ json: { rota_tool: d.rota, ...d.entrada, _ctx } }];`);
  w.switch_('Rota da ferramenta', '={{ $json.rota_tool }}', ['local', 'agenda', 'consulta_op', 'triagem', 'estouro']);
  w.exec('Agenda (05)', '05'); w.exec('Consulta (06)', '06'); w.exec('Triagem ferramenta (04)', '04');
  w.code('Estouro de iterações', [], "const j = $input.first().json; return [{ json: { estado: j.estado, rota: 'erro_ia', urg: j.urg } }];");
  w.code('Anexar tool_result', LIBS, String.raw`
const r = $input.first().json, { _ctx, rota_tool, ...res } = r;
const e = _ctx.estado;
aplicarResultado(e, _ctx.tool_name, res);
if (_ctx.tool_name === 'executar_acao_confirmada' && res.ok) { e.tmp.acao_ok = true; e.tmp.fixas = res.mensagens_fixas || []; }
if (_ctx.tool_name === 'registrar_triagem_urgencia' && res.ok === false) res.instrucao = 'Aviso à equipe falhou; informe o telefone da clínica ao paciente.';
const { mensagens_fixas, ...paraModelo } = res;
e.mensagens.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: _ctx.tool_use_id, content: JSON.stringify(paraModelo).slice(0, 6000), ...(res.ok === false || res.erro ? { is_error: true } : {}) }] });
return [{ json: { estado: e, iter: (_ctx.iter || 0) + 1 } }];`);
  w.code('Guardrails de saída', LIBS, CFG + String.raw`
const j = $input.first().json, e = j.estado, tmp = e.tmp || {};
if (tmp.acao_ok && tmp.fixas && tmp.fixas.length) return [{ json: { estado: e, itens: tmp.fixas, rota: 'ok' } }];
const precos = (cfg.servicos || []).map(s => s.preco_texto).filter(Boolean);
const v = verificarSaida(j.texto, { acaoExecutadaOk: !!tmp.acao_ok, precosPermitidos: precos });
if (!v.ok || !j.texto) return [{ json: { estado: e, rota: 'guardrail', urg: j.urg, violacoes: v.violacoes } }];
return [{ json: { estado: e, itens: [{ tipo: 'texto', texto: j.texto }], rota: 'ok' } }];`);
  w.if_('Saída aprovada?', "={{ $json.rota === 'ok' }}", 'true');

  // ---- envio e persistência ----
  w.code('Preparar envio', [], String.raw`
const j = $input.first().json, e = j.estado;
return [{ json: { telefone: e.telefone, ultimo_inbound_em: e.ultimo_inbound_em, itens: j.itens, _ctx: { estado: e } } }];`);
  w.exec('Enviar resposta (08)', '08');
  w.code('Preparar salvamento', LIBS, CFG + String.raw`
const r = $input.first().json, e = r._ctx.estado;
if (!r.ok) return [{ json: { falha_envio: true, erro: r.erro } }];
delete e.tmp;
let partes = serializar(e), est = e;
if (!partes) { est = reiniciarComResumo(e, new Date().toISOString()); partes = serializar(est); }
const ret = (cfg.privacidade.retencao && cfg.privacidade.retencao.sessoes_dias) || 7;
const agora = new Date();
const row = linhaParcial('Sessoes', { telefone: est.telefone, ...partes, consentimento: est.consentimento || '', ultimo_inbound_em: est.ultimo_inbound_em, atualizado_em: agora.toISOString(), expira_em: new Date(agora.getTime() + ret * 86400000).toISOString() });
let status = est.escalado ? 'Encaminhado para atendimento humano' : est.pendente ? 'Aguardando confirmação' : null;
if (!status && est.consentimento === 'sim') status = 'Em atendimento';
const dados = status ? { id_atendimento: est.atendimento_id, nome_paciente: est.paciente.nome || '', whatsapp: est.telefone, motivo_contato: est.paciente.motivo_texto || '', status, consentimento_em: est.consentimento_em || '' } : null;
return [{ json: { row, dados, falha_envio: false } }];`);
  w.if_('Envio ok?', '={{ !$json.falha_envio }}', 'true');
  w.code('Linha da sessão', [], "return [{ json: $input.first().json.row }];");
  w.upsert('Salvar sessão', 'Sessoes', 'telefone');
  w.code('Preparar status do atendimento', [], String.raw`
const d = $('Preparar salvamento').first().json.dados;
return d ? [{ json: { op: 'upsert_atendimento', dados: d, _ctx: {} } }] : [{ json: { op: 'nenhum' } }];`);
  w.exec('Atualizar atendimento (07)', '07');
  w.code('Resultado final', [], "return [{ json: { ok: true } }];");
  w.code('Resultado falha de envio', [], "const p = $('Preparar salvamento').first().json; return [{ json: { ok: false, erro: p.erro || 'envio_falhou' } }];");

  // ---- ligações ----
  w.chain('Entrada', 'Validar configuração', 'Configuração completa?');
  w.link('Configuração completa?', 'Buscar sessão', 0); w.link('Configuração completa?', 'Resposta config incompleta', 1);
  w.chain('Resposta config incompleta', 'Avisar paciente (config)', 'Falha de configuração');
  w.chain('Buscar sessão', 'Preparar turno', 'Rota é agente?');
  w.link('Rota é agente?', 'Chamar Claude', 0); w.link('Rota é agente?', 'Exige encaminhamento humano?', 1);
  w.link('Exige encaminhamento humano?', 'Preparar triagem', 0); w.link('Exige encaminhamento humano?', 'Compor resposta fixa', 1);
  w.chain('Preparar triagem', 'Entrada da triagem', 'Triagem (04)', 'Compor resposta fixa');
  w.link('Compor resposta fixa', 'Preparar envio');
  w.link('Chamar Claude', 'Tipo de resposta');
  w.link('Tipo de resposta', 'Despachar ferramenta', 0); w.link('Tipo de resposta', 'Guardrails de saída', 1); w.link('Tipo de resposta', 'Preparar triagem', 2);
  w.link('Despachar ferramenta', 'Rota da ferramenta');
  w.link('Rota da ferramenta', 'Anexar tool_result', 0); w.link('Rota da ferramenta', 'Agenda (05)', 1); w.link('Rota da ferramenta', 'Consulta (06)', 2); w.link('Rota da ferramenta', 'Triagem ferramenta (04)', 3); w.link('Rota da ferramenta', 'Estouro de iterações', 4);
  w.link('Agenda (05)', 'Anexar tool_result'); w.link('Consulta (06)', 'Anexar tool_result'); w.link('Triagem ferramenta (04)', 'Anexar tool_result');
  w.link('Estouro de iterações', 'Preparar triagem');
  w.link('Anexar tool_result', 'Chamar Claude');
  w.chain('Guardrails de saída', 'Saída aprovada?');
  w.link('Saída aprovada?', 'Preparar envio', 0); w.link('Saída aprovada?', 'Preparar triagem', 1);
  w.chain('Preparar envio', 'Enviar resposta (08)', 'Preparar salvamento', 'Envio ok?');
  w.link('Envio ok?', 'Linha da sessão', 0); w.link('Envio ok?', 'Resultado falha de envio', 1);
  w.chain('Linha da sessão', 'Salvar sessão', 'Preparar status do atendimento', 'Atualizar atendimento (07)', 'Resultado final');
  return w;
}
module.exports = { wf03 };
