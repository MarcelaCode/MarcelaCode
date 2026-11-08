# 3. Credenciais, configuração e instalação

> Marcado como **[a configurar]** tudo que depende de contas/credenciais da clínica. Nada disso existe no repositório.

## 3.1 O que você precisa ter

| Item | Para quê | Observação |
|---|---|---|
| n8n ≥ 1.100 (self-hosted ou cloud) | Orquestração | Variáveis: `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, `NODE_FUNCTION_ALLOW_BUILTIN=crypto`. Instância com HTTPS público |
| Meta Business + app WhatsApp Business Cloud API | Canal oficial | Número, `Phone Number ID`, token de **usuário do sistema** (permanente), `App Secret`, webhook |
| Conta Google da clínica | Agenda e Planilhas | OAuth2 no n8n (escopos Calendar e Sheets). Use conta/serviço **da clínica**, não pessoal |
| Chave Anthropic | Claude | `ANTHROPIC_API_KEY`; escolha do modelo em `ANTHROPIC_MODEL` |
| Serviço de transcrição | Áudio → texto | Qualquer API compatível com `/v1/audio/transcriptions` (padrão `whisper-1`). **Escolha da clínica** (ver LGPD: transferência internacional) |

## 3.2 Passo a passo

1. **Dados da clínica.** `cp config/clinica.config.example.json config/clinica.config.json`; preencha tudo que for `__PREENCHER__` (endereço, telefone, link do Maps, horários, profissionais com `calendar_id`, serviços com duração/profissionais, preços *se* a clínica quiser que o agente informe, número da equipe para alertas, URL da política de privacidade, contato do encarregado). Remova serviços que a clínica **não** oferece. Rode `npm run env:config` e cole a linha no `.env`/variáveis do n8n.
2. **Google.**
   - Crie uma **agenda por profissional** (ou use as existentes) e anote o ID (`…@group.calendar.google.com`) → `profissionais[].calendar_id`.
   - Crie a planilha *Vamos Sorrir – Atendimentos* **restrita** (compartilhe só com a clínica/conta do n8n; **nunca** "qualquer pessoa com o link"). Importe os CSVs de `sheets/` — **uma aba por arquivo, com o nome exato** (`Atendimentos`, `Sessoes`, `Fila_Entrada`, `Lembretes`, `Erros`, `Auditoria`).
   - Anote `SHEETS_ID` e o `gid` de cada aba (`SHEET_GID_*`).
   - No n8n crie as credenciais **Google Sheets OAuth2** (`Google Sheets - Vamos Sorrir`) e **Google Calendar OAuth2** (`Google Calendar - Vamos Sorrir`).
3. **Meta/WhatsApp.**
   - Configure o webhook para `https://<seu-n8n>/webhook/whatsapp-vamos-sorrir` com seu `WHATSAPP_VERIFY_TOKEN`; assine o campo `messages`.
   - **Crie e submeta à aprovação os 2 modelos** (categoria *Utility*, idioma `pt_BR`):
     - `lembrete_consulta_v1` — corpo: `Olá, {{1}}! 😊\n\nPassando para lembrar que você tem uma consulta agendada na {{4}} amanhã!\n\n📅 Data: {{2}}\n⏰ Horário: {{3}}\n\nPodemos confirmar sua presença?` + botões de resposta rápida *Confirmar*, *Remarcar*, *Cancelar*.
     - `alerta_equipe_v1` — corpo: `⚠️ Vamos Sorrir – {{1}}\nPaciente: {{2}} ({{3}})\nDetalhe: {{4}}\nAbra o WhatsApp Business para continuar o atendimento.`
     - Os nomes devem coincidir com `whatsapp.templates` na config. Sem aprovação, lembretes e alertas **não são entregues** fora da janela de 24h.
   - O número da equipe (`equipe.whatsapp_alertas`) precisa poder receber mensagens da Meta (templates).
4. **Importar workflows.** Manual: importe cada `workflows/*.json` no n8n; em cada nó *Execute Workflow* selecione o workflow correspondente (placeholders `__WF:xx__`) e em *Settings → Error workflow* selecione o 10. Ou use `N8N_API_URL=… N8N_API_KEY=… node tools/import-n8n.js` (**não testado**; revise).
5. **Credenciais nos nós.** Em cada nó Google Sheets / Calendar (HTTP) selecione as credenciais criadas no passo 2.
6. **Variáveis** (`.env.example`): preencha tokens e chaves **como variáveis de ambiente do n8n** (nunca em nós/JSON/Git).
7. **Ativar** nesta ordem: 10, 08, 07, 06, 05, 04, 02, 03, 01b, 01, 09b, 09. Teste com `docs/05-plano-de-testes.md`.

## 3.3 Mapa de credenciais e escopo mínimo

| Segredo | Onde fica | Quem acessa |
|---|---|---|
| `ANTHROPIC_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `TRANSCRIBE_API_KEY` | Variáveis de ambiente do servidor n8n | Administrador da clínica/infra |
| OAuth Google | Cofre de credenciais do n8n | Só o dono da instância; escopos mínimos (Calendar eventos, Sheets) |
| Config da clínica | `CLINICA_CONFIG_JSON` (sem segredos) | — |

Boas práticas: contas **da clínica** (não de terceiros/dev), 2FA, rotação periódica de tokens, usuário do n8n por pessoa, backup do n8n cifrado, limitar quem edita workflows.
