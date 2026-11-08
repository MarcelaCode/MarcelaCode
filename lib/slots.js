const { sha256 } = require('./util');
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const p2 = n => String(n).padStart(2, '0');
// "Relógio local" = UTC deslocado pelo offset fixo da clínica (Brasil sem horário de verão: -180).
function local(ms, off) { return new Date(ms + off * 60000); }
function hm(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function toIsoLocal(ms, off) {
  const d = local(ms, off), s = off <= 0 ? '-' : '+', a = Math.abs(off);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:00${s}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}
function rotulo(startMs, off) {
  const d = local(startMs, off);
  return `${DIAS[d.getUTCDay()]}, ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} às ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}
function dataHoraTexto(startMs, off) {
  const d = local(startMs, off);
  return { data: `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} (${DIAS[d.getUTCDay()]})`, hora: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` };
}
function slotId(profId, startIso) { return sha256(`${profId}|${new Date(startIso).toISOString()}`).slice(0, 12); }

// busy: { [profissional_id]: [{start, end}] }  (ISO)  |  horario: {"1":[["08:00","12:00"]],...}  (0=domingo)
function calcularSlots({ busy, profissionalIds, horario, feriados = [], duracaoMin, passoMin = 30, deMs, ateMs, offset, antecedenciaMin = 120, agoraMs }) {
  const slots = [], minStart = agoraMs + antecedenciaMin * 60000;
  const dia0 = Math.floor(local(deMs, offset).getTime() / 86400000) * 86400000 - offset * 60000; // 00:00 local do primeiro dia, em UTC ms
  for (let dayMs = dia0; dayMs < ateMs; dayMs += 86400000) {
    const l = local(dayMs, offset), dow = String(l.getUTCDay());
    const isoDia = `${l.getUTCFullYear()}-${p2(l.getUTCMonth() + 1)}-${p2(l.getUTCDate())}`;
    if (feriados.includes(isoDia)) continue;
    for (const [ini, fim] of horario[dow] || []) {
      for (let m = hm(ini); m + duracaoMin <= hm(fim); m += passoMin) {
        const s = dayMs + m * 60000, e = s + duracaoMin * 60000;
        if (s < minStart || s < deMs || e > ateMs) continue;
        for (const pid of profissionalIds) {
          const ocupado = (busy[pid] || []).some(b => Date.parse(b.start) < e && Date.parse(b.end) > s);
          if (!ocupado) slots.push({ slot_id: slotId(pid, new Date(s).toISOString()), profissional_id: pid, inicio: toIsoLocal(s, offset), fim: toIsoLocal(e, offset), inicio_ms: s, rotulo: rotulo(s, offset) });
        }
      }
    }
  }
  return slots.sort((a, b) => a.inicio_ms - b.inicio_ms);
}
function periodoOk(slot, periodo, offset) {
  if (!periodo) return true;
  const h = local(slot.inicio_ms, offset).getUTCHours();
  return periodo === 'manha' ? h < 12 : periodo === 'tarde' ? h >= 12 && h < 18 : periodo === 'noite' ? h >= 18 : true;
}
// Duas opções: a primeira disponível e a próxima em outro dia (ou, se não houver, ≥ 2h depois).
function escolherDuas(slots, { periodo, urgencia, offset }) {
  const lista = slots.filter(s => periodoOk(s, periodo, offset));
  if (lista.length <= 2) return lista;
  const a = lista[0];
  if (urgencia) return [a, lista.find(s => s !== a && s.inicio_ms >= a.inicio_ms + 3600000) || lista[1]];
  const dia = s => local(s.inicio_ms, offset).getUTCDate();
  const b = lista.find(s => dia(s) !== dia(a)) || lista.find(s => s.inicio_ms >= a.inicio_ms + 7200000) || lista[1];
  return [a, b];
}
module.exports = { calcularSlots, escolherDuas, slotId, toIsoLocal, rotulo, dataHoraTexto };
