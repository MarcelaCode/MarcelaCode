const { hmacSha256, normalizePhone } = require('./util');

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// header: "sha256=<hex>" (X-Hub-Signature-256), rawBody: string exato recebido
function verifySignature(rawBody, header, appSecret) {
  if (!rawBody || !header || !appSecret) return false;
  const expected = 'sha256=' + hmacSha256(appSecret, rawBody);
  return safeEqual(expected, String(header));
}

// Converte o payload da Cloud API em mensagens normalizadas. Ignora status de entrega.
function parseWebhook(body) {
  const out = { mensagens: [], status: [] };
  for (const entry of (body && body.entry) || []) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {};
      const nomes = {};
      for (const c of v.contacts || []) nomes[c.wa_id] = c.profile && c.profile.name;
      for (const s of v.statuses || []) out.status.push({ wamid: s.id, status: s.status, para: s.recipient_id, erros: s.errors || null });
      for (const m of v.messages || []) {
        const base = {
          wamid: m.id, telefone: normalizePhone(m.from), nome_contato: nomes[m.from] || '',
          timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
          tipo: m.type, texto: '', media_id: null,
        };
        if (m.type === 'text') base.texto = (m.text && m.text.body) || '';
        else if (m.type === 'audio') { base.media_id = m.audio && m.audio.id; base.mime = m.audio && m.audio.mime_type; }
        else if (m.type === 'button') base.texto = (m.button && (m.button.text || m.button.payload)) || '';
        else if (m.type === 'interactive') {
          const i = m.interactive || {};
          base.texto = (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || '';
        }
        out.mensagens.push(base);
      }
    }
  }
  return out;
}
// Tipo lógico para roteamento: texto | audio | nao_suportado
function tipoLogico(m) {
  if (['text', 'button', 'interactive'].includes(m.tipo) && m.texto) return 'texto';
  if (m.tipo === 'audio' && m.media_id) return 'audio';
  return 'nao_suportado';
}
// Janela de atendimento de 24h da Meta, contada a partir da última mensagem RECEBIDA do paciente.
function janelaAberta(ultimoInboundIso, agoraMs) {
  if (!ultimoInboundIso) return false;
  const t = Date.parse(ultimoInboundIso);
  if (Number.isNaN(t)) return false;
  return (agoraMs - t) < 24 * 3600 * 1000 - 60 * 1000; // 1 min de margem
}
function dividirTexto(texto, max = 1000) {
  const t = String(texto || '').trim();
  if (t.length <= max) return t ? [t] : [];
  const partes = []; let atual = '';
  for (const par of t.split(/\n{2,}/)) {
    if ((atual + '\n\n' + par).length > max && atual) { partes.push(atual); atual = par; }
    else atual = atual ? atual + '\n\n' + par : par;
  }
  if (atual) partes.push(atual);
  return partes.flatMap(p => p.length <= max ? [p] : p.match(new RegExp('[\\s\\S]{1,' + max + '}', 'g')));
}
// item: {tipo:'texto'|'template'|'localizacao', texto, template:{nome, idioma, parametros[]}, localizacao:{lat,lng,nome,endereco}}
// Regra Meta: texto livre só dentro da janela; fora dela exige template aprovado.
function montarEnvio(item, para, janelaOk) {
  if (item.tipo === 'texto' || item.tipo === 'localizacao') {
    if (!janelaOk) return { erro: 'fora_da_janela_24h' };
  }
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: para };
  if (item.tipo === 'texto') return { payload: { ...base, type: 'text', text: { preview_url: true, body: item.texto } } };
  if (item.tipo === 'localizacao') {
    const l = item.localizacao;
    return { payload: { ...base, type: 'location', location: { latitude: l.lat, longitude: l.lng, name: l.nome, address: l.endereco } } };
  }
  if (item.tipo === 'template') {
    const t = item.template;
    if (!t || !t.nome) return { erro: 'template_sem_nome' };
    return { payload: { ...base, type: 'template', template: {
      name: t.nome, language: { code: t.idioma || 'pt_BR' },
      components: (t.parametros && t.parametros.length) ? [{ type: 'body', parameters: t.parametros.map(p => ({ type: 'text', text: String(p).slice(0, 60) })) }] : [],
    } } };
  }
  return { erro: 'tipo_invalido' };
}
module.exports = { verifySignature, parseWebhook, tipoLogico, janelaAberta, dividirTexto, montarEnvio };
