import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Badge, Button, Select } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";
import { formatBRL } from "@/lib/money";
import { getCategoryProgress } from "@/lib/categories";
import { generateCardQrDataUrl } from "@/lib/cards";
import { linkCardAction } from "@/app/actions";
import { listTags } from "@/lib/tags";
import { assignTagAction, removeTagAction } from "@/app/v2-actions";
import { AppointmentHistoryCard } from "@/components/patients/appointment-history";

export default async function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const clinicId = session.clinicId;
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, clinicId: clinicId },
    include: {
      unit: true,
      tagAssignments: {
        where: { removedAt: null },
        include: { tag: true },
      },
      wallets: {
        include: {
          category: true,
          cards: true,
          ledgerEntries: { orderBy: { createdAt: "desc" }, take: 20 },
          creditLots: {
            where: {
              status: { in: ["AVAILABLE", "PARTIALLY_USED", "PENDING"] },
              remainingAmount: { gt: 0 },
            },
            orderBy: { expiresAt: "asc" },
            take: 10,
          },
        },
      },
      appointments: {
        where: { status: { in: ["CONFIRMED", "CANCELLED", "REVERSED"] } },
        include: {
          procedure: { select: { id: true, name: true } },
        },
        orderBy: { occurredAt: "desc" },
        take: 20,
      },
    },
  });

  if (!patient) notFound();
  const wallet = patient.wallets[0];
  const progress = wallet ? await getCategoryProgress(wallet.id) : null;
  const activeCard = wallet?.cards.find((c) => c.status === "ACTIVE");
  const qr = activeCard
    ? await generateCardQrDataUrl(activeCard.publicToken)
    : null;
  const tags = await listTags(clinicId).catch(() => []);
  const canManageTags = session.user.permissions.includes(PERMISSIONS.TAGS_MANAGE);

  return (
    <div>
      <PageHeader
        title={patient.fullName}
        description={`CPF ${patient.cpf} · ${patient.phone}`}
        actions={<Badge tone={patient.status === "ACTIVE" ? "success" : "danger"}>{labelPt(patient.status)}</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="text-2xl">Carteira</h2>
          {wallet ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Disponível</p>
                <p className="text-3xl text-slate-900">
                  {formatBRL(wallet.availableBalance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Pendente</p>
                <p className="text-3xl text-slate-900">
                  {formatBRL(wallet.pendingBalance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Pontos</p>
                <p className="text-3xl text-slate-900">
                  {wallet.pointsBalance}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Categoria</p>
                <p className="text-3xl text-slate-900">
                  {wallet.category?.name ?? "—"}
                </p>
              </div>
              {progress?.next ? (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm text-slate-500">
                    Progresso para {progress.next.name}: {progress.progressPercent}%
                  </p>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-slate-500">Sem carteira ativa.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-2xl">Cartão</h2>
          {activeCard && qr ? (
            <div className="mt-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code do cartão" className="mx-auto rounded-xl" />
              <p className="mt-2 font-mono text-sm">{activeCard.cardNumber}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-500">Nenhum cartão ativo.</p>
              {wallet ? (
                <form action={linkCardAction} className="space-y-2">
                  <input type="hidden" name="walletId" value={wallet.id} />
                  <input
                    name="publicToken"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Token do QR / cartão"
                    required
                  />
                  <Button type="submit" variant="outline">
                    Vincular cartão
                  </Button>
                </form>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-2xl">Etiquetas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {patient.tagAssignments.map((a) => (
            <form key={a.id} action={removeTagAction} className="inline-flex items-center gap-1">
              <Badge tone="muted">
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ background: a.tag.color }}
                />
                {a.tag.name}
              </Badge>
              {canManageTags && (
                <>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input type="hidden" name="tagId" value={a.tagId} />
                  <Button type="submit" size="sm" variant="ghost">
                    ×
                  </Button>
                </>
              )}
            </form>
          ))}
          {patient.tagAssignments.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma etiqueta.</p>
          )}
        </div>
        {canManageTags && (
          <form action={assignTagAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="patientId" value={patient.id} />
            <Select name="tagId" required className="max-w-xs">
              <option value="">Aplicar etiqueta</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm">Aplicar</Button>
          </form>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-2xl">Extrato recente</h2>
          <div className="mt-4 space-y-2">
            {wallet?.ledgerEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between border-b border-slate-200/60 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{labelPt(entry.type)}</p>
                  <p className="text-slate-500">
                    {entry.createdAt.toLocaleString("pt-BR")}
                  </p>
                </div>
                <p className="font-semibold">{formatBRL(entry.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-2xl">Créditos próximos de expirar</h2>
          <div className="mt-4 space-y-2">
            {wallet?.creditLots.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between border-b border-slate-200/60 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{formatBRL(lot.remainingAmount)}</p>
                  <p className="text-slate-500">
                    {lot.expiresAt
                      ? `Expira ${lot.expiresAt.toLocaleDateString("pt-BR")}`
                      : "Sem validade"}
                  </p>
                </div>
                <Badge tone="gold">{labelPt(lot.status)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <AppointmentHistoryCard
        className="mt-4"
        patientName={patient.fullName}
        items={patient.appointments}
      />
    </div>
  );
}
