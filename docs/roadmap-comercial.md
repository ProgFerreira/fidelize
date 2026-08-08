# Prontidão comercial — FIDELIZE (Clube de Benefícios)

Análise baseada em leitura do código-fonte real (não da documentação de intenção).
Data: agosto de 2026.

---

## 1. Onde o produto está hoje

| Dimensão | Situação |
|---|---|
| Models Prisma | 68, em 34 enums |
| Páginas (`page.tsx`) | 44 |
| Linhas de código em `src/` | ~187.600 |
| Testes automatizados | 23 passando, 2 pulados |
| Migrations | 4, todas do mesmo dia (07/08/2026) |
| Controle de versão | **inexistente** — não é repositório git |

O volume é real: multi-tenant de dois níveis (Organização → Clínica → Unidade),
RBAC próprio, livro-razão de pontos com lotes e idempotência, motor de
automação versionado, segmentação dinâmica, NPS, indicação, recompensas,
vouchers, vale-presente, sorteios, scoring preditivo, OCR de comprovante,
push, widget embutido e API pública com webhooks assinados. A maior parte
disso **é lógica real**, não fachada — auditei módulo a módulo.

Mas "grande" e "pronto para vender" são coisas diferentes. Os itens abaixo
são o que separa um.

---

## 2. P0 — Bloqueadores: coisas que quebram em produção ou geram passivo jurídico

### 2.1 O teste que prova a garantia financeira central está quebrado

`validacoes.md`, a própria especificação do projeto, exige teste de
concorrência contra resgate duplicado como regra obrigatória. Esse teste
existe (`src/lib/ledger/ledger.test.ts`), está bem desenhado — dois resgates
simultâneos via `Promise.allSettled`, espera exatamente 1 sucesso e 1 falha —
mas:

1. **Não roda por padrão.** Só executa com `RUN_DB_TESTS=1`, que não está em
   nenhum script de CI ou `npm test`. Na prática, nunca rodou automaticamente.
2. **Quando rodei manualmente, falhou** — não por bug de concorrência, mas
   porque o arquivo de teste nunca foi atualizado depois do refactor
   multi-tenant. Ele chama `prisma.clinic.findFirst()` sem contexto de
   organização e a extensão de isolamento (corretamente) recusa a query:
   `SemContextoTenantError`.

A implementação do ledger em si parece correta — `SELECT ... FOR UPDATE`,
transação serializável no resgate, idempotência por chave. O problema é que
**isso não está mais sendo verificado**, e é justamente a característica que,
se falhar, deixa dois pacientes resgatarem o mesmo saldo. Corrigir o teste é
trivial (envolver o setup em `semOrganizacao()`); o risco real é vender
achando que essa garantia está provada quando ela não está.

### 2.2 Sem controle de versão

Não existe `.git` no projeto. Isso não é estilo — é risco operacional puro:
nenhum histórico de mudanças, nenhuma forma de reverter um deploy ruim,
nenhuma rastreabilidade de quem alterou o quê. Para um sistema que mexe com
saldo financeiro de pacientes, é inaceitável entrar em produção assim.
Resolve-se em minutos (`git init` + primeiro commit), mas precisa acontecer
**antes** de qualquer deploy real, não depois.

### 2.3 Widget embutido com checagem de origem desativada

`getWidgetPatientSnapshot()` valida a origem da requisição contra uma
allowlist — mas a própria página que renderiza o widget embutido
(`src/app/embed/widget/page.tsx`, linha 16) chama a função passando
`origin: null`, **desativando a checagem que existe no código**. Resultado:
qualquer site que tenha uma API key válida do cliente consegue embutir o
iframe e ver dados do paciente, sem checagem de origem HTTP. Não há
`Content-Security-Policy`, `frame-ancestors` nem `X-Frame-Options` no projeto
inteiro. A API key ainda vai na querystring do `src` do iframe, o que a expõe
em logs de servidor e em cabeçalhos de referrer.

Este é dado de paciente vazando por um caminho que parece protegido mas não
está. Corrigir antes de oferecer o widget a qualquer cliente.

### 2.4 Nenhuma rotina de exportação ou exclusão de dados pessoais

O sistema lida com **dado de saúde** — procedimentos clínicos vinculados a
CPF e telefone do paciente é dado pessoal sensível pela LGPD (art. 5º, II).
Os models de consentimento existem (`Consent`, `ConsentRecord`,
`CommunicationPreference`), o que é uma boa base — mas não encontrei nenhuma
rota que implemente os dois direitos mais básicos da lei: exportar os dados
de um titular e apagá-los mediante solicitação. Sem isso, o produto não pode
alegar conformidade com a LGPD, e uma clínica cliente pode ser autuada pela
ANPD por causa de uma lacuna do fornecedor da plataforma.

### 2.5 "Antifraude automático" está sempre neutralizado

Em `src/lib/receipts/index.ts`, o scoring de fraude é calculado de verdade
(imagem duplicada, valor divergente, rajada de uploads), mas a decisão final
tem este bug:

```ts
const status: ReceiptStatus =
  fraud.score >= 40 ? "NEEDS_REVIEW" : ocr.amount ? "NEEDS_REVIEW" : "NEEDS_REVIEW";
```

Os três ramos do ternário levam ao mesmo lugar — o score calculado nunca é
usado para aprovar automaticamente nada. Isso não é perigoso por si (é
seguro, tudo vai para revisão humana), mas **não é o que o produto anuncia**
vender. Ou implementa a aprovação automática de baixo risco, ou ajusta a
promessa comercial para "revisão assistida", não "antifraude automatizado".

---

## 3. P1 — Lacunas que travam a venda como SaaS de verdade

### 3.1 Não há cobrança da própria plataforma

`Organization.plan` é uma string livre (`"trial"`) sem tabela de faturas,
sem limite realmente aplicado, sem integração com gateway de pagamento para
cobrar a própria clínica pela assinatura. Hoje, ativar ou suspender um
cliente é uma operação manual. Isso trava crescer além de vendas
uma-a-uma acompanhadas de perto.

### 3.2 Comunicação 100% simulada sem configuração manual de credenciais

E-mail (Resend), SMS (Twilio), WhatsApp (Meta) e push (FCM) têm adapters
reais — mas nenhuma chave está configurada, e o modo simulado é o padrão.
Isso é aceitável em desenvolvimento, mas significa que **hoje, o produto não
envia uma única mensagem real** para nenhum paciente. Antes de qualquer
demonstração comercial ou piloto, alguém precisa provisionar essas contas.

### 3.3 Sessão do app mobile não é validada

O contrato do app white-label (`src/lib/mobile/contract.ts`) descreve
autenticação por `sessionToken` depois do OTP. Na implementação real
(`/api/v1/mobile/[[...path]]/route.ts`), esse token é gerado mas **nunca é
persistido nem checado em nenhuma outra rota** — todos os endpoints móveis
na prática dependem de `x-api-key` de clínica, não de sessão do paciente.
Se um app nativo for construído sobre esse contrato hoje, a autenticação de
usuário simplesmente não funciona como documentado.

### 3.4 Push cobre só Android/Web, e por uma API depreciada

A integração usa o endpoint legado `fcm.googleapis.com/fcm/send`, descontinuado
pelo Google desde 2024 (substituído pela HTTP v1 API). Não há qualquer
integração com APNs — push para iOS nativo não existe, nem simulado.

### 3.5 Sem observabilidade de produção

Nenhuma dependência de Sentry, Datadog, logging estruturado ou equivalente.
`AuditLog` existe no banco, mas isso é auditoria de negócio, não
monitoramento de erro em produção. Sem isso, um bug em produção só é
descoberto quando um cliente reclama.

### 3.6 Sem gateway de pagamento

Não há Stripe, Mercado Pago, PagSeguro, Asaas ou qualquer processador. O
`Payment` do sistema só registra o método como texto livre — é um
apontamento contábil do que já aconteceu na clínica, não um processamento de
pagamento de verdade. Isso pode ser intencional (a clínica cobra por fora),
mas precisa ser uma decisão explícita, não uma lacuna silenciosa — porque
`GiftCard` já modela crédito pré-pago, e vender crédito pré-pago sem
processar o pagamento de forma alguma é estranho.

---

## 4. P2 — Qualidade que preocupa numa venda séria

- **Typecheck falha** — 3 erros, todos por incompatibilidade `Decimal` do
  Prisma vs. tipo esperado em `AppointmentHistoryItem`. Não impede o build
  hoje, mas indica que `tsc --noEmit` não está no caminho crítico de nenhum
  pipeline.
- **5 erros de lint**, todos da mesma regra
  (`react-hooks/set-state-in-effect`) em 3 componentes — sintoma de padrão
  copiado sem ajuste, não de bugs isolados.
- **Cobertura de teste rasa para o tamanho do projeto.** 23 testes ativos
  para 68 models e ~188 mil linhas. Nenhum teste para os módulos avançados
  auditados (preditivo, OCR, sorteios, push, widget). Nenhum teste de
  componente React, nenhum E2E — apesar de Playwright e Testing Library
  estarem instalados.
- **Seed não cobre os módulos v2.1.** `Raffle`, `Receipt`, `PredictionScore`,
  `PushDevice`, `WidgetOrigin` — zero dados de demonstração. Uma demo
  comercial desses módulos exige montar dado na hora, ao vivo.

---

## 5. O que já está genuinamente pronto

Vale registrar, porque a auditoria foi cética e isso merece contexto:

- **Isolamento multi-tenant é sério.** `AsyncLocalStorage` com padrão
  fail-closed (`SemContextoTenantError` se faltar contexto), teste dedicado
  de isolamento (mesmo que hoje não rode contra o ledger).
- **O núcleo financeiro (ledger) é bem desenhado** — lock pessimista,
  transação serializável, idempotência por chave, nunca apaga transação
  (só estorna). É o tipo de decisão de arquitetura que é cara de refazer
  depois; aqui já está certa.
- **Sorteios usam RNG criptográfico real** (`crypto.randomInt`, não
  `Math.random`) — detalhe que muita gente erra e aqui está correto.
- **Webhooks de saída são genuinamente robustos** — assinatura HMAC, fila
  com retry e backoff, status `DEAD` após 5 tentativas, reprocessamento
  manual.
- **`docs/extensoes-futuras.md` é majoritariamente honesto** sobre o que é
  real e o que é simulado — só peca em não mencionar as duas lacunas de
  segurança (widget, sessão mobile).

---

## 6. Sequência sugerida

| Fase | Escopo | Por quê nesta ordem |
|---|---|---|
| **1** | `git init` + primeiro commit | Zero risco de fazer, altíssimo risco de não ter |
| **2** | Corrigir e ligar o teste de concorrência do ledger no CI | É a garantia financeira central; hoje é uma promessa não verificada |
| **3** | Corrigir o `origin: null` do widget + CSP básico | Vazamento de dado de paciente ativo, não hipotético |
| **4** | Rotas de exportação/exclusão de dados (LGPD) | Passivo jurídico direto para o cliente da plataforma |
| **5** | Decidir e corrigir a decisão automática de antifraude | Descompasso entre o que é vendido e o que o código faz |
| **6** | Provisionar credenciais reais de e-mail/SMS/WhatsApp | Sem isso não há piloto real, só demo |
| **7** | Modelo de cobrança da própria plataforma (billing SaaS) | Necessário para vender além de acompanhamento manual |
| **8** | Corrigir sessão mobile, migrar push para FCM HTTP v1 | Só urgente se um app nativo for construído em breve |
| **9** | Observabilidade de produção (Sentry ou equivalente) | Antes do primeiro cliente pagante em produção |
| **10** | Ampliar cobertura de teste (preditivo, OCR, sorteios, widget) | Reduz risco de regressão ao evoluir os módulos v2.1 |

---

## 7. Decisões que dependem de você

1. **Este é o mesmo código que vai para o primeiro cliente pagante, ou é
   protótipo para validar o conceito?** Muda a urgência das fases 1-4.
2. **Vai processar pagamento de verdade (assinatura da plataforma, ou
   crédito pré-pago do paciente) ou a cobrança sempre acontece fora do
   sistema?** Define se o item 3.6 é lacuna ou decisão válida.
3. **Existe plano de construir o app nativo mobile no curto prazo?** Se não,
   a fase 8 pode esperar; se sim, a autenticação por sessão precisa ser
   corrigida antes de qualquer app começar a ser codado sobre o contrato
   atual.
4. **Quem vai operar o suporte técnico quando o primeiro cliente reportar um
   problema?** Sem observabilidade (fase 9), a resposta hoje é "esperar o
   cliente descrever o que viu".
