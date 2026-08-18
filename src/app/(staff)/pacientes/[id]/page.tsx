import Link from "next/link";
import {
  ArrowLeft,
  IdCard,
  Phone,
  MapPin,
  Mail,
  Wallet,
  Clock3,
  Sparkles,
  Award,
  CreditCard,
  ShieldAlert,
  Pencil,
} from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  Avatar,
  CabecalhoPagina,
  Badge,
  Button,
  classesBotao,
  Select,
  Input,
} from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";
import { formatBRL } from "@/lib/money";
import { getCategoryProgress } from "@/lib/categories";
import { generateCardQrDataUrl } from "@/lib/cards";
import { linkCardFormAction } from "@/app/actions";
import { listTags } from "@/lib/tags";
import {
  assignTagAction,
  removeTagAction,
} from "@/app/v2-actions";
import { AppointmentHistoryCard } from "@/components/patients/appointment-history";
import { AnonymizePatientButton } from "@/components/patients/anonymize-patient-button";
import { formatCpf, formatPhone } from "@/lib/patients/cpf";
import { VideoCallHistoryCard } from "@/components/patients/video-call-history";
import { listVideoCallRoomsForPatient } from "@/lib/videocalls";
import { readChatTranscriptFile } from "@/lib/uploads/chat-transcript";
import { isModuleEnabled } from "@/lib/modules";

export default async function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const clinicId = session.clinicId;
  const canWrite = hasPermission(
    session.user.permissions,
    PERMISSIONS.PATIENTS_WRITE,
  );
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
  const activeCards = wallet?.cards.filter((c) => c.status === "ACTIVE") ?? [];
  const activeCard =
    activeCards.find((c) => c.kind === "PHYSICAL") ??
    activeCards.find((c) => c.kind === "VIRTUAL") ??
    activeCards[0];
  const virtualCard = activeCards.find((c) => c.kind === "VIRTUAL");
  const qr = activeCard
    ? await generateCardQrDataUrl(activeCard.publicToken)
    : null;
  const virtualQr = virtualCard
    ? await generateCardQrDataUrl(virtualCard.publicToken)
    : null;
  const tags = await listTags(clinicId).catch(() => []);
  const canManageTags = session.user.permissions.includes(PERMISSIONS.TAGS_MANAGE);
  const canSeeVideoCalls =
    session.user.permissions.includes(PERMISSIONS.VIDEOCALLS_MANAGE) &&
    (await isModuleEnabled(clinicId, "VIDEOCALLS").catch(() => false));
  const videoCallRooms = canSeeVideoCalls
    ? await listVideoCallRoomsForPatient(clinicId, patient.id)
    : [];
  const videoCallHistory = await Promise.all(
    videoCallRooms.map(async (room) => ({
      id: room.id,
      status: room.status,
      createdAt: room.createdAt,
      chatTranscripts: await Promise.all(
        room.chatTranscripts.map(async (t) => ({
          id: t.id,
          messageCount: t.messageCount,
          createdAt: t.createdAt,
          content: await readChatTranscriptFile(t.filePath).catch(
            () => "(arquivo indisponível)",
          ),
        })),
      ),
      audioTranscripts: room.audioTranscripts.map((t) => ({
        id: t.id,
        text: t.text,
        durationSeconds: t.durationSeconds,
        createdAt: t.createdAt,
      })),
    })),
  );
  const statusTone =
    patient.status === "ACTIVE"
      ? "success"
      : patient.status === "BLOCKED"
        ? "danger"
        : "muted";
  const categoryName = wallet?.category?.name ?? "Sem categoria";
  const ledgerEntries = wallet?.ledgerEntries ?? [];
  const creditLots = wallet?.creditLots ?? [];

  return (
    <div className="patients-page patient-detail">
      <CabecalhoPagina
        titulo="Ficha do paciente"
        descricao="Carteira, cartão, etiquetas e histórico comercial em um só lugar."
        breadcrumbs={[
          { label: "Pacientes", href: "/pacientes" },
          { label: patient.fullName },
        ]}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <Link
                href={`/pacientes/${patient.id}/editar`}
                className={classesBotao({ variante: "gold" })}
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </Link>
            ) : null}
            <Link href="/pacientes" className={classesBotao({ variante: "contorno" })}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar
            </Link>
          </div>
        }
      />

      <section className="patient-detail__hero">
        <div className="patient-detail__hero-main">
          <Avatar nome={patient.fullName} tamanho="lg" />
          <div className="min-w-0">
            <h2 className="patient-detail__name">{patient.fullName}</h2>
            <div className="patient-detail__meta">
              <span className="patient-detail__meta-item">
                <IdCard aria-hidden />
                CPF {formatCpf(patient.cpf)}
              </span>
              <span className="patient-detail__meta-item">
                <Phone aria-hidden />
                {formatPhone(patient.phone)}
              </span>
              {patient.email ? (
                <span className="patient-detail__meta-item">
                  <Mail aria-hidden />
                  {patient.email}
                </span>
              ) : null}
              {patient.unit ? (
                <span className="patient-detail__meta-item">
                  <MapPin aria-hidden />
                  {patient.unit.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="patient-detail__badges">
          <Badge tone="gold">{categoryName}</Badge>
          <Badge tone={statusTone}>{labelPt(patient.status)}</Badge>
        </div>
      </section>

      <div className="patients-stats patients-stats--4">
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--green">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Disponível</p>
            <p className="patients-stat__value">
              {formatBRL(wallet?.availableBalance ?? 0)}
            </p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon">
            <Clock3 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Pendente</p>
            <p className="patients-stat__value">
              {formatBRL(wallet?.pendingBalance ?? 0)}
            </p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--gold">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Pontos</p>
            <p className="patients-stat__value">{wallet?.pointsBalance ?? 0}</p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--gold">
            <Award className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Categoria</p>
            <p className="patients-stat__value" style={{ fontSize: "1.05rem" }}>
              {categoryName}
            </p>
          </div>
        </div>
      </div>

      {progress?.next ? (
        <div className="patient-detail__panel">
          <div className="patient-detail__panel-head" style={{ marginBottom: 0 }}>
            <div>
              <h3 className="patient-detail__panel-title">
                Progresso de categoria
              </h3>
              <p className="patient-detail__panel-desc">
                Caminho até {progress.next.name}
              </p>
            </div>
            <span className="patient-detail__progress-value">
              {progress.progressPercent}%
            </span>
          </div>
          <div className="patient-detail__progress">
            <div className="patient-detail__progress-track">
              <div
                className="patient-detail__progress-bar"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="patient-detail__layout">
        <div className="patient-detail__main">
          <section className="patient-detail__panel">
            <div className="patient-detail__panel-head">
              <div>
                <h3 className="patient-detail__panel-title">Etiquetas</h3>
                <p className="patient-detail__panel-desc">
                  Segmentação comercial do paciente
                </p>
              </div>
              <span className="patient-detail__panel-count">
                {patient.tagAssignments.length} ativa
                {patient.tagAssignments.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="patient-detail__tags">
              {patient.tagAssignments.map((a) => (
                <form
                  key={a.id}
                  action={removeTagAction}
                  className="patient-detail__tag"
                >
                  <Badge tone="muted">
                    <span
                      className="patient-detail__tag-dot mr-1"
                      style={{ background: a.tag.color }}
                    />
                    {a.tag.name}
                  </Badge>
                  {canManageTags ? (
                    <>
                      <input type="hidden" name="patientId" value={patient.id} />
                      <input type="hidden" name="tagId" value={a.tagId} />
                      <Button type="submit" tamanho="sm" variante="fantasma">
                        ×
                      </Button>
                    </>
                  ) : null}
                </form>
              ))}
              {patient.tagAssignments.length === 0 ? (
                <p className="patient-detail__empty">Nenhuma etiqueta aplicada.</p>
              ) : null}
            </div>

            {canManageTags ? (
              <form action={assignTagAction} className="patient-detail__tag-form">
                <input type="hidden" name="patientId" value={patient.id} />
                <Select name="tagId" required className="max-w-xs">
                  <option value="">Aplicar etiqueta</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" tamanho="sm">
                  Aplicar
                </Button>
              </form>
            ) : null}
          </section>

          <div className="patient-detail__metric-grid">
            <section className="patient-detail__panel">
              <div className="patient-detail__panel-head">
                <div>
                  <h3 className="patient-detail__panel-title">Extrato recente</h3>
                  <p className="patient-detail__panel-desc">
                    Últimos lançamentos da carteira
                  </p>
                </div>
                <span className="patient-detail__panel-count">
                  {ledgerEntries.length}
                </span>
              </div>
              {ledgerEntries.length === 0 ? (
                <p className="patient-detail__empty">Sem lançamentos recentes.</p>
              ) : (
                <div className="patient-detail__list">
                  {ledgerEntries.map((entry) => (
                    <div key={entry.id} className="patient-detail__row">
                      <div>
                        <p className="patient-detail__row-title">
                          {labelPt(entry.type)}
                        </p>
                        <p className="patient-detail__row-meta">
                          {entry.createdAt.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <p className="patient-detail__row-amount">
                        {formatBRL(entry.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="patient-detail__panel">
              <div className="patient-detail__panel-head">
                <div>
                  <h3 className="patient-detail__panel-title">
                    Créditos a expirar
                  </h3>
                  <p className="patient-detail__panel-desc">
                    Lotes com saldo ainda disponível
                  </p>
                </div>
                <span className="patient-detail__panel-count">
                  {creditLots.length}
                </span>
              </div>
              {creditLots.length === 0 ? (
                <p className="patient-detail__empty">
                  Nenhum crédito próximo de expirar.
                </p>
              ) : (
                <div className="patient-detail__list">
                  {creditLots.map((lot) => (
                    <div key={lot.id} className="patient-detail__row">
                      <div>
                        <p className="patient-detail__row-title">
                          {formatBRL(lot.remainingAmount)}
                        </p>
                        <p className="patient-detail__row-meta">
                          {lot.expiresAt
                            ? `Expira ${lot.expiresAt.toLocaleDateString("pt-BR")}`
                            : "Sem validade"}
                        </p>
                      </div>
                      <Badge tone="gold">{labelPt(lot.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <AppointmentHistoryCard
            patientName={patient.fullName}
            items={patient.appointments}
          />

          {canSeeVideoCalls ? <VideoCallHistoryCard items={videoCallHistory} /> : null}
        </div>

        <aside className="patient-detail__aside">
          <section className="patient-detail__panel patient-detail__card">
            <div className="patient-detail__panel-head">
              <div>
                <h3 className="patient-detail__panel-title">Cartão</h3>
                <p className="patient-detail__panel-desc">
                  Identificação e QR do membro
                </p>
              </div>
              <CreditCard className="h-4 w-4 text-slate-400" aria-hidden />
            </div>

            {activeCard && qr ? (
              <div className="space-y-3">
                <div className="digital-card">
                  <p className="patient-detail__card-label">
                    Cartão {activeCard.kind === "VIRTUAL" ? "virtual" : "físico"}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {patient.fullName.split(" ")[0]}
                  </p>
                  <p className="mt-1 text-sm text-white/65">{categoryName}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    alt="QR Code do cartão"
                    className="patient-detail__card-qr mt-5"
                  />
                  <p className="patient-detail__card-number">
                    {activeCard.cardNumber}
                  </p>
                </div>
                {virtualCard &&
                virtualQr &&
                virtualCard.id !== activeCard.id ? (
                  <p className="text-xs text-slate-500">
                    Também possui cartão virtual ativo:{" "}
                    <strong>{virtualCard.cardNumber}</strong>
                  </p>
                ) : null}
                {wallet ? (
                  <form action={linkCardFormAction} className="patient-detail__link-form">
                    <input type="hidden" name="walletId" value={wallet.id} />
                    <Input
                      name="publicToken"
                      placeholder="Token para vincular/substituir físico"
                      aria-label="Token do QR ou cartão"
                    />
                    <Button type="submit" variante="contorno" tamanho="sm">
                      Vincular físico
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 text-left">
                <p className="patient-detail__empty" style={{ paddingTop: 0 }}>
                  Nenhum cartão ativo vinculado.
                </p>
                {wallet ? (
                  <form action={linkCardFormAction} className="patient-detail__link-form">
                    <input type="hidden" name="walletId" value={wallet.id} />
                    <Input
                      name="publicToken"
                      placeholder="Token do QR / cartão"
                      required
                      aria-label="Token do QR ou cartão"
                    />
                    <Button type="submit" variante="contorno">
                      Vincular cartão
                    </Button>
                  </form>
                ) : (
                  <p className="patient-detail__empty">
                    Crie uma carteira antes de vincular um cartão.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="patient-detail__panel patient-detail__danger">
            <div className="patient-detail__panel-head">
              <div>
                <h3 className="patient-detail__panel-title">LGPD</h3>
                <p className="patient-detail__panel-desc">
                  Direitos do titular (art. 18)
                </p>
              </div>
              <ShieldAlert className="h-4 w-4 text-red-500" aria-hidden />
            </div>
            <p className="text-sm text-slate-600">
              A anonimização remove dados identificáveis e é irreversível.
            </p>
            <div className="mt-3">
              <AnonymizePatientButton patientId={patient.id} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
