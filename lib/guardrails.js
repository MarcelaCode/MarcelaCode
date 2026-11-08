const { norm } = require('./util');
const MEDICAMENTO = /\b(ibuprofeno|paracetamol|dipirona|amoxicilina|nimesulida|diclofenaco|cetoprofeno|azitromicina|clindamicina|metronidazol|dorflex|tylenol|buscopan|aspirina|benzetacil|\d+\s?(mg|ml|gotas|comprimidos?))\b/;
const DIAGNOSTICO = /\b(voce|vc) (tem|esta com|possui|deve ter|provavelmente tem) (uma |um )?(carie|infeccao|abscesso|gengivite|periodontite|pulpite|cisto|fratura|bruxismo)|isso (e|parece|deve ser|eh) (uma |um )?(carie|infeccao|abscesso|gengivite|pulpite)/;
const INTERNO = /\b(n8n|workflow|webhook|api key|apikey|anthropic|claude|openai|planilha|spreadsheet|system prompt|prompt do sistema|token|google sheets|google agenda|json)\b/;
const CLAIM_CONFIRMACAO = /(consulta|agendamento|horario|remarcacao|cancelamento).{0,60}(esta |foi |ficou )?(confirmad|agendad|marcad|remarcad|cancelad)|(confirmei|agendei|marquei|remarquei|cancelei)/;
const PRECO = /r\$\s?\d|\d+\s?reais/;

// ctx: { acaoExecutadaOk: bool, precosPermitidos: string[] }
function verificarSaida(texto, ctx = {}) {
  const t = norm(texto), v = [];
  if (MEDICAMENTO.test(t)) v.push('medicamento_ou_dosagem');
  if (DIAGNOSTICO.test(t)) v.push('diagnostico');
  if (INTERNO.test(t)) v.push('exposicao_interna');
  if (CLAIM_CONFIRMACAO.test(t) && !ctx.acaoExecutadaOk) v.push('confirmacao_sem_registro');
  if (PRECO.test(t)) {
    const ok = (ctx.precosPermitidos || []).some(p => p && t.includes(norm(p)));
    if (!ok) v.push('preco_nao_configurado');
  }
  return { ok: v.length === 0, violacoes: v };
}
const FALLBACK = 'Desculpe, não consegui responder isso com segurança. 🙏 Vou pedir para uma pessoa da nossa equipe continuar o atendimento com você.';
module.exports = { verificarSaida, FALLBACK };
