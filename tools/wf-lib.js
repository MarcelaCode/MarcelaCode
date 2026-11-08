// Mini-DSL para gerar workflows n8n (JSON importável) de forma determinística.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LIB = path.join(__dirname, '..', 'lib');

function uuid(seed) { const h = crypto.createHash('sha1').update(seed).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }

// Inlina módulos de lib/ dentro de um Code node (n8n não consegue require de arquivos locais).
function inlinar(libs) {
  // resolve dependências (require('./x')) em ordem topológica; util sempre primeiro
  const ordem = [], visto = new Set();
  const visitar = n => {
    if (visto.has(n)) return; visto.add(n);
    const src = fs.readFileSync(path.join(LIB, n + '.js'), 'utf8');
    for (const m of src.matchAll(/require\('\.\/([^']+)'\)/g)) visitar(m[1]);
    ordem.push(n);
  };
  visitar('util'); libs.forEach(visitar);
  return ordem.map(n => {
    let s = fs.readFileSync(path.join(LIB, n + '.js'), 'utf8');
    s = s.replace(/^const .*require\('\.\/[^']+'\);?\s*$/gm, '');
    s = s.replace(/module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/, '');
    return `// ---- lib/${n}.js ----\n${s.trim()}`;
  }).join('\n\n');
}

class WF {
  constructor(id, nome, { piiSemLog = true, erroWf = true, extra = {} } = {}) {
    this.id = id; this.nome = nome; this.nodes = []; this.conns = {}; this.n = 0;
    this.settings = { executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveManualExecutions: false,
      ...(piiSemLog ? { saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none', saveExecutionProgress: false } : {}),
      ...(erroWf ? { errorWorkflow: '__WF:10__' } : {}), ...extra };
  }
  add(nome, type, typeVersion, parameters, extra = {}) {
    if (this.nodes.some(x => x.name === nome)) throw new Error(`Nó duplicado em ${this.id}: ${nome}`);
    const col = this.n % 6, lin = Math.floor(this.n / 6);
    const node = { parameters, id: uuid(`${this.id}:${nome}`), name: nome, type, typeVersion, position: extra.position || [260 * col, 220 * lin], ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'position')) };
    this.nodes.push(node); this.n++; return nome;
  }
  link(de, para, saida = 0) {
    ((this.conns[de] ||= { main: [] }).main[saida] ||= []).push({ node: para, type: 'main', index: 0 });
  }
  chain(...nomes) { for (let i = 0; i < nomes.length - 1; i++) this.link(nomes[i], nomes[i + 1]); }
  // ---- tipos de nó ----
  code(nome, libs, corpo, extra) {
    return this.add(nome, 'n8n-nodes-base.code', 2, { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `${inlinar(libs)}\n\n// ---- nó: ${nome} ----\n${corpo}` }, extra);
  }
  trigger(nome = 'Entrada') { return this.add(nome, 'n8n-nodes-base.executeWorkflowTrigger', 1.1, { inputSource: 'passthrough' }); }
  exec(nome, wfId, extra = {}, params = {}) {
    return this.add(nome, 'n8n-nodes-base.executeWorkflow', 1.1, { source: 'database', workflowId: { __rl: true, value: `__WF:${wfId}__`, mode: 'id' }, options: { waitForSubWorkflow: true }, ...params }, { onError: 'continueRegularOutput', ...extra });
  }
  if_(nome, esq, op, dir) {
    const operator = op === 'true' ? { type: 'boolean', operation: 'true', singleValue: true } : { type: 'string', operation: op };
    const cond = { id: uuid(nome), leftValue: esq, operator }; if (op !== 'true') cond.rightValue = dir;
    return this.add(nome, 'n8n-nodes-base.if', 2, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [cond], combinator: 'and' }, options: {} });
  }
  // abas do Google Sheets
  planilha(nome, aba, operacao, extraParams = {}, extra = {}) {
    const base = { resource: 'sheet', operation: operacao, documentId: { __rl: true, value: '={{ $env.SHEETS_ID }}', mode: 'id' }, sheetName: { __rl: true, value: aba, mode: 'name' } };
    return this.add(nome, 'n8n-nodes-base.googleSheets', 4.5, { ...base, ...extraParams }, { credentials: { googleSheetsOAuth2Api: { id: '', name: 'Google Sheets - Vamos Sorrir' } }, ...extra });
  }
  lerPorColuna(nome, aba, coluna, valor) {
    return this.planilha(nome, aba, 'read', { filtersUI: { values: [{ lookupColumn: coluna, lookupValue: valor }] }, options: {} }, { alwaysOutputData: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
  }
  lerTudo(nome, aba) { return this.planilha(nome, aba, 'read', { options: {} }, { alwaysOutputData: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 }); }
  upsert(nome, aba, chave) { return this.planilha(nome, aba, 'appendOrUpdate', { columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [chave], schema: [] }, options: {} }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 }); }
  append(nome, aba) { return this.planilha(nome, aba, 'append', { columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 }); }
  http(nome, metodo, url, { body, query, headers, auth, timeout = 30000, erro = 'continueErrorOutput', retry = true, extraParams = {} } = {}) {
    const p = { method: metodo, url, options: { timeout, response: { response: { fullResponse: false, neverError: false } } }, ...extraParams };
    if (auth === 'google') { p.authentication = 'predefinedCredentialType'; p.nodeCredentialType = 'googleCalendarOAuth2Api'; }
    if (auth === 'sheets') { p.authentication = 'predefinedCredentialType'; p.nodeCredentialType = 'googleSheetsOAuth2Api'; }
    if (headers) { p.sendHeaders = true; p.headerParameters = { parameters: Object.entries(headers).map(([name, value]) => ({ name, value })) }; }
    if (query) { p.sendQuery = true; p.queryParameters = { parameters: Object.entries(query).map(([name, value]) => ({ name, value })) }; }
    if (body !== undefined) { p.sendBody = true; p.specifyBody = 'json'; p.jsonBody = body; }
    const extra = { onError: erro };
    if (retry) Object.assign(extra, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
    if (auth === 'google') extra.credentials = { googleCalendarOAuth2Api: { id: '', name: 'Google Calendar - Vamos Sorrir' } };
    if (auth === 'sheets') extra.credentials = { googleSheetsOAuth2Api: { id: '', name: 'Google Sheets - Vamos Sorrir' } };
    return this.add(nome, 'n8n-nodes-base.httpRequest', 4.2, p, extra);
  }
  switch_(nome, expr, valores) {
    const rules = valores.map(v => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: uuid(nome + v), leftValue: expr, rightValue: v, operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: v }));
    return this.add(nome, 'n8n-nodes-base.switch', 3, { rules: { values: rules }, options: {} });
  }
  json() {
    return { name: this.nome, nodes: this.nodes, connections: this.conns, settings: this.settings, active: false, pinData: {}, meta: { templateCredsSetupCompleted: false } };
  }
}
module.exports = { WF, inlinar, uuid };
