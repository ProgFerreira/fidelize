# API Fidelize v1 (OpenAPI resumido)

Base: `/api/v1`

Autenticação: header `x-api-key: fz_...`  
Idempotência (POST): header `Idempotency-Key` ou campo `idempotencyKey`.  
Rate limit: conforme `rateLimitRpm` da credencial (HTTP 429).

## Endpoints

### GET /api/v1/patients?q=

Lista pacientes da clínica da chave.

### POST /api/v1/appointments

Confirma atendimento e processa cashback/pontos.

```json
{
  "patientId": "...",
  "grossAmount": 500,
  "idempotencyKey": "unique-key",
  "procedureId": null,
  "campaignId": null,
  "benefitToUse": 0
}
```

### GET /api/v1/balance?patientId=

Retorna saldo, pontos e categoria.

### POST /api/v1/credits

Concede crédito/pontos com idempotência.

```json
{
  "patientId": "...",
  "amount": 10,
  "points": 50,
  "idempotencyKey": "credit-1",
  "reason": "Ajuste"
}
```

### GET /api/v1/vouchers?patientId=

Lista vouchers ativos (opcionalmente do paciente + públicos).

### GET /api/v1/referrals?patientId=

Lista indicações (como indicador ou indicado).

### GET /api/v1/nps?patientId=

Lista respostas NPS.

### GET /api/v1/widget

Snapshot read-only para widget (saldo/pontos/categoria).

- Auth: header `x-api-key` (não use `?key=` em novos clientes)
- Origem obrigatória na allowlist (`WidgetOrigin`)
- Embed HTML: `/embed/widget?clinic=SLUG&patientId=...` (sem API key na URL)

### Conectores clínicos

- `GET /api/v1/connectors/clinical` — catálogo Feegow / Clinicorp / genérico
- `POST /api/v1/connectors/clinical/appointments` — ingere atendimento e confirma fidelidade

### Mobile white-label `/api/v1/mobile/*`

- `GET /api/v1/mobile` — contrato v1.1
- `POST .../otp/request`, `.../otp/verify` → retorna `sessionToken` persistido
- Rotas do paciente exigem `x-api-key` + `x-session-token` (ou `Authorization: Bearer`)
- `POST .../push/register`, `.../home`, `.../receipts`

### WhatsApp inbound

- `GET|POST /api/webhooks/whatsapp` — verificação Meta + comando `saldo`

## Provedores

E-mail Resend, SMS Twilio, WhatsApp Meta, Push FCM HTTP v1 (`FCM_SERVICE_ACCOUNT_JSON`) — ver `.env.example`.

## LGPD

Portal do paciente (`/p/perfil`): exportação e anonimização do titular.

## Webhooks

Cadastre em `/integracoes`. Headers de entrega:

- `X-Fidelize-Timestamp`
- `X-Fidelize-Signature` = sha256(`timestamp.body.secret`)
- `X-Idempotency-Key`

Eventos iniciais: `appointment.confirmed`, `referral.converted`, `*`.

Reprocessamento: entregas `DEAD` podem ser recolocadas na fila (`reprocessDeadWebhooks`).

## Segurança

- Logs de integração redigem `token`, `password`, `secret`, `authorization`.
- Chaves podem ser rotacionadas (nova) e revogadas.
- Ambiente `test` vs `live` na credencial.
