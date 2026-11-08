// Configuração da clínica: nada é inventado; campos pendentes bloqueiam o atendimento.
const PENDENTE = '__PREENCHER__';
const OBRIGATORIOS = [
  'clinica.nome', 'clinica.endereco', 'clinica.telefone', 'clinica.maps_link',
  'privacidade.politica_url', 'privacidade.contato_encarregado',
  'equipe.whatsapp_alertas', 'whatsapp.templates.lembrete', 'whatsapp.templates.alerta_equipe',
  'agenda.fuso_offset_minutos', 'agenda.horario_funcionamento',
];
function get(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function vazio(v) {
  return v === undefined || v === null || v === '' || (typeof v === 'string' && v.includes(PENDENTE)) ||
    (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}
function carregarConfig(json) {
  try { return JSON.parse(json); } catch (e) { return null; }
}
function validarConfig(cfg) {
  if (!cfg) return { ok: false, faltando: ['CLINICA_CONFIG_JSON inválido ou ausente'] };
  const faltando = OBRIGATORIOS.filter(p => vazio(get(cfg, p)));
  const profs = cfg.profissionais || [];
  if (!profs.length) faltando.push('profissionais');
  profs.forEach((p, i) => ['id', 'nome', 'calendar_id'].forEach(k => { if (vazio(p[k])) faltando.push(`profissionais[${i}].${k}`); }));
  const servs = cfg.servicos || [];
  if (!servs.length) faltando.push('servicos');
  servs.forEach((s, i) => {
    ['codigo', 'nome'].forEach(k => { if (vazio(s[k])) faltando.push(`servicos[${i}].${k}`); });
    if (s.agendavel_online !== false && !(s.duracao_min > 0)) faltando.push(`servicos[${i}].duracao_min`);
    if (s.agendavel_online !== false && !(s.profissional_ids || []).length) faltando.push(`servicos[${i}].profissional_ids`);
  });
  return { ok: faltando.length === 0, faltando };
}
function servico(cfg, codigo) { return (cfg.servicos || []).find(s => s.codigo === codigo); }
function profissional(cfg, id) { return (cfg.profissionais || []).find(p => p.id === id); }
// Texto que o agente pode usar sobre a clínica (somente o que está configurado).
function infoClinica(cfg, topico) {
  const c = cfg.clinica || {};
  const nd = 'Informação não configurada pela clínica. Não invente: ofereça encaminhar para a equipe.';
  const val = v => (vazio(v) ? nd : v);
  switch (topico) {
    case 'endereco': return { endereco: val(c.endereco), maps_link: val(c.maps_link) };
    case 'telefone': return { telefone: val(c.telefone) };
    case 'horario_funcionamento': return { horario: val(cfg.agenda && cfg.agenda.horario_funcionamento_texto) };
    case 'profissionais': return { profissionais: (cfg.profissionais || []).filter(p => !vazio(p.nome)).map(p => ({ id: p.id, nome: p.nome, especialidade: vazio(p.especialidade) ? undefined : p.especialidade })) };
    case 'servicos': return { servicos: (cfg.servicos || []).map(s => ({ codigo: s.codigo, nome: s.nome, agendavel_online: s.agendavel_online !== false, descricao: vazio(s.descricao) ? undefined : s.descricao })) };
    case 'precos': return { precos: (cfg.servicos || []).filter(s => !vazio(s.preco_texto)).map(s => ({ servico: s.nome, preco: s.preco_texto })), observacao: 'Se o serviço não aparece aqui, o preço não foi informado: não invente, ofereça avaliação ou equipe.' };
    case 'formas_pagamento': return { formas_pagamento: val(c.formas_pagamento) };
    case 'orientacoes_consulta': return { orientacoes: val(cfg.agenda && cfg.agenda.orientacoes_consulta) };
    default: return { erro: 'topico_desconhecido', topicos: ['endereco', 'telefone', 'horario_funcionamento', 'profissionais', 'servicos', 'precos', 'formas_pagamento', 'orientacoes_consulta'] };
  }
}
module.exports = { PENDENTE, OBRIGATORIOS, carregarConfig, validarConfig, servico, profissional, infoClinica, vazio };
