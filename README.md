Olá, coders! Me chamo Marcela Neves e sou estudante de Analise e Desenvolvimento de Sistemas.

---

# Vamos Sorrir — Recepcionista virtual (WhatsApp + Claude + n8n)

Agente de atendimento 24h para a clínica odontológica **Vamos Sorrir**: recebe texto e áudio pelo WhatsApp Business Cloud API, faz triagem de urgência, consulta a agenda em tempo real, agenda/remarca/cancela com confirmação explícita, registra tudo no Google Planilhas e envia lembretes automáticos.

> ⚠️ **Estado do projeto: código e workflows gerados e testados *offline*; nada foi executado contra WhatsApp, Google, Anthropic ou uma instância n8n reais.** Leia [`docs/STATUS.md`](docs/STATUS.md) antes de colocar em produção.
> O PDF `fluxo_agente_clinica.pdf` citado no pedido **não estava no repositório**; o fluxo foi implementado a partir da descrição do pedido. Se o PDF tiver etapas diferentes, envie-o para conferência.

## Como o projeto está organizado

| Pasta | Conteúdo |
|---|---|
| `docs/` | Arquitetura, contratos, configuração/credenciais, erros e duplicidades, plano de testes, LGPD, **STATUS** |
| `config/clinica.config.example.json` | Todos os dados da clínica (endereço, profissionais, serviços, horários, preços…). Campos `__PREENCHER__` **bloqueiam** o atendimento: nada é inventado |
| `prompts/system_prompt.md` | Personalidade e regras invioláveis do agente |
| `lib/` | Lógica pura e testável (urgência, consentimento, slots, anti-duplicidade, guardrails, LGPD/retenção…) |
| `tools/` | Gerador dos workflows (`build-workflows.js`), validador estático, config→.env, cabeçalhos das planilhas, importador n8n |
| `workflows/` | 12 workflows n8n (JSON gerado — **edite `lib/`/`tools/` e rode `npm run build`**, não os JSON) |
| `sheets/` | Cabeçalhos CSV das 6 abas da planilha |
| `test/` | 41 testes (lógica + execução dos Code nodes gerados com n8n simulado) |

## Comandos

```bash
npm run build     # regenera workflows/*.json
npm run validate  # validação estática dos workflows (estrutura, ligações, sintaxe JS, segredos)
npm test          # 41 testes (Node ≥ 20, sem dependências externas)
npm run check     # os três acima
npm run env:config  # config/clinica.config.json -> linha CLINICA_CONFIG_JSON do .env
```

## Início rápido

1. Preencha `config/clinica.config.json` (copie do `.example`) e rode `npm run env:config`.
2. Siga [`docs/03-configuracao.md`](docs/03-configuracao.md): Meta (WhatsApp + 2 templates), Google (Agenda/Planilhas), chaves, import dos workflows, ordem de ativação.
3. Execute o plano de [`docs/05-plano-de-testes.md`](docs/05-plano-de-testes.md) com um número de teste **antes** de atender pacientes.
