#!/usr/bin/env node
// Importa workflows/*.json em uma instância n8n via API pública e resolve os IDs entre workflows.
// ATENÇÃO: NÃO foi executado contra uma instância real (sem acesso no ambiente de desenvolvimento). Revise antes de usar;
// alternativa manual documentada em docs/03-configuracao.md. Requer N8N_API_URL (ex.: https://n8n.exemplo.com) e N8N_API_KEY.
const fs = require('fs');
const path = require('path');
const URL_BASE = (process.env.N8N_API_URL || '').replace(/\/$/, ''), KEY = process.env.N8N_API_KEY;
if (!URL_BASE || !KEY) { console.error('Defina N8N_API_URL e N8N_API_KEY'); process.exit(1); }
const dir = path.join(__dirname, '..', 'workflows');
const wfs = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const api = async (metodo, caminho, corpo) => {
  const r = await fetch(`${URL_BASE}/api/v1${caminho}`, { method: metodo, headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  return r.json();
};
(async () => {
  const ids = {};
  // passo 1: cria todos (sem errorWorkflow, pois o ID ainda não existe)
  for (const w of wfs) {
    const { errorWorkflow, ...settings } = w.settings;
    const c = await api('POST', '/workflows', { name: w.name, nodes: w.nodes, connections: w.connections, settings });
    ids[w._id_logico] = c.id; console.log(`criado ${w.name} -> ${c.id}`);
  }
  // passo 2: substitui os marcadores __WF:xx__ pelos IDs reais
  const subst = txt => txt.replace(/__WF:([^_]+)__/g, (_, k) => ids[k]);
  for (const w of wfs) {
    const corpo = JSON.parse(subst(JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings })));
    await api('PUT', `/workflows/${ids[w._id_logico]}`, corpo); console.log(`vinculado ${w.name}`);
  }
  console.log('\nPronto. Workflows ficam INATIVOS: configure credenciais (docs/03-configuracao.md) e ative 10, 08, 07, 06, 05, 04, 02, 03, 01b, 01, 09b, 09 nesta ordem.');
})().catch(e => { console.error(e.message); process.exit(1); });
