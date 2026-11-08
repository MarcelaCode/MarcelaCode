const { sha256 } = require('./util');
// Remove dados pessoais/segredos de mensagens de erro antes de gravar ou notificar.
function sanitizarMensagem(msg) {
  return String(msg || '')
    .replace(/(sk-[A-Za-z0-9_-]{8,}|EAA[A-Za-z0-9]{10,}|Bearer\s+\S+|ya29\.[\w-]+)/g, '[segredo]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b\d{6,}\b/g, '#')
    .replace(/\s+/g, ' ').trim().slice(0, 200);
}
function chaveErro(workflow, no, msg) {
  return sha256([workflow, no, sanitizarMensagem(msg).replace(/\d+/g, '#')].join('|')).slice(0, 12);
}
// rows: linhas da aba Erros com a mesma chave. Notifica no máximo 1x a cada N minutos por chave.
function deveNotificar(rows, agoraMs, minutos = 15) {
  return !(rows || []).some(r => r.notificado === 'sim' && agoraMs - Date.parse(r.ocorrido_em) < minutos * 60000);
}
module.exports = { sanitizarMensagem, chaveErro, deveNotificar };
