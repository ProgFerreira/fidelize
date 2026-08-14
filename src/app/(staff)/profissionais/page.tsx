import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina } from "@/components/ui";
import { ProfessionalsClient } from "@/components/professionals/professionals-client";
import { listProfessionals } from "@/lib/professionals";
import { toPlain } from "@/lib/serialize";

export default async function ProfissionaisPage() {
  const session = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE);

  const [professionals, procedures] = await Promise.all([
    listProfessionals({ clinicId: session.clinicId }),
    prisma.procedure.findMany({
      where: { clinicId: session.clinicId, active: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        validityDays: true,
        durationMinutes: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <CabecalhoPagina
        titulo="Profissionais"
        descricao="Monte o portfólio de cada profissional. O mesmo serviço pode ter preço diferente por profissional."
      />
      <ProfessionalsClient
        initialProfessionals={toPlain(professionals)}
        procedures={toPlain(
          procedures.map((p) => ({
            id: p.id,
            name: p.name,
            basePrice: Number(p.basePrice),
            validityDays: p.validityDays,
            durationMinutes: p.durationMinutes,
          })),
        )}
      />
    </div>
  );
}
