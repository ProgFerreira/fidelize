import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listCommunications } from "@/lib/communications";
import { prisma } from "@/lib/db";
import { CabecalhoPagina, Card, Badge, Button, Input, Select, Textarea, Campo } from "@/components/ui";
import { enqueueCommunicationAction, processQueueAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";
import type { CommunicationStatus } from "@/generated/prisma/client";

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todas" },
  { value: "FAILED", label: "Falhas" },
  { value: "QUEUED", label: "Na fila" },
  { value: "SCHEDULED", label: "Agendadas" },
  { value: "SENT", label: "Enviadas" },
];

export default async function ComunicacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const clinicId = session.clinicId;
  const params = await searchParams;
  const statusFilter = (params.status || "") as CommunicationStatus | "";
  const [items, patients] = await Promise.all([
    listCommunications(
      clinicId,
      statusFilter ? { status: statusFilter } : undefined,
    ),
    prisma.patient.findMany({
      where: { clinicId: clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 100,
    }),
  ]);

  const failed = items.filter((i) => i.status === "FAILED").length;

  return (
    <div>
      <CabecalhoPagina
        titulo="Central de comunicações"
        descricao="Fila unificada com status, consentimento e histórico de entrega."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form action={processQueueAction}>
          <Button type="submit" variante="secundario">Processar fila</Button>
        </form>
        {STATUS_FILTERS.map((filter) => (
          <a
            key={filter.value || "all"}
            href={filter.value ? `/comunicacoes?status=${filter.value}` : "/comunicacoes"}
            className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
          >
            {filter.label}
            {filter.value === "FAILED" && failed > 0 ? ` (${failed})` : ""}
          </a>
        ))}
      </div>

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Enfileirar mensagem</h2>
        <form action={enqueueCommunicationAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo label="Paciente" obrigatorio>
              <Select name="patientId" required>
                <option value="">Selecione</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
            </Campo>
          </div>
          <Campo label="Canal">
            <Select name="channel" defaultValue="WHATSAPP">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INTERNAL">Interno</option>
              <option value="EMAIL">E-mail</option>
              <option value="SMS">SMS</option>
            </Select>
          </Campo>
          <Campo label="Finalidade">
            <Select name="purpose" defaultValue="SERVICE">
              <option value="SERVICE">Serviço</option>
              <option value="TRANSACTIONAL">Transacional</option>
              <option value="MARKETING">Marketing</option>
              <option value="SURVEY">Pesquisa</option>
            </Select>
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Mensagem" obrigatorio>
              <Textarea name="body" required />
            </Campo>
          </div>
          <Campo label="Destino (opcional)">
            <Input name="toAddress" />
          </Campo>
          <div className="flex items-end">
            <Button type="submit" variante="gold">Enfileirar</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {item.patient?.fullName ?? "—"} · {labelPt(item.channel)}
                </p>
                <p className="text-sm text-slate-600">{item.body}</p>
                {item.errorMessage ? (
                  <p className="mt-1 text-sm text-red-600">{item.errorMessage}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  {item.sentAt?.toLocaleString("pt-BR") ??
                    item.scheduledAt?.toLocaleString("pt-BR") ??
                    item.createdAt.toLocaleString("pt-BR")}
                  {item.providerId ? ` · ${item.providerId}` : ""}
                  {item.patient?.phone ? ` · ${item.patient.phone}` : ""}
                </p>
              </div>
              <Badge
                tone={
                  item.status === "BLOCKED_CONSENT"
                    ? "warning"
                    : item.status === "FAILED"
                      ? "danger"
                      : item.status === "SENT" || item.status === "DELIVERED"
                        ? "success"
                        : "muted"
                }
              >
                {labelPt(item.status)}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
