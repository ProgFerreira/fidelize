import { prisma } from "@/lib/db";
import { requirePatientSession } from "@/lib/otp/session";
import { isModuleEnabled } from "@/lib/modules";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatBRL } from "@/lib/money";

export default async function PortalVouchersPage() {
  const session = await requirePatientSession();

  if (!(await isModuleEnabled(session.clinicId, "VOUCHERS"))) {
    return (
      <div>
        <h1 className="text-3xl text-slate-900">Vouchers</h1>
        <p className="mt-2 text-sm text-slate-500">Módulo desativado nesta clínica.</p>
      </div>
    );
  }

  const vouchers = await prisma.voucher.findMany({
    where: {
      clinicId: session.clinicId,
      status: "ACTIVE",
      OR: [{ patientId: session.patientId }, { patientId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-slate-900">Vouchers</h1>
      {vouchers.length === 0 ? (
        <EmptyState
          titulo="Nenhum voucher disponível"
          descricao="Quando a clínica emitir um voucher para você, ele aparece nesta lista."
        />
      ) : (
        vouchers.map((v) => (
          <Card key={v.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{v.name}</p>
                <p className="text-sm text-slate-500">{v.description}</p>
                <p className="mt-2 font-mono text-sm">{v.code}</p>
                <p className="text-xs text-slate-400">
                  {v.valueAmount
                    ? formatBRL(v.valueAmount)
                    : v.valuePercent
                      ? `${v.valuePercent}%`
                      : v.type}
                </p>
              </div>
              <Badge tone="success">{v.status}</Badge>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
