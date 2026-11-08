const { toIsoLocal, dataHoraTexto } = require('./slots');
const MAX_TENTATIVAS = 3;

function intervaloAmanha(agoraMs, offset) {
  const l = new Date(agoraMs + offset * 60000);
  const hoje0 = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - offset * 60000;
  const ini = hoje0 + 86400000, fim = ini + 86400000;
  return { timeMin: new Date(ini).toISOString(), timeMax: new Date(fim).toISOString(), iniMs: ini };
}
// events: itens da Calendar API (events.list com singleEvents=true)
function candidatos(events, offset) {
  const out = [];
  for (const ev of events || []) {
    const p = (ev.extendedProperties && ev.extendedProperties.private) || {};
    if (p.clinica !== 'vamos-sorrir' || ev.status === 'cancelled' || !p.telefone || !ev.start || !ev.start.dateTime) continue;
    const ms = Date.parse(ev.start.dateTime), { data, hora } = dataHoraTexto(ms, offset);
    out.push({ chave: `${ev.id}:D-1`, evento_id: ev.id, telefone: p.telefone, telefone_hash: p.telefone_hash || '', nome: p.nome_paciente || '', data, hora, inicio_ms: ms });
  }
  return out;
}
// log: linhas da aba Lembretes. Regras anti-duplicidade:
//  ENVIADO -> nunca reenviar | FALHOU com tentativas < MAX -> reenviar | ENVIANDO recente -> aguardar | ENVIANDO antigo -> NÃO reenviar (pode ter saído): revisão humana
function filtrar(cands, log, agoraMs) {
  const idx = new Map((log || []).map(r => [r.chave, r]));
  const enviar = [], pular = [];
  for (const c of cands) {
    const r = idx.get(c.chave);
    if (!r) { enviar.push({ ...c, tentativas: 0 }); continue; }
    const t = Number(r.tentativas || 0);
    if (r.status === 'ENVIADO') pular.push({ chave: c.chave, motivo: 'ja_enviado' });
    else if (r.status === 'FALHOU' && t < MAX_TENTATIVAS) enviar.push({ ...c, tentativas: t });
    else if (r.status === 'FALHOU') pular.push({ chave: c.chave, motivo: 'maximo_tentativas' });
    else if (r.status === 'ENVIANDO') pular.push({ chave: c.chave, motivo: (agoraMs - Date.parse(r.atualizado_em)) > 30 * 60000 ? 'envio_incerto_revisar' : 'em_andamento' });
    else pular.push({ chave: c.chave, motivo: 'status_desconhecido' });
  }
  return { enviar, pular };
}
function parametrosTemplate(c, cfg) { return [String(c.nome || '').split(' ')[0] || 'paciente', c.data, c.hora, cfg.clinica.nome]; }
module.exports = { MAX_TENTATIVAS, intervaloAmanha, candidatos, filtrar, parametrosTemplate };
