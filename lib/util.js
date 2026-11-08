// Utilitários compartilhados. Nos workflows n8n este arquivo é inlinado em cada Code node.
const crypto = require('crypto'); // exige NODE_FUNCTION_ALLOW_BUILTIN=crypto no n8n

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function hmacSha256(secret, data) { return crypto.createHmac('sha256', secret).update(data).digest('hex'); }
function stripAccents(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function norm(s) { return stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

// Normaliza para dígitos com DDI (Brasil por padrão). WhatsApp envia "5511999999999".
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  // Número móvel BR antigo sem o 9: 55 + DDD + 8 dígitos
  if (d.length === 12 && d.startsWith('55') && /^[6-9]/.test(d.slice(4))) d = d.slice(0, 4) + '9' + d.slice(4);
  return d;
}
function maskPhone(p) { const d = String(p || ''); return d.length > 6 ? d.slice(0, 4) + '*****' + d.slice(-2) : '***'; }
function phoneHash(p) { return sha256('tel:' + normalizePhone(p)).slice(0, 16); }

// Evita injeção de fórmulas em planilhas (=, +, -, @).
function sanitizeCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
module.exports = { sha256, hmacSha256, stripAccents, norm, normalizePhone, maskPhone, phoneHash, sanitizeCell };
