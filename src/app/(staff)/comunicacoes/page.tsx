import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listCommunications } from "@/lib/communications";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { enqueueCommunicationAction, processQueueAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function ComunicacoesPage() {
  const session = await requirePermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const clinicId = session.clinicId;
  const [items, patients] = await Promise.all([
    listCommunications(clinicId),
    prisma.patient.findMany({
      where: { clinicId: clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Central de comunicações"
        description="Fila unificada com status, consentimento e histórico de entrega."
      />
      <div className="mb-4 flex gap-2">
        <form action={processQueueAction}>
          <Button type="submit" variant="secondary">Processar fila</Button>
        </form>
      </div>

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Enfileirar mensagem</h2>
        <form action={enqueueCommunicationAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Paciente</Label>
            <Select name="patientId" required>
              <option value="">Selecione</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Canal</Label>
            <Select name="channel" defaultValue="INTERNAL">
              <option value="INTERNAL">Interno</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="SMS">SMS</option>
            </Select>
          </div>
          <div>
            <Label>Finalidade</Label>
            <Select name="purpose" defaultValue="SERVICE">
              <option value="SERVICE">Serviço</option>
              <option value="TRANSACTIONAL">Transacional</option>
              <option value="MARKETING">Marketing</option>
              <option value="SURVEY">Pesquisa</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Mensagem</Label>
            <Textarea name="body" required />
          </div>
          <div>
            <Label>Destino (opcional)</Label>
            <Input name="toAddress" />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="gold">Enfileirar</Button>
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
                <p className="mt-1 text-xs text-slate-400">
                  {item.sentAt?.toLocaleString("pt-BR") ?? item.createdAt.toLocaleString("pt-BR")}
                  {item.providerId ? ` · ${item.providerId}` : ""}
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
