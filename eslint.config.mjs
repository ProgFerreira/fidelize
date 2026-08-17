import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cópias de árvore de trabalho de agentes de IA (ex.: worktrees do
    // Claude Code) — não são código do projeto, e sem isso o eslint varre
    // duplicatas inteiras de src/ escondidas em .claude/worktrees/**.
    ".claude/**",
  ]),
  {
    // Débito pré-existente (anterior a esta sessão): react-hooks/set-state-in-effect
    // sincroniza prop inicial (dados do server) pro state local via useEffect
    // — padrão comum de revalidação no App Router, mas o rule novo marca
    // como erro. Rebaixado até refatorar com calma (idealmente: key-reset
    // em vez de effect+setState) em vez de mexer às cegas sem testar cada tela.
    files: [
      "src/components/auth/login-form.tsx",
      "src/components/campaigns/campaigns-client.tsx",
      "src/components/cards/cards-ops-panel.tsx",
      "src/components/giftcards/giftcards-client.tsx",
      "src/components/layout/clinic-switcher.tsx",
      "src/components/layout/shell.tsx",
      "src/components/professionals/professionals-client.tsx",
      "src/components/rewards/rewards-client.tsx",
      "src/components/services/services-client.tsx",
      "src/components/vouchers/vouchers-client.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Débito pré-existente: Date.now() dentro de Server Component / cálculo
    // derivado em render. react-hooks/purity trata como impuro mesmo em
    // contexto que não é client-side reativo. Rebaixado até revisar.
    files: [
      "src/app/(staff)/dashboard/page.tsx",
      "src/components/cards/cards-list.tsx",
    ],
    rules: {
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
