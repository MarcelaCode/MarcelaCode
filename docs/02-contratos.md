# 2. Contratos de comunicação

Convenções: campos em português; todo sub-workflow tem gatilho `Entrada` (passthrough) e **devolve `_ctx` exatamente como recebeu** (contexto opaco do chamador). Resultados de ferramentas são objetos planos `{ ok, erro?, ... }`.

## Entre serviços externos

| Origem → Destino | Contrato |
|---|---|
| Meta → 01 | `GET` `hub.mode/verify_token/challenge`; `POST` payload Cloud API com `X-Hub-Signature-256` (HMAC-SHA256 do corpo bruto com o *App Secret*). Resposta `200 EVENT_RECEIVED` imediata |
| 08 → Meta | `POST /{ver}/{phone_number_id}/messages` tipos `text`, `location`, `template` (idioma `pt_BR`). Texto/localização só dentro de 24h da última mensagem do paciente |
| 03 → Anthropic | `POST /v1/messages`: `system` (com `cache_control`), `tools` (9), `tool_choice: auto` + `disable_parallel_tool_use`, `output_config.effort`, sem `temperature`/`thinking.budget`. Headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-beta: server-side-fallback-2026-07-01` (+ `fallbacks: "default"`) |
| 02 → Transcrição | `POST` multipart (`file`, `model`, `language=pt`, `response_format=verbose_json`) → `{ text, segments[{avg_logprob,no_speech_prob}] }` |
| 05/06/09 → Google Calendar | `freeBusy`, `events.list` (filtro `privateExtendedProperty=telefone=…`), `events.get/insert/update/patch/delete` |

## Entre workflows

**01 → 01b** `{ mensagem:{wamid, telefone, nome_contato, timestamp, tipo, tipo_logico:'texto'|'audio'|'nao_suportado', texto, media_id}, retry:false }`

**01b → 02** `{ media_id, _ctx }` → `{ ok:true, texto } | { ok:false, motivo:'vazio'|'sem_fala'|'baixa_confianca'|'falha_servico'|'transcricao_nao_configurada' }`

**01b → 03** `{ telefone, nome_contato, texto, origem:'texto'|'audio', wamid, timestamp }` → `{ ok:boolean, erro? }` (`ok:false` ⇒ fila marca `ERRO_RETRY`)

**03 → 05** `{ servico_codigo, periodo?, data_minima?, profissional_id?, urgencia, _ctx }` → `{ ok:true, total_livres, slots:[{slot_id, profissional_id, profissional_nome, rotulo, inicio, fim, inicio_ms}], _ctx } | { ok:false, erro:'agenda_indisponivel'|'servico_invalido'|'profissional_invalido' }`

**03 → 06** `{ op:'listar'|'confirmar_presenca'|'executar', telefone, [acao:'agendar'|'remarcar'|'cancelar', atendimento_id, nome, servico_codigo, slot, evento_id_atual, motivo_texto], _ctx }` → `{ ok:true, acao, evento_id?, mensagens_fixas?, registro_planilha_ok } | { ok:false, erro:'horario_indisponivel'|'agenda_indisponivel'|'consulta_nao_encontrada'|'dados_invalidos' }`

**03 → 04** `{ nivel:'EMERGENCIA'|'URGENTE'|'HUMANO', sinais[], motivo?, telefone, atendimento_id, nome, _ctx }` → `{ ok:true, alertado:boolean, _ctx }`

**→ 07** `{ op:'upsert_atendimento', dados:{id_atendimento, …colunas parciais} }` | `{ op:'lembrete', dados:{chave, status, tentativas, …, novo?} }` | `{ op:'auditoria', dados:{evento, telefone_hash?, referencia?, detalhe?} }` → `{ ok, _ctx }`

**→ 08** `{ telefone, ultimo_inbound_em|null, itens:[{tipo:'texto',texto}|{tipo:'localizacao',localizacao}|{tipo:'template',template:{nome,idioma,parametros[]}}], _ctx }` → `{ ok, wamids[], erro?, _ctx }`

## Ferramentas expostas ao Claude

`consultar_info_clinica`, `salvar_dados_paciente`, `consultar_agenda`, `listar_minhas_consultas`, `propor_acao`, `executar_acao_confirmada`, `confirmar_presenca`, `registrar_triagem_urgencia`, `encaminhar_humano` (esquemas em `lib/claude.js`). Argumentos são **validados no código**; o modelo nunca fornece telefone (vem da sessão) nem ID de evento de terceiros (só enxerga eventos do próprio telefone).

## Estado da conversa (`Sessoes`)
`{ telefone, conversa_id, atendimento_id, consentimento, turno, paciente{nome,servico_codigo,motivo_texto}, slots_oferecidos[], pendente{acao,slot,proposto_no_turno,proposto_em}, urgencia, escalado, mensagens[] }` serializado em `estado_1..4`.

## Planilha (abas e colunas)
Definidas em `lib/sheets.js` (`COLUNAS`) e exportadas para `sheets/*.csv`. Status válidos: Novo contato, Em atendimento, Aguardando confirmação, Agendado, Remarcado, Cancelado, Concluído, Encaminhado para atendimento humano (com tabela de transições). Extras além do sugerido: `evento_id`, `presenca_confirmada`, `consentimento_em`.
