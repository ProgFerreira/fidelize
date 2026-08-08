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

### GET /api/v1/widget?key=&patientId=&phone=

Snapshot read-only para widget (saldo/pontos/categoria). Respeita allowlist de origem.

### Mobile white-label `/api/v1/mobile/*`

- `GET /api/v1/mobile` — contrato
- `POST .../otp/request`, `.../otp/verify`
- `POST .../push/register`
- `POST .../home`, `.../receipts`

## Provedores

E-mail Resend, SMS Twilio, WhatsApp Meta, Push FCM — ver `.env.example` e `docs/extensoes-futuras.md`.

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
