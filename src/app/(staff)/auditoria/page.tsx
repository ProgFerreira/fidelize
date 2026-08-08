import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Badge } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

export default async function AuditoriaPage() {
  const session = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const clinicId = session.clinicId;
  const logs = await prisma.auditLog.findMany({
    where: { clinicId: clinicId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Trilha imutável de acessos e operações sensíveis."
      />
      <div className="space-y-3">
        {logs.map((log) => (
          <Card key={log.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{labelPt(log.action)}</p>
                <p className="text-sm text-slate-500">
                  {log.user?.name ?? "Sistema"} ·{" "}
                  {log.createdAt.toLocaleString("pt-BR")}
                  {log.entityType ? ` · ${log.entityType}` : ""}
                </p>
              </div>
              <Badge tone="muted">{log.entityId?.slice(0, 8) ?? "—"}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
