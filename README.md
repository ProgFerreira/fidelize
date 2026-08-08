# Clube de Benefícios Clínica Dermaphios

Plataforma de fidelidade premium (cashback promocional, pontos, cartão digital/QR, campanhas e painel administrativo).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- MySQL 8+ / MariaDB (WAMP) + Prisma 7
- Auth.js (NextAuth) + RBAC
- Tailwind CSS 4 + componentes em `src/components/ui`
- Vitest (regras financeiras e concorrência)

## Setup local (WAMP)

1. Garanta MySQL/MariaDB ativos no WAMP.
2. Copie `.env.example` para `.env` (já existe `.env` de desenvolvimento).
3. Instale dependências e prepare o banco:

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

### Credenciais demo

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin | admin@dermaphios.com | Admin@123 |
| Gestor | gestor@dermaphios.com | Admin@123 |
| Recepção | recepcao@dermaphios.com | Admin@123 |
| Financeiro | financeiro@dermaphios.com | Admin@123 |

Portal do paciente: `/paciente` (telefone do seed + OTP simulado).

## v2 (módulos adicionais)

Após migrate/seed, o menu staff inclui módulos, segmentos, comunicações, automações, indicações, NPS, recompensas, vouchers, vales-presente, aceleradores, recuperação e integrações.

- Docs API: `docs/api-v1.md`
- Extensões futuras: `docs/extensoes-futuras.md`
- Cron v2: `POST /api/cron/v2` (header `x-cron-secret` em produção)

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` / `npm start` — produção
- `npm run db:seed` — dados fictícios
- `npm test` — testes unitários
- `npm run test:db` — testes de ledger/concorrência (`RUN_DB_TESTS=1`)

## Regras críticas

- Saldo nunca negativo; verdade no livro de transações + lotes (`CreditLot`)
- `DECIMAL(19,4)` — sem FLOAT
- Idempotência em créditos/resgates/pagamentos
- Percentuais e limites configuráveis em Configurações
- Isolamento por `clinicId`
