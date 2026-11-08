# Status: o que existe, o que depende de credenciais, o que falta

Legenda: ✅ implementado e testado offline · 🧪 implementado, **não** validado no sistema real · 🔑 depende de credenciais/contas da clínica · ⛔ não implementado

## Implementado e testado offline (`npm test` = 41 testes; `npm run validate`)
- ✅ Lógica de negócio em `lib/`: urgência, pedido de humano, direitos do titular, consentimento, confirmação explícita, cálculo de horários, anti-duplicidade/ID determinístico, validação de proposta/execução, guardrails de saída, janela de 24h, retentativa, retenção, sanitização de erros, sessão em partes.
- ✅ Os **Code nodes gerados** rodam nos cenários críticos com n8n simulado (consentimento, prioridade de urgência, ciclo de ferramentas, propriedade de consulta por telefone, dedupe, lembretes…).
- ✅ Validação estática dos 12 workflows (216 nós): ligações, saídas de erro tratadas, JS compilável, sem segredos, execuções sem dados salvos.
- ✅ Configuração sem dados inventados: `__PREENCHER__` bloqueia o atendimento (verificado em teste).

## 🧪 Escrito, mas nunca executado no sistema real (risco de ajuste fino)
Não havia n8n, WhatsApp, Google nem Anthropic disponíveis no ambiente de desenvolvimento. Pontos que **provavelmente** exigirão pequenos ajustes na primeira importação:
- Formato exato dos parâmetros de nós n8n (IF v2, Switch v3, Google Sheets v4.5, Execute Workflow `mode: each`, `rawBody` do webhook → binário `data`, campo `row_number`). Se algum nó aparecer como "inválido", reabra-o no editor e salve.
- Chamada à Anthropic: cabeçalho/corpo `server-side-fallback-2026-07-01` + `fallbacks:"default"` e `output_config.effort` foram escritos a partir da documentação de referência disponível; se a API recusar (HTTP 400), remova essas duas linhas em `lib/claude.js` / `tools/def-agente.js` e rode `npm run build`.
- Chamadas ao Google Calendar (`freeBusy`, `If-Match` no PUT, ID customizado), Sheets `batchUpdate` e `tools/import-n8n.js`.
- Heurísticas de urgência/consentimento/confirmação são por regras: revise com a equipe da clínica e amplie `lib/triage.js` com frases reais (a política é conservadora: prefere encaminhar a deixar passar).

## 🔑 Depende de credenciais/configuração da clínica
Veja `docs/03-configuracao.md`: dados da clínica (`config/clinica.config.json`), app WhatsApp Business + **2 modelos aprovados pela Meta**, OAuth Google (Agenda/Planilhas), planilha com as 6 abas e gids, chave Anthropic, serviço de transcrição, número da equipe para alertas, política de privacidade e encarregado.

## ⛔ Não implementado / limitações conhecidas
1. **Concorrência por paciente:** duas mensagens quase simultâneas do mesmo número leem a mesma sessão e a última a gravar vence (pode perder um turno). Mitigações possíveis: fila por telefone, lock em Postgres/Redis. A criação de eventos continua segura (ID determinístico).
2. **Sessões no Google Planilhas** (por exigência da stack): limite ~180 mil caracteres por conversa (então reinicia com resumo), latência e cotas da API. Para volume maior, trocar por Postgres/Redis.
3. **Reconciliação automática agenda × planilha:** só há alerta quando o registro falha; não há varredura periódica.
4. **Direitos do titular:** só encaminhamento + runbook manual (`docs/06-lgpd.md`); sem exclusão automatizada por titular.
5. **Retenção de `Atendimentos`:** prazo documentado, sem rotina de exclusão (decisão da clínica).
6. **Auditoria de consentimento** em aba própria: apenas `consentimento_em`.
7. **Retentativa de áudio:** áudios que falham não são reprocessados (paciente é orientado a reenviar).
8. Fuso horário **fixo** (`fuso_offset_minutos`, -180 para Brasília); feriados são lista manual na config.
9. Uma ferramenta por rodada do modelo (simplicidade/estado); mais iterações por atendimento.
10. Um profissional por consulta; sem convênios, orçamentos, pagamentos nem envio de arquivos.
11. Modelo de IA em `ANTHROPIC_MODEL` (padrão do projeto: `claude-opus-5-5`; `claude-sonnet-5-5` é mais barato) — decisão de custo/qualidade da clínica; não foi avaliado com conversas reais. Recomenda-se montar um conjunto de conversas de teste antes de produção.
12. O PDF `fluxo_agente_clinica.pdf` não estava no repositório: conferir o fluxo implementado contra ele.
