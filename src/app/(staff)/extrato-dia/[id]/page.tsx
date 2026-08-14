import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina } from "@/components/ui";
import { getAppointmentSale } from "@/lib/reception";
import { listProfessionals } from "@/lib/professionals";
import { prisma } from "@/lib/db";
import { isModuleEnabled } from "@/lib/modules";
import { toClientProps } from "@/lib/serialize";
import {
  SaleEditClient,
  type SaleEditDTO,
} from "@/components/reception/sale-edit-client";
import { parseYmd } from "@/lib/datetime/clinic-day";

function backHref(de?: string, ate?: string) {
  const q = new URLSearchParams();
  if (parseYmd(de)) q.set("de", de!);
  if (parseYmd(ate)) q.set("ate", ate!);
  const qs = q.toString();
  return qs ? `/extrato-dia?${qs}` : "/extrato-dia";
}

export default async function CorrigirVendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const { id } = await params;
  const query = await searchParams;
  const href = backHref(query.de, query.ate);

  let sale;
  try {
    sale = await getAppointmentSale({
      clinicId: session.clinicId,
      appointmentId: id,
    });
  } catch (e) {
    if (e instanceof Error && /não encontrada/.test(e.message)) {
      notFound();
    }
    throw e;
  }

  const [procedures, professionals, giftCardEnabled] = await Promise.all([
    prisma.procedure.findMany({
      where: { clinicId: session.clinicId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, basePrice: true },
    }),
    listProfessionals({ clinicId: session.clinicId, activeOnly: true }),
    isModuleEnabled(session.clinicId, "GIFT_CARD"),
  ]);

  const dto: SaleEditDTO = {
    id: sale.id,
    patientId: sale.patientId,
    patientName: sale.patientName,
    walletId: sale.walletId,
    professionalName: sale.professionalName,
    discountAmount: sale.discountAmount,
    benefitUsed: sale.benefitUsed,
    giftCardCode: sale.giftCardCode,
    giftCardAmount: sale.giftCardAmount,
    paymentMethod: sale.paymentMethod,
    items: sale.items.map((item) => ({
      procedureId: item.procedureId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      professionalName: item.professionalName,
    })),
  };

  return (
    <div className="services-page pdv-extract">
      <CabecalhoPagina
        titulo="Corrigir venda"
        descricao={`Ajuste itens, valores e forma de pagamento de ${sale.patientName}.`}
        acoes={
          <Link href={href} className="pdv-extract-link">
            Voltar ao extrato
          </Link>
        }
      />
      <SaleEditClient
        sale={toClientProps<SaleEditDTO>(dto)}
        procedures={toClientProps(
          procedures.map((p) => ({
            id: p.id,
            name: p.name,
            basePrice: Number(p.basePrice),
          })),
        )}
        professionals={toClientProps(
          professionals.map((p) => ({
            id: p.id,
            name: p.name,
            specialty: p.specialty,
            procedurePrices: p.procedurePrices,
          })),
        )}
        giftCardEnabled={giftCardEnabled}
        backHref={href}
      />
    </div>
  );
}
