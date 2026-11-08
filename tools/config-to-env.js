#!/usr/bin/env node
// Lê config/clinica.config.json, valida e imprime a linha CLINICA_CONFIG_JSON para o .env
const fs = require('fs');
const path = require('path');
const { validarConfig } = require('../lib/config');
const arq = path.join(__dirname, '..', 'config', 'clinica.config.json');
if (!fs.existsSync(arq)) { console.error('Crie config/clinica.config.json a partir de clinica.config.example.json'); process.exit(1); }
const limpar = o => Array.isArray(o) ? o.map(limpar) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, limpar(v)])) : o;
const cfg = limpar(JSON.parse(fs.readFileSync(arq, 'utf8')));
const v = validarConfig(cfg);
if (!v.ok) { console.error('Campos pendentes (o agente NÃO atenderá até preencher):\n- ' + v.faltando.join('\n- ')); process.exitCode = 2; }
console.log(`CLINICA_CONFIG_JSON='${JSON.stringify(cfg).replace(/'/g, "'\\''")}'`);
