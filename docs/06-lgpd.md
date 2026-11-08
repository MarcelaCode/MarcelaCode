# 6. Segurança e LGPD

> Este documento descreve controles **técnicos** do projeto. Não é parecer jurídico: bases legais, prazos e contratos devem ser validados pela clínica com assessoria jurídica/encarregado (DPO). Dados de saúde são **dados pessoais sensíveis** (LGPD art. 5º, II e art. 11).

## 6.1 Requisitos × implementação

| Requisito | Implementação | Situação |
|---|---|---|
| Transparência e consentimento | 1º contato: identifica-se como assistente virtual, explica uso dos dados, link da política, pede "sim". Sem "sim", não há atendimento automatizado (urgência/humano seguem). `consentimento_em` registrado | Implementado (texto a revisar pela clínica) |
| Minimização | Prompt e `propor_acao` só pedem nome completo, serviço, horário; motivo ≤ 120 caracteres; proibido pedir CPF/nascimento/convênio/detalhes clínicos | Implementado |
| Controle de acesso | Credenciais em variáveis de ambiente/cofre do n8n; planilha e agendas restritas; paciente só acessa consultas do **próprio telefone** (filtro no código) | Implementado + **[a configurar]** permissões Google/n8n |
| Segredos | Nenhum segredo no repositório/JSON (validador procura); `.env` no `.gitignore` | Implementado |
| Sem links públicos | Planilha/agenda privadas; localização enviada é da clínica | **[a configurar]** |
| Áudios e transcrições | Áudio só em memória do workflow 02 e **não é salvo** (execuções sem dados); transcrição só na sessão (retida conforme abaixo) | Implementado |
| Retenção/exclusão | Rotina diária (workflow 10, 3h): Sessões 7 dias, Fila 7, Lembretes 90, Erros 90, Auditoria 12 meses — **valores sugeridos** em `config.privacidade.retencao` | Implementado (prazos a validar) |
| Retenção de **Atendimentos** | Prazo configurável documentado, **sem rotina automática** | **Pendente** (decisão da clínica: guarda administrativa vs. apagamento) |
| Logs de operações | `Auditoria` (consulta criada/remarcada/cancelada, encaminhamento/triagem, lembretes), sem conteúdo de mensagem; telefone só em hash | Implementado (consentimento: ver nota) |
| Logs de erro sem PII | Mascaramento de telefone/e-mail/tokens | Implementado |
| Execuções do n8n | `saveData…: none` em todos os workflows | Implementado |
| Direitos do titular (acesso, correção, eliminação, revogação, portabilidade) | Detecção → encaminha à equipe (`direitos do titular`) com contato do encarregado; **sem automação** do atendimento ao direito | **Parcial**: ver runbook |
| Operadores e transferência internacional | Meta (WhatsApp), Google, Anthropic e provedor de transcrição tratam dados fora do Brasil | **Pendente**: contratos/DPAs, cláusulas e base legal pela clínica |
| Abuso/injeção | Delimitação de entrada do paciente, sanitização de tags, validação no código, guardrails de saída, `sanitizeCell` contra injeção de fórmulas | Implementado |

Nota: o evento de auditoria de *consentimento* ainda não é gravado separadamente (o `consentimento_em` vai para Atendimentos quando há atendimento). Se a clínica exigir trilha dedicada, adicionar chamada ao WF07 no WF03.

Observação: `Sessoes` guarda a conversa (pode conter dado de saúde) e `Fila_Entrada.texto` guarda o texto recebido, ambos por 7 dias (sugerido). Depois da expiração a sessão some e o consentimento é pedido de novo.

## 6.2 Runbook — atendimento a direitos do titular (manual)
1. Receber o alerta "direitos do titular" (WhatsApp da equipe) e confirmar a identidade do solicitante por canal seguro.
2. Localizar o titular por telefone nas abas `Atendimentos`, `Sessoes`, `Fila_Entrada` (pelo número) e `Lembretes`/`Auditoria` (pelo hash: `phoneHash` em `lib/util.js`), e nos eventos da Agenda (`extendedProperties.private.telefone`).
3. Acesso/portabilidade: exportar essas linhas. Correção: editar. Eliminação: apagar linhas/eventos (respeitando obrigações legais de guarda). Revogação: apagar a linha de `Sessoes` (o próximo contato pedirá novo consentimento).
4. Registrar a ação em `Auditoria` (evento `direito_titular_atendido`) e responder ao titular no prazo legal.

## 6.3 Pendências para a clínica decidir
Encarregado/DPO e canal de contato; política de privacidade publicada; base legal (consentimento × tutela da saúde) para cada tratamento; prazos finais de retenção; contratos com operadores; escolha do provedor de transcrição (região/ contrato); eventual RIPD (relatório de impacto).
