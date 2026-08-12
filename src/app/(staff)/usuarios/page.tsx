import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS, permissionsForRole } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui";
import { UsersClient } from "@/components/users/users-client";
import {
  listStaffRoles,
  listStaffUnits,
  listStaffUsers,
} from "@/lib/users";
import { toPlain } from "@/lib/serialize";
import { ensureSystemRoles } from "@/lib/auth/sync-roles";

export default async function UsuariosPage() {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  await ensureSystemRoles(session.clinicId);

  const [users, roles, units] = await Promise.all([
    listStaffUsers({ clinicId: session.clinicId }),
    listStaffRoles(session.clinicId),
    listStaffUnits(session.clinicId),
  ]);

  const rolePermissions = Object.fromEntries(
    roles.map((role) => [role.code, permissionsForRole(role.code)]),
  );

  return (
    <div className="users-page">
      <PageHeader
        title="Usuários e permissões"
        description="Cadastre a equipe e vincule cada pessoa a um perfil de acesso. A alteração de perfil vale no próximo login."
      />
      <UsersClient
        currentUserId={session.user.id}
        initialUsers={toPlain(users)}
        roles={toPlain(roles)}
        units={toPlain(units)}
        rolePermissions={rolePermissions}
      />
    </div>
  );
}
