import { Ticket } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listVouchers } from "@/lib/vouchers";
import { prisma } from "@/lib/db";
import { CabecalhoPagina, IconTag } from "@/components/ui";
import {
  VouchersClient,
  type VoucherDTO,
  type VoucherPatientOption,
} from "@/components/vouchers/vouchers-client";
import { toClientProps } from "@/lib/serialize";

export default async function VouchersPage() {
  const session = await requirePermission(PERMISSIONS.VOUCHERS_MANAGE);
  const clinicId = session.clinicId;
  const [vouchers, patients] = await Promise.all([
    listVouchers(clinicId),
    prisma.patient.findMany({
      where: { clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      take: 100,
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="services-page">
      <CabecalhoPagina
        titulo="Cupons"
        descricao="Cupons rastreáveis com código único — emissão, validade e resgate na recepção."
        acoes={
          <IconTag icone={Ticket}>Vouchers</IconTag>
        }
      />
      <VouchersClient
        initialVouchers={toClientProps<VoucherDTO[]>(vouchers)}
        patients={toClientProps<VoucherPatientOption[]>(patients)}
      />
    </div>
  );
}
