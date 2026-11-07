// Gera PDF de impressão (com sangria) e PNGs. Uso: node build.cjs [--limpo]
// Por padrão, campos provisórios aparecem com contorno vermelho tracejado (só nos PNGs de conferência).
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = __dirname, url = 'file://' + path.join(dir, 'cartao.html');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 363, height: 212 }, deviceScaleFactor: 8 });
  await p.goto(url); await p.evaluate(() => document.fonts.ready);
  // PDF e PNG de impressão: sem marcação de provisório
  await p.addStyleTag({ content: '.ph{outline:none!important}' });
  await p.pdf({ path: path.join(dir, 'cartao-impressao.pdf'), width: '96mm', height: '56mm', printBackground: true });
  for (const id of ['frente', 'verso']) {
    await p.evaluate((x) => document.querySelectorAll('.card').forEach((c) => (c.style.display = c.id === x ? 'block' : 'none')), id);
    await p.locator('#' + id).screenshot({ path: path.join(dir, `cartao-${id}.png`) });
  }
  await b.close();
})();
