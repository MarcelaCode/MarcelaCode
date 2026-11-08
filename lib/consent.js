const { norm } = require('./util');
function interpretarConsentimento(texto) {
  const t = norm(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return 'indefinido';
  if (/\b(nao|nunca|discordo|recuso|nao aceito|nao concordo|prefiro nao)\b/.test(t)) return 'nao';
  if (/^(sim|ok|okay|claro|pode|pode sim|aceito|concordo|tudo bem|beleza|blz|certo|combinado|autorizo|de acordo|continuar|vamos|segue|perfeito|show)\b/.test(t) || /\b(concordo|aceito|autorizo|de acordo)\b/.test(t)) return 'sim';
  return 'indefinido';
}
// Confirmação de agendamento: mais estrita que consentimento.
function confirmacaoExplicita(texto) {
  const raw = String(texto || '');
  const t = norm(raw).replace(/[^a-z0-9? ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.includes('?')) return false;
  if (/\b(mas|porem|outro|outra|trocar|muda|mudar|nao|so que|talvez|acho|depois)\b/.test(t)) return false;
  return /^(sim|confirmo|confirmado|confirma|pode|pode sim|pode confirmar|pode marcar|pode agendar|isso|isso mesmo|fechado|combinado|perfeito|certo|ok|okay|ta bom|ta certo|esta certo|estou de acordo|de acordo|correto|exato|beleza|blz|quero|quero sim)\b/.test(t);
}
function textoAviso(cfg) {
  const c = cfg.clinica, p = cfg.privacidade;
  return `Olá! 😊 Eu sou a assistente virtual da ${c.nome} (um atendimento automatizado, não sou uma pessoa).\n\n` +
    `Para ajudar com seu atendimento, vou usar os dados que você informar (como nome, telefone e o motivo da consulta) apenas para triagem e agendamento. ` +
    `Detalhes e seus direitos: ${p.politica_url}\n\n` +
    `Posso continuar? Responda *sim* para seguir, ou *atendente* para falar com uma pessoa.`;
}
module.exports = { interpretarConsentimento, confirmacaoExplicita, textoAviso };
