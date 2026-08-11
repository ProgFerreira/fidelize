import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui";
import { AgendaClient } from "@/components/agenda/agenda-client";
import { listAgendaEvents, weekBounds } from "@/lib/agenda";
import { listProfessionals } from "@/lib/professionals";
import { toPlain } from "@/lib/serialize";

export default async function AgendaPage() {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  const { start, end } = weekBounds(new Date());

  const [events, procedures, professionals] = await Promise.all([
    listAgendaEvents({
      clinicId: session.clinicId,
      from: start,
      to: end,
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
        initialWeekStart={start.toISOString()}
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
