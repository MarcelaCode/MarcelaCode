#!/usr/bin/env node
// Validação ESTÁTICA dos JSON gerados (estrutura, ligações, sintaxe JS, segredos). NÃO substitui testar no n8n.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'workflows');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
const wfs = arquivos.map(f => ({ arq: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
const ids = new Set(wfs.map(w => w._id_logico));
const erros = [];
const err = (w, m) => erros.push(`${w.arq}: ${m}`);

function saidas(n) {
  let base = 1;
  if (n.type.endsWith('.if')) base = 2;
  else if (n.type.endsWith('.switch')) base = (n.parameters.rules.values || []).length;
  else if (n.type.endsWith('.stopAndError')) base = 0;
  else if (n.type.endsWith('.respondToWebhook')) base = 1;
  if (n.onError === 'continueErrorOutput') base += 1;
  return base;
}
for (const w of wfs) {
  const nomes = new Set(w.nodes.map(n => n.name));
  if (nomes.size !== w.nodes.length) err(w, 'nomes de nó duplicados');
  const porNome = Object.fromEntries(w.nodes.map(n => [n.name, n]));
  const gatilhos = w.nodes.filter(n => /Trigger$|webhook$|manualTrigger$/.test(n.type));
  if (!gatilhos.length) err(w, 'sem gatilho');
  // ligações
  const alcancados = new Set(gatilhos.map(n => n.name)), fila = [...alcancados];
  for (const [de, c] of Object.entries(w.connections)) {
    if (!nomes.has(de)) err(w, `ligação a partir de nó inexistente: ${de}`);
    (c.main || []).forEach((alvos, idx) => {
      if (idx >= saidas(porNome[de] || { type: '', parameters: {} })) err(w, `${de}: saída ${idx} não existe`);
      (alvos || []).forEach(a => { if (!nomes.has(a.node)) err(w, `${de} -> nó inexistente ${a.node}`); });
    });
  }
  while (fila.length) { const n = fila.pop(); for (const alvos of ((w.connections[n] || {}).main || [])) for (const a of alvos || []) if (!alcancados.has(a.node)) { alcancados.add(a.node); fila.push(a.node); } }
  for (const n of w.nodes) if (!alcancados.has(n.name)) err(w, `nó inalcançável: ${n.name}`);
  // nós com saída "erro" devem ter algo ligado nela (senão o erro é engolido)
  for (const n of w.nodes) if (n.onError === 'continueErrorOutput') { const o = ((w.connections[n.name] || {}).main || [])[saidas(n) - 1]; if (!o || !o.length) err(w, `${n.name}: saída de erro sem tratamento`); }
  // código e expressões
  const texto = JSON.stringify(w);
  for (const n of w.nodes) {
    const blob = JSON.stringify(n.parameters);
    for (const m of blob.matchAll(/\$\(\\?['"]([^'"\\]+)\\?['"]\)/g)) if (!nomes.has(m[1])) err(w, `${n.name}: referência a nó inexistente "${m[1]}"`);
    if (n.type.endsWith('.code')) { try { new AsyncFunction('$input', '$env', '$', '$json', n.parameters.jsCode); } catch (e) { err(w, `${n.name}: JS inválido (${e.message})`); } }
    if (n.type.endsWith('.executeWorkflow')) { const m = /__WF:([^_]+)__/.exec(JSON.stringify(n.parameters.workflowId)); if (!m || !ids.has(m[1])) err(w, `${n.name}: sub-workflow inexistente`); }
    if (n.type.endsWith('.googleSheets') && !n.credentials) err(w, `${n.name}: sem credencial`);
  }
  if (/(sk-ant-|sk-[A-Za-z0-9]{20,}|EAA[A-Za-z0-9]{20,}|ya29\.)/.test(texto)) err(w, 'possível segredo embutido');
  if (/"value":\s*"https?:\/\/[^"]*key=/.test(texto)) err(w, 'chave em URL');
  if (w.settings.saveDataSuccessExecution !== 'none') err(w, 'execuções com dados de pacientes sendo salvas (LGPD)');
  if (w._id_logico !== '10' && w.settings.errorWorkflow !== '__WF:10__') err(w, 'sem workflow de erro');
}
// contrato: todo sub-workflow chamado tem gatilho "Entrada"
for (const w of wfs) if (!['01', '09', '10'].includes(w._id_logico) && !w.nodes.some(n => n.name === 'Entrada' && n.type.endsWith('executeWorkflowTrigger'))) err(w, 'sub-workflow sem gatilho "Entrada"');
if (erros.length) { console.error('FALHAS NA VALIDAÇÃO ESTÁTICA:\n- ' + erros.join('\n- ')); process.exit(1); }
console.log(`OK: ${wfs.length} workflows, ${wfs.reduce((s, w) => s + w.nodes.length, 0)} nós (validação estática; não executada no n8n)`);
