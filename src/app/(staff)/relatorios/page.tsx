import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Badge, Button } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { writeAuditLog } from "@/lib/audit";
import { reverseEntryAction } from "@/app/actions";
import { labelPt } from "@/lib/i18n/labels";
import Link from "next/link";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const clinicId = session.clinicId;
  const { type = "ledger" } = await searchParams;

  const [ledger, patients, campaigns, blockedWallets] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { wallet: { include: { patient: true } } },
    }),
    prisma.patient.findMany({
      where: { clinicId },
      include: { wallets: { include: { category: true } } },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaign.findMany({ where: { clinicId } }),
    prisma.wallet.findMany({
      where: { clinicId, status: "BLOCKED" },
      include: { patient: true },
    }),
  ]);

  if (type === "export") {
    await writeAuditLog({
      clinicId,
      userId: session.user.id,
      action: "REPORT_EXPORT",
      metadata: { format: "csv", report: "ledger" },
    });
  }

  const csv =
    "id,tipo,valor,paciente,status,data\n" +
    ledger
      .map(
        (e) =>
          `${e.id},${labelPt(e.type)},${e.amount},${e.wallet.patient.fullName},${labelPt(e.status)},${e.createdAt.toISOString()}`,
      )
      .join("\n");

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Movimentações, pacientes, campanhas e passivo promocional."
        actions={
          <div className="flex gap-2">
            <Link href="/relatorios?type=ledger"><Button variant="outline">Extrato</Button></Link>
            <Link href="/relatorios?type=patients"><Button variant="outline">Pacientes</Button></Link>
            <Link href="/relatorios?type=export"><Button variant="gold">Exportar CSV</Button></Link>
          </div>
        }
      />

      {type === "export" ? (
        <Card>
          <h2 className="text-xl">CSV gerado</h2>
          <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-100 p-3 text-xs">
            {csv}
          </pre>
        </Card>
      ) : null}

      {type === "patients" ? (
        <div className="space-y-3">
          {patients.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.fullName}</p>
                  <p className="text-sm text-slate-500">{p.cpf}</p>
                </div>
                <Badge tone="gold">{p.wallets[0]?.category?.name ?? "—"}</Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {(type === "ledger" || !type) && (
        <div className="space-y-3">
          <Card>
            <p className="text-sm text-slate-500">
              Carteiras bloqueadas: {blockedWallets.length} · Campanhas: {campaigns.length}
            </p>
          </Card>
          {ledger.map((entry) => (
            <Card key={entry.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{labelPt(entry.type)}</p>
                  <p className="text-sm text-slate-500">
                    {entry.wallet.patient.fullName} ·{" "}
                    {entry.createdAt.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{formatBRL(entry.amount)}</p>
                  <Badge>{labelPt(entry.status)}</Badge>
                  {entry.status === "COMPLETED" &&
                  session.user.permissions.includes(PERMISSIONS.FINANCE_REVERSAL) ? (
                    <form action={reverseEntryAction} className="flex gap-2">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input
                        name="reason"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Motivo"
                        required
                      />
                      <Button type="submit" variant="danger">
                        Estornar
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
