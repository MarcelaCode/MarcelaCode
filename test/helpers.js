const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'clinica.config.example.json'), 'utf8'));
// Config de teste: preenche os campos obrigatórios com valores FICTÍCIOS (somente em testes).
function cfgTeste() {
  const c = JSON.parse(JSON.stringify(cfg));
  c.clinica = { ...c.clinica, nome: 'Clínica Teste', endereco: 'Rua Teste, 1', telefone: '(00) 0000-0000', maps_link: 'https://maps.example/x' };
  c.privacidade = { politica_url: 'https://example.com/privacidade', contato_encarregado: 'dpo@example.com' };
  c.equipe = { whatsapp_alertas: '5500000000000' };
  c.agenda = { ...c.agenda, fuso_offset_minutos: -180, horario_funcionamento: { 1: [['08:00', '12:00'], ['14:00', '18:00']], 2: [['08:00', '12:00']], 3: [['08:00', '12:00']], 4: [['08:00', '12:00']], 5: [['08:00', '12:00']] }, orientacoes_consulta: 'Chegue 10 min antes.' };
  c.profissionais = [{ id: 'dr1', nome: 'Dra. Teste', calendar_id: 'cal1@example.com' }];
  c.servicos = [{ codigo: 'avaliacao', nome: 'Avaliação', duracao_min: 30, profissional_ids: ['dr1'], preco_texto: '' }, { codigo: 'ortodontia', nome: 'Ortodontia', agendavel_online: false }];
  return c;
}
module.exports = { cfgTeste };
