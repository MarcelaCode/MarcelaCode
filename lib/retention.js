// Linhas expiradas, em ordem DECRESCENTE de número de linha (para exclusão em lote sem deslocar índices).
function expiradas(linhas, campoData, dias, agoraMs) {
  const lim = agoraMs - dias * 86400000;
  return linhas.filter(r => { const t = Date.parse(r[campoData]); return !Number.isNaN(t) && t < lim; })
    .map(r => r.row_number).sort((a, b) => b - a);
}
// Monta batchUpdate da Sheets API (deleteDimension). row_number é 1-based, incluindo cabeçalho.
function pedidosExclusao(sheetGid, rowNumbers) {
  return rowNumbers.map(n => ({ deleteDimension: { range: { sheetId: sheetGid, dimension: 'ROWS', startIndex: n - 1, endIndex: n } } }));
}
module.exports = { expiradas, pedidosExclusao };
