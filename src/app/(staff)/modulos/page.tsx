import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listModules } from "@/lib/modules";
import { PageHeader, Card, Badge, Button } from "@/components/ui";
import { toggleModuleAction } from "@/app/v2-actions";

export default async function ModulosPage() {
  const session = await requirePermission(PERMISSIONS.MODULES_MANAGE);
  const clinicId = session.clinicId;
  const modules = await listModules(clinicId);

  return (
    <div>
      <PageHeader
        title="Módulos do programa"
        description="Ative ou desative funcionalidades sem apagar o histórico."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((mod) => (
          <Card key={mod.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{mod.name}</p>
                <p className="mt-1 text-sm text-slate-500">{mod.description}</p>
              </div>
              <Badge tone={mod.enabled ? "success" : "muted"}>
                {mod.enabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <form action={toggleModuleAction} className="mt-4">
              <input type="hidden" name="code" value={mod.code} />
              <input type="hidden" name="enabled" value={mod.enabled ? "false" : "true"} />
              <Button type="submit" variant={mod.enabled ? "secondary" : "gold"} size="sm">
                {mod.enabled ? "Desativar" : "Ativar"}
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
