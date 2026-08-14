import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePatientSession } from "@/lib/otp/session";
import { formatBRL } from "@/lib/money";
import { CabecalhoPagina, Badge, Card, EmptyState } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

export default async function ExtratoPage() {
  const session = await requirePatientSession();

  const wallet = await prisma.wallet.findFirst({
    where: { patientId: session.patientId, clinicId: session.clinicId },
  });
  if (!wallet) redirect("/p");

  const entries = await prisma.ledgerEntry.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-3">
      <CabecalhoPagina titulo="Extrato" />
      {entries.length === 0 ? (
        <EmptyState
          titulo="Extrato vazio"
          descricao="Quando você usar benefícios ou acumular cashback, o histórico aparece aqui."
        />
      ) : (
        entries.map((entry) => (
          <Card key={entry.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{labelPt(entry.type)}</p>
                <p className="text-sm text-slate-500">
                  {entry.createdAt.toLocaleString("pt-BR")}
                  {entry.origin ? ` · ${entry.origin}` : ""}
                </p>
                {entry.expiresAt ? (
                  <p className="text-xs text-slate-500">
                    Validade {entry.expiresAt.toLocaleDateString("pt-BR")}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatBRL(entry.amount)}</p>
                <Badge tone="muted">{labelPt(entry.status)}</Badge>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
