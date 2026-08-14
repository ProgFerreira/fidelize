import Link from "next/link";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { listVideoCallRooms } from "@/lib/videocalls";
import { createVideoCallRoomAction, cancelVideoCallRoomAction } from "@/app/v2-actions";
import { PageHeader, Card, Badge, Button, classesBotao, Label, Select } from "@/components/ui";
import { CopyLinkButton } from "@/components/videochamadas/copy-link-button";
import { ensureSystemRolePermissions } from "@/lib/auth/sync-roles";

const STATUS_LABEL: Record<string, string> = {
  CRIADA: "Criada",
  AGUARDANDO: "Aguardando",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

const STATUS_TONE: Record<string, string> = {
  CRIADA: "muted",
  AGUARDANDO: "warning",
  EM_ANDAMENTO: "success",
  ENCERRADA: "muted",
  CANCELADA: "danger",
};

async function patientPortalBaseUrl() {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const scheme = host.includes("localhost") ? "http" : "https";
  return `${scheme}://${host}`;
}

export default async function VideochamadasPage() {
  const session = await requirePermission(PERMISSIONS.VIDEOCALLS_MANAGE);
  await ensureSystemRolePermissions(session.clinicId);
  const baseUrl = await patientPortalBaseUrl();
  const [rooms, patients] = await Promise.all([
    listVideoCallRooms(session.user.clinicId),
    prisma.patient.findMany({
      where: { clinicId: session.user.clinicId },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Videochamadas"
        description="Consulta por vídeo entre profissional e paciente, com gravação opcional."
      />

      <Card className="mb-6 max-w-xl">
        <h2 className="text-lg font-semibold">Nova chamada</h2>
        <form action={createVideoCallRoomAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Paciente</Label>
            <Select name="patientId" required>
              <option value="">Selecione...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Criar sala</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {rooms.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">Nenhuma videochamada criada ainda.</p>
          </Card>
        )}
        {rooms.map((room) => (
          <Card key={room.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{room.patient.fullName}</p>
                {room.scheduleEvent && (
                  <p className="text-sm text-slate-500">{room.scheduleEvent.title}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {room.recordings.length} gravação(ões)
                </p>
              </div>
              <Badge tone={STATUS_TONE[room.status]}>{STATUS_LABEL[room.status]}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {room.status !== "ENCERRADA" && room.status !== "CANCELADA" && (
                <Link
                  href={`/videochamadas/${room.id}`}
                  className={classesBotao({ size: "sm" })}
                >
                  Entrar na sala
                </Link>
              )}
              {room.status !== "ENCERRADA" && room.status !== "CANCELADA" && (
                <>
                  <CopyLinkButton url={`${baseUrl}/p/videochamadas/${room.id}`} />
                  <form action={cancelVideoCallRoomAction}>
                    <input type="hidden" name="roomId" value={room.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Cancelar
                    </Button>
                  </form>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
