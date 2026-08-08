Framework Web:
- Next.js 16.2 LTS
- App Router
- Turbopack
- Server Components e Server Actions quando apropriado

Interface:
- React 19.2

Linguagem:
- TypeScript 5.9
- Modo strict habilitado

Runtime:
- Node.js 22 LTS

Autenticação:
- Auth.js/NextAuth em versão compatível com Next.js 16
- Credentials Provider para funcionários
- Sessões armazenadas no banco de dados
- Cookies HttpOnly, Secure e SameSite
- Controle de acesso por perfil e permissão
- MFA para administradores e financeiro
- Código temporário para acesso do paciente

Banco de dados:
- MySQL 8.4 LTS
- Engine InnoDB
- Charset utf8mb4
- Horários armazenados em UTC
- Valores monetários armazenados como DECIMAL, nunca FLOAT

ORM:
- Prisma ORM 7
- @prisma/client
- @prisma/adapter-mysql
- Driver MySQL compatível
- prisma.config.ts
- Migrations versionadas

CSS e UI:
- Tailwind CSS 4.3
- @tailwindcss/postcss
- Configuração CSS-first
- shadcn/ui ou Radix UI para componentes acessíveis
- Design responsivo e mobile-first

Ícones e utilitários:
- lucide-react
- clsx
- tailwind-merge
- class-variance-authority

Formulários e validação:
- react-hook-form
- @hookform/resolvers
- zod
- Validação no cliente e obrigatoriamente no servidor

Segurança de senhas:
- Argon2id como primeira opção
- bcrypt/bcryptjs como alternativa compatível
- Rate limiting e bloqueio progressivo de tentativas

Gráficos:
- Recharts

QR Code:
- Biblioteca para geração de QR Code no servidor
- Leitura pela câmera no navegador
- QR Code contendo somente identificador aleatório e seguro

Testes:
- Vitest
- React Testing Library
- Playwright
- Testes específicos para cashback, resgate, estorno e concorrência

Qualidade:
- ESLint com configuração flat ou Biome
- Prettier somente se ESLint/Biome não cuidar da formatação
- Verificação separada de lint, tipos, testes e build

Auditoria e observabilidade:
- Logs estruturados
- Registro imutável de operações
- Rastreamento de erros
- Histórico de login e alterações
- Monitoramento de tarefas de expiração

Processamento assíncrono:
- Redis e fila somente quando notificações e expirações justificarem
- Na primeira versão, tarefas agendadas idempotentes podem ser suficientes

Implantação:
- Aplicação Next.js executada em Node.js ou Docker
- MySQL gerenciado
- HTTPS obrigatório
- Backups automáticos
- Ambientes separados para desenvolvimento, homologação e produção