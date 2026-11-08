const { norm } = require('./util');

// Pré-filtro DETERMINÍSTICO de urgência. Roda antes do LLM como rede de segurança.
// Conservador de propósito: prefere falso positivo (encaminhar) a deixar passar urgência.
const EMERGENCIA = [
  /(nao consigo|dificuldade (de|para|pra|em)|dificil|custa (a|para|pra)|tenho problema (de|para|pra)|sem conseguir) (respirar|engolir)/,
  /falta de ar|sufoc|garganta (fechando|fechou)|nao (consigo|to conseguindo) (respirar|engolir)/,
];
const URGENTE = [
  ['dor_intensa', /dor (muito |bem |super )?(forte|intensa|insuportavel|terrivel|horrivel|latejante|que nao passa)|nao aguento (a )?dor|dor.{0,25}(nao consigo dormir|nao durmo|nao passa)|dor de dente (forte|insuportavel)|(muita|tanta) dor/],
  ['inchaco', /inchac|inchad|inchou|inchando|\bincho\b|bochecha (grande|enorme)|rosto (grande|deformad)/],
  ['sangramento', /sangr(a|ando|amento|ou)|sangue (na|da|pela|no) (boca|gengiva)|nao (para|parou) de sangrar/],
  ['traumatismo', /(caiu|caindo|quebrou|quebrei|saiu|trincou|lascou|perdi|soltou|deslocou).{0,25}(dente|dentes|obturacao|coroa)|(dente|dentes).{0,30}(quebr|caiu|caindo|saiu|trinc|lasc|mole|avuls|deslocou)|(quebrei|perdi|bati|machuquei).{0,20}(dente|boca)|pancada.{0,25}(boca|dente)|(acidente|queda).{0,30}(dente|boca)/],
  ['infeccao_suspeita', /\bpus\b|infec(cao|cionad)|abscesso|fistula|febre.{0,40}(dente|boca|gengiva|rosto)|(dente|boca|gengiva|rosto).{0,40}febre|gosto ruim.{0,20}(dente|gengiva)/],
];
function classificarUrgencia(texto) {
  const t = norm(texto);
  if (!t) return { nivel: 'NENHUM', sinais: [] };
  if (EMERGENCIA.some(r => r.test(t))) return { nivel: 'EMERGENCIA', sinais: ['respirar_engolir'] };
  const sinais = URGENTE.filter(([, r]) => r.test(t)).map(([k]) => k);
  return { nivel: sinais.length ? 'URGENTE' : 'NENHUM', sinais };
}
function querHumano(texto) {
  const t = norm(texto);
  return /(falar|conversar|atendimento|atendente|ser atendid[oa]|passa(r)?|me (transfere|passa)).{0,25}(com )?(uma |um |o |a )?(pessoa|humano|atendente|alguem|recepcionista|funcionari|gente de verdade|responsavel)|\b(atendente|humano)\b|nao quero (falar com )?(um )?(robo|bot|maquina)|pessoa de verdade/.test(t);
}
function direitosTitular(texto) {
  const t = norm(texto);
  return /(apagar|excluir|deletar|remover|eliminar).{0,20}(meus )?(dados|cadastro|informacoes)|(meus dados|dados que (voces )?(tem|guardam))|\blgpd\b|revogar (o )?consentimento|retirar (o )?consentimento|(copia|acesso) (dos|aos) (meus )?dados|portabilidade|titular de dados/.test(t);
}
module.exports = { classificarUrgencia, querHumano, direitosTitular };
