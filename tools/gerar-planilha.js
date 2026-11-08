#!/usr/bin/env node
// Gera sheets/<aba>.csv com apenas o cabeçalho de cada aba (importe no Google Planilhas: uma aba por arquivo).
const fs = require('fs');
const path = require('path');
const { COLUNAS } = require('../lib/sheets');
const dir = path.join(__dirname, '..', 'sheets');
fs.mkdirSync(dir, { recursive: true });
for (const [aba, cols] of Object.entries(COLUNAS)) fs.writeFileSync(path.join(dir, aba + '.csv'), cols.join(',') + '\n');
console.log('Cabeçalhos gerados em sheets/:', Object.keys(COLUNAS).join(', '));
