# 4. Tratamento de erros e duplicidades

## 4.1 Exceções pedidas × tratamento implementado

| Situação | Tratamento | Onde |
|---|---|---|
| Falha na conexão com o WhatsApp (envio) | HTTP com 3 tentativas; resultado `ok:false` → **não salva a sessão** e a mensagem vai para `ERRO_RETRY` (reprocessada em 1, 5, 15 min; depois `ESGOTADO` → humano) | 08, 01b, 10 |
| Erro na API do Claude | Retentativa só para erros retentáveis (rede/408/409/425/429/5xx) com backoff 2s/4s; `refusal`/`max_tokens` vazio/falha → mensagem ao paciente + **encaminhamento humano** + alerta | 03 (`Chamar Claude`) |
| Google Agenda indisponível | `agenda_indisponivel` ao modelo → paciente informado + oferta de humano; **nada é confirmado** | 05, 06 |
| Falha ao registrar na planilha | Consulta **já criada na agenda** (fonte da verdade) é confirmada ao paciente (é verdade); resultado `registro_planilha_ok:false`; erro em `Erros` + alerta. Lembretes usam a agenda, não a planilha | 06, 07, 10 |
| Áudio ruim | Avaliação (`vazio`, `sem_fala`, `baixa_confianca`) → pede para reenviar/escrever; não segue com texto duvidoso | 02, 01b |
| Quer falar com pessoa | Detecção determinística + ferramenta `encaminhar_humano` → status "Encaminhado…", alerta à equipe | 03, 04 |
| Informações incompletas | Prompt pede um dado por vez; `propor_acao` falha com `nome_completo_necessario`, `servico_invalido`, `slot_nao_oferecido` | 03 |
| Agendamentos simultâneos | ID determinístico (409), `If-Match` ao reativar, `freeBusy` antes de criar → `horario_indisponivel` e novas opções | 06 |
| Falha ao criar evento | Nunca informa confirmação; resultado `ok:false` → modelo explica e oferece alternativa | 06, guardrails |
| Config incompleta | Aviso genérico ao paciente + `Stop and Error` → alerta à equipe | 03 |
| Qualquer falha de workflow | Error Trigger → grava em `Erros` (**sem conteúdo de mensagens**, com telefone/e-mail/tokens mascarados) → alerta por template com *throttle* de 15 min por tipo de erro | 10 |

Logs: `Erros` (falhas), `Auditoria` (operações relevantes, sem conteúdo clínico), `Fila_Entrada` (estado de cada mensagem), `Lembretes` (cada envio). Execuções do n8n **não salvam dados** (LGPD); para depurar, habilite temporariamente "Save successful executions" no workflow e desabilite depois.

## 4.2 Duplicidades

| Risco | Controle |
|---|---|
| Meta reenvia o mesmo webhook | `wamid` único em `Fila_Entrada` (upsert por `wamid`); duplicada é ignorada |
| Resposta atrasada do webhook | Resposta 200 é enviada **antes** do processamento |
| Linha duplicada em Atendimentos | `id_atendimento` determinístico por conversa + upsert; novo ID após cada agendamento concluído. Status só avança por transições válidas (`Cancelado` não volta a `Agendado` por mensagem atrasada) |
| Evento duplicado na agenda | ID do evento = hash(profissional, horário). Reenvio do mesmo paciente → idempotente; outro paciente → bloqueado |
| Lembrete duplicado | Chave `evento:D-1` em `Lembretes`. Fluxo: **reserva (`ENVIANDO`) antes de enviar** → envia → `ENVIADO`/`FALHOU`. Reserva que falhou ⇒ não envia. `ENVIANDO` antigo (>30 min) ⇒ **não reenvia** (pode ter saído) e fica para revisão. `FALHOU` reenvia até 3 vezes (execução das 12h) |
| Planilha × agenda divergentes | Agenda é a fonte da verdade; planilha é gravada logo após o evento; falha gera alerta. *Rotina automática de reconciliação: não implementada* (ver STATUS) |

## 4.3 Retentativa controlada
`lib/retry.js`: só erros retentáveis; máx. 3 tentativas por mensagem; backoff 1/5/15 min; esgotou → encaminha para humano e avisa o paciente. Nada de loop infinito (loop do agente limitado a 6 ferramentas por mensagem).
