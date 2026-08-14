import type { PermissionCode } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { ModuleCode } from "@/generated/prisma/client";

export type MenuAreaId =
  | "frequentes"
  | "inicio"
  | "atendimento"
  | "clientes"
  | "cadastros"
  | "fidelidade"
  | "marketing"
  | "comunicacao"
  | "relatorios"
  | "configuracoes";

export type MenuAreaDef = {
  id: MenuAreaId;
  /** null = sem título de seção (ex.: Dashboard sozinho no topo) */
  label: string | null;
};

export type MenuDef = {
  id: string;
  label: string;
  rota: string;
  icone: string;
  area: MenuAreaId;
  permission?: PermissionCode;
  /** Se definido, o item só aparece com o módulo ativo */
  module?: ModuleCode;
};

export type MenuGrupo = {
  area: MenuAreaDef;
  items: MenuDef[];
};

export const MENU_AREAS: MenuAreaDef[] = [
  { id: "frequentes", label: "Frequentes" },
  { id: "inicio", label: null },
  { id: "atendimento", label: "Atendimento" },
  { id: "clientes", label: "Clientes" },
  { id: "cadastros", label: "Cadastros" },
  { id: "fidelidade", label: "Fidelidade" },
  { id: "marketing", label: "Marketing" },
  { id: "comunicacao", label: "Comunicação" },
  { id: "relatorios", label: "Relatórios" },
  { id: "configuracoes", label: "Configurações" },
];

export const MENUS: MenuDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    rota: "/dashboard",
    icone: "LayoutDashboard",
    area: "inicio",
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: "resumo-financeiro",
    label: "Resumo financeiro",
    rota: "/resumo-financeiro",
    icone: "TrendingUp",
    area: "relatorios",
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    id: "recepcao",
    label: "Recepção",
    rota: "/recepcao",
    icone: "ScanLine",
    area: "atendimento",
    permission: PERMISSIONS.RECEPTION_OPERATE,
  },
  {
    id: "extrato-dia",
    label: "Extrato",
    rota: "/extrato-dia",
    icone: "ClipboardList",
    area: "atendimento",
    permission: PERMISSIONS.RECEPTION_OPERATE,
  },
  {
    id: "agenda",
    label: "Agenda",
    rota: "/agenda",
    icone: "CalendarDays",
    area: "atendimento",
    permission: PERMISSIONS.AGENDA_MANAGE,
  },
  {
    id: "videochamadas",
    label: "Videochamadas",
    rota: "/videochamadas",
    icone: "Video",
    area: "atendimento",
    permission: PERMISSIONS.VIDEOCALLS_MANAGE,
    module: "VIDEOCALLS",
  },
  {
    id: "profissionais",
    label: "Profissionais",
    rota: "/profissionais",
    icone: "Stethoscope",
    area: "cadastros",
    permission: PERMISSIONS.PROFESSIONALS_MANAGE,
  },
  {
    id: "servicos",
    label: "Serviços",
    rota: "/servicos",
    icone: "ShoppingBag",
    area: "cadastros",
    permission: PERMISSIONS.SERVICES_MANAGE,
  },
  {
    id: "pacientes",
    label: "Pacientes",
    rota: "/pacientes",
    icone: "Users",
    area: "clientes",
    permission: PERMISSIONS.PATIENTS_READ,
  },
  {
    id: "cartoes",
    label: "Cartões",
    rota: "/cartoes",
    icone: "CreditCard",
    area: "clientes",
    permission: PERMISSIONS.CARDS_MANAGE,
  },
  {
    id: "consentimentos",
    label: "Consentimentos",
    rota: "/consentimentos",
    icone: "ShieldCheck",
    area: "clientes",
    permission: PERMISSIONS.CONSENT_MANAGE,
    module: "CONSENT",
  },
  {
    id: "recuperacao",
    label: "Recuperação",
    rota: "/recuperacao",
    icone: "UserRoundSearch",
    area: "clientes",
    permission: PERMISSIONS.RECOVERY_MANAGE,
    module: "AUTOMATIONS",
  },
  {
    id: "campanhas",
    label: "Campanhas",
    rota: "/campanhas",
    icone: "Megaphone",
    area: "marketing",
    permission: PERMISSIONS.CAMPAIGNS_MANAGE,
  },
  {
    id: "clube-vip",
    label: "Clube VIP",
    rota: "/clube-vip",
    icone: "Crown",
    area: "fidelidade",
    permission: PERMISSIONS.CARDS_MANAGE,
  },
  {
    id: "comissoes",
    label: "Comissões",
    rota: "/comissoes",
    icone: "Percent",
    area: "relatorios",
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    id: "recompensas",
    label: "Recompensas",
    rota: "/recompensas",
    icone: "Gift",
    area: "fidelidade",
    permission: PERMISSIONS.REWARDS_MANAGE,
    module: "REWARDS",
  },
  {
    id: "vouchers",
    label: "Vouchers",
    rota: "/vouchers",
    icone: "Ticket",
    area: "fidelidade",
    permission: PERMISSIONS.VOUCHERS_MANAGE,
    module: "VOUCHERS",
  },
  {
    id: "vales-presente",
    label: "Vales-presente",
    rota: "/vales-presente",
    icone: "WalletCards",
    area: "fidelidade",
    permission: PERMISSIONS.GIFTCARDS_MANAGE,
    module: "GIFT_CARD",
  },
  {
    id: "aceleradores",
    label: "Aceleradores",
    rota: "/aceleradores",
    icone: "Zap",
    area: "fidelidade",
    permission: PERMISSIONS.ACCELERATORS_MANAGE,
    module: "ACCELERATORS",
  },
  {
    id: "indicacoes",
    label: "Indicações",
    rota: "/indicacoes",
    icone: "Share2",
    area: "marketing",
    permission: PERMISSIONS.REFERRALS_MANAGE,
    module: "REFERRAL",
  },
  {
    id: "segmentos",
    label: "Segmentos",
    rota: "/segmentos",
    icone: "Filter",
    area: "comunicacao",
    permission: PERMISSIONS.SEGMENTS_MANAGE,
    module: "SEGMENTS",
  },
  {
    id: "templates",
    label: "Templates",
    rota: "/templates",
    icone: "FileText",
    area: "comunicacao",
    permission: PERMISSIONS.TEMPLATES_MANAGE,
    module: "COMMUNICATIONS",
  },
  {
    id: "comunicacoes",
    label: "Comunicações",
    rota: "/comunicacoes",
    icone: "MessageSquare",
    area: "comunicacao",
    permission: PERMISSIONS.COMMUNICATIONS_MANAGE,
    module: "COMMUNICATIONS",
  },
  {
    id: "automacoes",
    label: "Automações",
    rota: "/automacoes",
    icone: "Workflow",
    area: "comunicacao",
    permission: PERMISSIONS.AUTOMATIONS_MANAGE,
    module: "AUTOMATIONS",
  },
  {
    id: "nps",
    label: "NPS",
    rota: "/nps",
    icone: "Smile",
    area: "comunicacao",
    permission: PERMISSIONS.NPS_VIEW,
    module: "NPS",
  },
  {
    id: "sorteios",
    label: "Sorteios",
    rota: "/sorteios",
    icone: "Dices",
    area: "marketing",
    permission: PERMISSIONS.RAFFLES_MANAGE,
    module: "RAFFLES",
  },
  {
    id: "comprovantes",
    label: "Comprovantes",
    rota: "/comprovantes",
    icone: "Receipt",
    area: "atendimento",
    permission: PERMISSIONS.RECEIPTS_MANAGE,
    module: "RECEIPTS",
  },
  {
    id: "preditivo",
    label: "Preditivo",
    rota: "/preditivo",
    icone: "Brain",
    area: "relatorios",
    permission: PERMISSIONS.PREDICTIVE_VIEW,
    module: "PREDICTIVE",
  },
  {
    id: "push",
    label: "Push",
    rota: "/push",
    icone: "Bell",
    area: "comunicacao",
    permission: PERMISSIONS.PUSH_MANAGE,
    module: "PUSH",
  },
  {
    id: "relatorios",
    label: "Relatórios",
    rota: "/relatorios",
    icone: "BarChart3",
    area: "relatorios",
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    id: "loyalty360",
    label: "Loyalty 360",
    rota: "/loyalty360",
    icone: "Orbit",
    area: "relatorios",
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: "modulos",
    label: "Módulos",
    rota: "/modulos",
    icone: "Blocks",
    area: "configuracoes",
    permission: PERMISSIONS.MODULES_MANAGE,
  },
  {
    id: "planos",
    label: "Combos / Planos",
    rota: "/planos",
    icone: "Package",
    area: "configuracoes",
    permission: PERMISSIONS.MODULES_MANAGE,
  },
  {
    id: "implantacao",
    label: "Implantação",
    rota: "/implantacao",
    icone: "Rocket",
    area: "configuracoes",
    permission: PERMISSIONS.ONBOARDING_MANAGE,
  },
  {
    id: "integracoes",
    label: "Integrações",
    rota: "/integracoes",
    icone: "Plug",
    area: "configuracoes",
    permission: PERMISSIONS.INTEGRATIONS_MANAGE,
  },
  {
    id: "usuarios",
    label: "Usuários",
    rota: "/usuarios",
    icone: "UserCog",
    area: "configuracoes",
    permission: PERMISSIONS.USERS_MANAGE,
  },
  {
    id: "configuracoes",
    label: "Configurações",
    rota: "/configuracoes",
    icone: "Settings",
    area: "configuracoes",
    permission: PERMISSIONS.SETTINGS_MANAGE,
  },
  {
    id: "auditoria",
    label: "Auditoria",
    rota: "/auditoria",
    icone: "Shield",
    area: "configuracoes",
    permission: PERMISSIONS.AUDIT_VIEW,
  },
];

export function menusVisiveis(
  permissions: PermissionCode[],
  enabledModules?: Set<string> | string[],
): MenuDef[] {
  const modules = enabledModules
    ? enabledModules instanceof Set
      ? enabledModules
      : new Set(enabledModules)
    : null;

  return MENUS.filter((m) => {
    if (m.permission && !permissions.includes(m.permission)) return false;
    if (m.module && modules && !modules.has(m.module)) return false;
    return true;
  });
}

const FAVORITOS_POR_PAPEL: Record<string, string[]> = {
  RECEPTION: ["recepcao", "pacientes", "extrato-dia"],
  FINANCE: ["resumo-financeiro", "extrato-dia", "relatorios"],
  MANAGER: ["dashboard", "recepcao", "pacientes"],
  ADMIN: ["dashboard", "recepcao", "pacientes"],
};

const FAVORITOS_PADRAO = ["dashboard", "recepcao", "pacientes"];

/** Agrupa itens visíveis por área, omitindo áreas sem nenhum item. */
export function menusAgrupados(
  permissions: PermissionCode[],
  enabledModules?: Set<string> | string[],
  roleCode?: string,
): MenuGrupo[] {
  const items = menusVisiveis(permissions, enabledModules);
  const porArea = new Map<MenuAreaId, MenuDef[]>();

  const idsFavoritos = FAVORITOS_POR_PAPEL[roleCode ?? ""] ?? FAVORITOS_PADRAO;
  const frequentes = idsFavoritos
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is MenuDef => Boolean(item));
  const idsEmFrequentes = new Set(frequentes.map((item) => item.id));

  for (const item of items) {
    if (idsEmFrequentes.has(item.id)) continue;
    const lista = porArea.get(item.area) ?? [];
    lista.push(item);
    porArea.set(item.area, lista);
  }

  if (frequentes.length > 0) {
    porArea.set("frequentes", frequentes);
  }

  return MENU_AREAS.flatMap((area) => {
    const areaItems = porArea.get(area.id);
    if (!areaItems?.length) return [];
    return [{ area, items: areaItems }];
  });
}
