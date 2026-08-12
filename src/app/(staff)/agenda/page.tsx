import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui";
import { AgendaClient } from "@/components/agenda/agenda-client";
import { listAgendaEvents, toDateOnly, weekBounds } from "@/lib/agenda";
import { listProfessionals } from "@/lib/professionals";
import { toPlain } from "@/lib/serialize";

export default async function AgendaPage() {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  // Janela folgada (±1 dia) para o SSR em UTC não “perder” a semana local do Brasil.
  const { start, end } = weekBounds(new Date());
  const paddedStart = new Date(start);
  paddedStart.setDate(paddedStart.getDate() - 1);
  const paddedEnd = new Date(end);
  paddedEnd.setDate(paddedEnd.getDate() + 1);

  const [events, procedures, professionals] = await Promise.all([
    listAgendaEvents({
      clinicId: session.clinicId,
      from: paddedStart,
      to: paddedEnd,
    }),
    prisma.procedure.findMany({
      where: { clinicId: session.clinicId, active: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        durationMinutes: true,
        validityDays: true,
        description: true,
      },
      orderBy: { name: "asc" },
    }),
    listProfessionals({ clinicId: session.clinicId, activeOnly: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Grade semanal de compromissos com pacientes — agende, busque e acompanhe a semana."
      />
      <AgendaClient
        initialWeekStart={toDateOnly(start)}
        initialEvents={toPlain(events)}
        procedures={toPlain(
          procedures.map((p) => ({
            id: p.id,
            name: p.name,
            basePrice: Number(p.basePrice),
            durationMinutes: p.durationMinutes,
            validityDays: p.validityDays,
            description: p.description,
          })),
        )}
        professionals={toPlain(professionals)}
      />
    </div>
  );
}
