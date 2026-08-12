"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Campo,
  Card,
  EmptyState,
  Input,
  Select,
  toast,
} from "@/components/ui";
import {
  createStaffUserAction,
  resetStaffUserPasswordAction,
  setStaffUserStatusAction,
  updateStaffUserAction,
} from "@/app/user-actions";
import type { StaffRoleOption, StaffUnitOption, StaffUserDTO } from "@/lib/users/types";
import type { PermissionCode } from "@/lib/auth/permissions";
import { labelPt } from "@/lib/i18n/labels";
import {
  Eye,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Power,
  ShieldAlert,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

type RolePermission = { code: PermissionCode; label: string };

type Props = {
  currentUserId: string;
  initialUsers: StaffUserDTO[];
  roles: StaffRoleOption[];
  units: StaffUnitOption[];
  rolePermissions: Record<string, RolePermission[]>;
};

type Draft = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  roleCode: string;
  unitId: string;
  status: UserStatus;
};

type Credencial = { email: string; senhaProvisoria: string };

function emptyDraft(roles: StaffRoleOption[]): Draft {
  return {
    name: "",
    email: "",
    phone: "",
    roleCode: roles[0]?.code ?? "RECEPTION",
    unitId: "",
    status: "ACTIVE",
  };
}

function fromUser(user: StaffUserDTO): Draft {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    roleCode: user.roleCode,
    unitId: user.unitId ?? "",
    status: user.status,
  };
}

function statusTone(status: UserStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "BLOCKED") return "danger" as const;
  return "muted" as const;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function formatLogin(iso: string | null) {
  if (!iso) return "Nunca acessou";
  return new Date(iso).toLocaleString("pt-BR");
}

export function UsersClient({
  currentUserId,
  initialUsers,
  roles,
  units,
  rolePermissions,
}: Props) {
  const [items, setItems] = React.useState(initialUsers);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [viewing, setViewing] = React.useState<StaffUserDTO | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [credencial, setCredencial] = React.useState<Credencial | null>(null);

  React.useEffect(() => {
    setItems(initialUsers);
  }, [initialUsers]);

  const ativos = items.filter((u) => u.status === "ACTIVE").length;
  const bloqueados = items.filter((u) => u.status === "BLOCKED").length;

  async function copiarSenha(senha: string) {
    try {
      await navigator.clipboard.writeText(senha);
      toast.success("Senha copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("roleCode", draft.roleCode);
    fd.set("unitId", draft.unitId);
    fd.set("status", draft.status);
    try {
      if (draft.id) {
        const res = await updateStaffUserAction(draft.id, fd);
        setItems((prev) =>
          prev.map((u) => (u.id === res.user.id ? res.user : u)),
        );
        toast.success("Usuário atualizado");
      } else {
        const res = await createStaffUserAction(fd);
        setItems((prev) =>
          [...prev, res.user].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        );
        setCredencial({
          email: res.user.email,
          senhaProvisoria: res.senhaProvisoria,
        });
        toast.success("Usuário cadastrado");
      }
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onStatus(id: string, status: UserStatus) {
    try {
      const res = await setStaffUserStatusAction(id, status);
      setItems((prev) =>
        prev.map((u) => (u.id === res.user.id ? res.user : u)),
      );
      toast.success(`Status alterado para ${labelPt(status)}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao alterar status",
      );
    }
  }

  async function onResetPassword(id: string) {
    try {
      const res = await resetStaffUserPasswordAction(id);
      setCredencial({
        email: res.email,
        senhaProvisoria: res.senhaProvisoria,
      });
      toast.success("Nova senha provisória gerada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao redefinir senha",
      );
    }
  }

  const permsDoPerfil = draft
    ? (rolePermissions[draft.roleCode] ?? [])
    : [];

  return (
    <div className="space-y-6">
      <div className="patients-stats">
        <div className="patients-stat">
          <div className="patients-stat__icon">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Equipe</p>
            <p className="patients-stat__value">{items.length}</p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--green">
            <UserCheck className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Ativos</p>
            <p className="patients-stat__value">{ativos}</p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--danger">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Bloqueados</p>
            <p className="patients-stat__value">{bloqueados}</p>
          </div>
        </div>
      </div>

      {credencial ? (
        <Card className="users-cred">
          <p className="users-cred__title">Senha provisória</p>
          <p className="users-cred__text">
            Entregue estes dados uma vez. E-mail{" "}
            <strong>{credencial.email}</strong> · senha{" "}
            <strong>{credencial.senhaProvisoria}</strong>
          </p>
          <div className="users-cred__acoes">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void copiarSenha(credencial.senhaProvisoria)}
            >
              Copiar senha
            </Button>
            <Button
              type="button"
              size="sm"
              variant="contorno"
              onClick={() => setCredencial(null)}
            >
              Ok, anotei
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Perfis: Administrador, Gestor, Recepção e Financeiro.
        </p>
        <Button type="button" onClick={() => setDraft(emptyDraft(roles))}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Novo usuário
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          titulo="Nenhum usuário"
          descricao="Cadastre a equipe e escolha o perfil de acesso de cada pessoa."
          icone={UserCog}
          acao={
            <Button type="button" onClick={() => setDraft(emptyDraft(roles))}>
              Cadastrar
            </Button>
          }
        />
      ) : (
        <div className="patients-list">
          {items.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <div key={user.id} className="patient-row">
                <div className="patient-row__inner">
                  <div className="patient-row__main">
                    <div className="patient-avatar" aria-hidden>
                      {initials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="patient-row__name">
                        {user.name}
                        {isSelf ? (
                          <span className="users-self">você</span>
                        ) : null}
                      </p>
                      <div className="patient-row__meta">
                        <span className="patient-row__meta-item">
                          <Mail aria-hidden />
                          {user.email}
                        </span>
                        {user.unitName ? (
                          <span className="patient-row__meta-item">
                            <MapPin aria-hidden />
                            {user.unitName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="patient-row__side">
                    <Badge tone="gold">{labelPt(user.roleCode)}</Badge>
                    <Badge tone={statusTone(user.status)}>
                      {labelPt(user.status)}
                    </Badge>
                  </div>
                  <div className="patient-row__actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="contorno"
                      onClick={() => setViewing(user)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Ver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setDraft(fromUser(user))}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="contorno"
                      onClick={() => void onResetPassword(user.id)}
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden />
                      Senha
                    </Button>
                    {user.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={isSelf}
                        onClick={() => void onStatus(user.id, "INACTIVE")}
                      >
                        <Power className="h-3.5 w-3.5" aria-hidden />
                        Inativar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void onStatus(user.id, "ACTIVE")}
                      >
                        <Power className="h-3.5 w-3.5" aria-hidden />
                        Ativar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => setViewing(null)}
          />
          <Card className="agenda__modal-card agenda__modal-card--tall max-w-xl">
            <div className="agenda__modal-head">
              <h2>Detalhes do usuário</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setViewing(null)}
              >
                Fechar
              </Button>
            </div>
            <div className="service-view">
              <div className="service-view__title-row">
                <div className="min-w-0">
                  <h3 className="service-view__name">{viewing.name}</h3>
                  <p className="service-view__code">{viewing.email}</p>
                </div>
                <div className="service-view__badges">
                  <Badge tone="gold">{labelPt(viewing.roleCode)}</Badge>
                  <Badge tone={statusTone(viewing.status)}>
                    {labelPt(viewing.status)}
                  </Badge>
                </div>
              </div>
              <dl className="service-view__grid">
                <div>
                  <dt>Perfil</dt>
                  <dd>{viewing.roleName}</dd>
                </div>
                <div>
                  <dt>Unidade</dt>
                  <dd>{viewing.unitName ?? "Todas"}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{viewing.phone || "—"}</dd>
                </div>
                <div>
                  <dt>Último acesso</dt>
                  <dd>{formatLogin(viewing.lastLoginAt)}</dd>
                </div>
              </dl>
              <div className="service-view__pros">
                <p className="service-view__pros-label">Permissões do perfil</p>
                <ul className="users-perms">
                  {(rolePermissions[viewing.roleCode] ?? []).map((perm) => (
                    <li key={perm.code} className="users-perms__item">
                      {perm.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="service-view__actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setViewing(null)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    setDraft(fromUser(viewing));
                    setViewing(null);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Editar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {draft ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => setDraft(null)}
          />
          <Card className="agenda__modal-card agenda__modal-card--tall">
            <div className="agenda__modal-head">
              <h2>{draft.id ? "Editar usuário" : "Novo usuário"}</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Fechar
              </Button>
            </div>
            <form onSubmit={onSave} className="agenda__form">
              <Campo label="Nome" obrigatorio>
                <Input
                  name="name"
                  required
                  autoComplete="name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  placeholder="Ex.: Ana Souza"
                />
              </Campo>
              <Campo label="E-mail" obrigatorio>
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, email: e.target.value } : prev,
                    )
                  }
                  placeholder="ana@clinica.com"
                />
              </Campo>
              <div className="agenda__form-grid">
                <Campo label="Telefone">
                  <Input
                    name="phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, phone: e.target.value } : prev,
                      )
                    }
                    placeholder="(11) 98888-7777"
                  />
                </Campo>
                <Campo label="Unidade">
                  <Select
                    name="unitId"
                    value={draft.unitId}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, unitId: e.target.value } : prev,
                      )
                    }
                  >
                    <option value="">Todas / sem unidade</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                </Campo>
              </div>
              <div className="agenda__form-grid">
                <Campo
                  label="Perfil de acesso"
                  obrigatorio
                  dica="Define o que a pessoa pode ver e fazer no painel."
                >
                  <Select
                    name="roleCode"
                    required
                    value={draft.roleCode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, roleCode: e.target.value } : prev,
                      )
                    }
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo label="Status">
                  <Select
                    name="status"
                    value={draft.status}
                    disabled={draft.id === currentUserId}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, status: e.target.value as UserStatus }
                          : prev,
                      )
                    }
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                    <option value="BLOCKED">Bloqueado</option>
                  </Select>
                </Campo>
              </div>
              {permsDoPerfil.length > 0 ? (
                <Campo label="Permissões deste perfil">
                  <ul className="users-perms">
                    {permsDoPerfil.map((perm) => (
                      <li key={perm.code} className="users-perms__item">
                        {perm.label}
                      </li>
                    ))}
                  </ul>
                </Campo>
              ) : null}
              {!draft.id ? (
                <p className="text-xs text-slate-500">
                  Uma senha provisória será gerada ao salvar. Peça à pessoa para
                  trocá-la no primeiro acesso.
                </p>
              ) : null}
              <div className="agenda__form-acoes">
                <span />
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDraft(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
