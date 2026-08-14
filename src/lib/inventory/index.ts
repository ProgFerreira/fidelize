import { prisma } from "@/lib/db";

export async function assertStockAvailable(params: {
  clinicId: string;
  items: Array<{ procedureId: string | null; quantity: number }>;
}) {
  const ids = [
    ...new Set(
      params.items.map((i) => i.procedureId).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return;
  const procedures = await prisma.procedure.findMany({
    where: { clinicId: params.clinicId, id: { in: ids } },
    select: { id: true, name: true, stockQty: true },
  });
  const qtyById = new Map<string, number>();
  for (const item of params.items) {
    if (!item.procedureId) continue;
    qtyById.set(
      item.procedureId,
      (qtyById.get(item.procedureId) ?? 0) + item.quantity,
    );
  }
  for (const proc of procedures) {
    if (proc.stockQty == null) continue;
    const need = qtyById.get(proc.id) ?? 0;
    if (proc.stockQty < need) {
      throw new Error(`Estoque insuficiente: ${proc.name} (restam ${proc.stockQty})`);
    }
  }
}

export async function decrementStock(params: {
  clinicId: string;
  items: Array<{ procedureId: string | null; quantity: number }>;
}) {
  const qtyById = new Map<string, number>();
  for (const item of params.items) {
    if (!item.procedureId) continue;
    qtyById.set(
      item.procedureId,
      (qtyById.get(item.procedureId) ?? 0) + Math.max(1, item.quantity),
    );
  }
  for (const [procedureId, qty] of qtyById) {
    await prisma.procedure.updateMany({
      where: {
        id: procedureId,
        clinicId: params.clinicId,
        stockQty: { not: null },
      },
      data: { stockQty: { decrement: qty } },
    });
    await prisma.procedure.updateMany({
      where: {
        id: procedureId,
        clinicId: params.clinicId,
        stockQty: { lt: 0 },
      },
      data: { stockQty: 0 },
    });
  }
}
