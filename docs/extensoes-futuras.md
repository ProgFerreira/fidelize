# Extensões implementadas (v2.1 — antigo §22)

Módulos e contratos abaixo estão **implementados**. Ative o módulo em `/modulos` e configure as variáveis de ambiente dos provedores.

## Provedores de comunicação

Adapters em `src/lib/providers` usados pela fila (`processCommunicationQueue`):

| Canal | Provedor real | Env |
|-------|---------------|-----|
| E-mail | Resend | `RESEND_API_KEY`, `EMAIL_FROM` |
| SMS | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| WhatsApp | Meta Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| Push | FCM legacy HTTP | `FCM_SERVER_KEY` |

Sem credenciais, o envio é **simulado** (status SENT + evento com `simulated: true`).

## Push nativo

- Tabela `PushDevice`, UI `/push`, registro `POST /api/v1/mobile/push/register`
- Módulo `PUSH`

## OCR de comprovantes / antifraude

- `src/lib/receipts`, UI `/comprovantes`
- OCR.space se `OCR_API_KEY`; senão heurística + revisão manual
- Flags: imagem duplicada, valor divergente, burst, alto valor
- Crédito via `creditWallet` com idempotency após aprovação

## Sorteios

- `src/lib/raffles`, UI `/sorteios`
- Bilhetes debitam pontos; sorteio com `crypto.randomInt`; prêmio auditado

## Inteligência preditiva

- `src/lib/predictive`, UI `/preditivo`
- Scores: `CHURN_RISK`, `LTV_ESTIMATE`, `ABANDON_RISK`
- Previsão de faturamento `moving_avg_trend`
- Cron recalcula scores quando o módulo está ativo

## Widget incorporável

- `GET /api/v1/widget`, embed `/embed/widget`
- Allowlist de origens em `/integracoes`
- Snippet iframe gerado na tela de integrações

## App white label

- Contrato: `src/lib/mobile/contract.ts`
- Rotas: `/api/v1/mobile/*` (OTP, home, push, receipts)
- Reutiliza portal `/p/*` e API `/api/v1/*`

## Domínio personalizado

- Continua via `Clinic.customDomain` / host middleware (já preparado no portal)
