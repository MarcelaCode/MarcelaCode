#!/usr/bin/env node
// Gera workflows/*.json (importáveis no n8n) a partir de lib/, prompts/ e tools/def-*.js
const fs = require('fs');
const path = require('path');
const base = require('./def-base');
const rec = require('./def-recepcao');
const { wf03 } = require('./def-agente');
const { wf06 } = require('./def-consulta');

const todos = [
  ['01-recepcao-whatsapp', rec.wf01()], ['01b-processar-mensagem', rec.wf01b()], ['02-transcricao', base.wf02()], ['03-agente-claude', wf03()],
  ['04-triagem-encaminhamento', base.wf04()], ['05-consulta-agenda', base.wf05()], ['06-criacao-gestao-consulta', wf06()],
  ['07-registro-planilha', base.wf07()], ['08-resposta-whatsapp', base.wf08()], ['09-lembretes', rec.wf09()], ['09b-enviar-lembrete', rec.wf09b()],
  ['10-erros-manutencao', rec.wf10()],
];
const dir = path.join(__dirname, '..', 'workflows');
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
for (const [arq, w] of todos) fs.writeFileSync(path.join(dir, arq + '.json'), JSON.stringify({ ...w.json(), _id_logico: w.id }, null, 2) + '\n');
console.log(`${todos.length} workflows gerados em workflows/`);
