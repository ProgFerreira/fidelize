export type DestinoLoginUser = {
  roleCode?: string | null;
  ehAdminPlataforma?: boolean;
  suporteAcessoId?: string | null;
};

export function destinoAposLogin(user?: DestinoLoginUser | null) {
  if (user?.roleCode === "AFFILIATE") return "/afiliado";
  if (user?.ehAdminPlataforma && !user.suporteAcessoId) return "/organizacoes";
  return "/dashboard";
}
