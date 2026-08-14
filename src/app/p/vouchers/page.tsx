import { prisma } from "@/lib/db";
import { requirePatientSession } from "@/lib/otp/session";
import { isModuleEnabled } from "@/lib/modules";
import { CabecalhoPagina, Card, Badge, EmptyState } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";

export default async function PortalVouchersPage() {
  const session = await requirePatientSession();

  if (!(await isModuleEnabled(session.clinicId, "VOUCHERS"))) {
    return (
      <div>
        <CabecalhoPagina titulo="Vouchers" descricao="Módulo desativado nesta clínica." />
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
      <CabecalhoPagina titulo="Vouchers" />
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
                      : labelPt(v.type)}
                </p>
              </div>
              <Badge tone="success">{labelPt(v.status)}</Badge>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
