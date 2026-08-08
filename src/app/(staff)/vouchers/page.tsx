import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listVouchers } from "@/lib/vouchers";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { createVoucherAction, redeemVoucherAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function VouchersPage() {
  const session = await requirePermission(PERMISSIONS.VOUCHERS_MANAGE);
  const clinicId = session.clinicId;
  const [vouchers, patients] = await Promise.all([
    listVouchers(clinicId),
    prisma.patient.findMany({
      where: { clinicId: clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      take: 100,
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Cupons" description="Cupons rastreáveis com código único." />
      <Card className="mb-6 max-w-3xl">
        <form action={createVoucherAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select name="type" defaultValue="FIXED_VALUE">
              <option value="FIXED_VALUE">Valor fixo</option>
              <option value="PERCENT">Percentual</option>
              <option value="COURTESY">Cortesia</option>
              <option value="BIRTHDAY">Aniversário</option>
              <option value="RECOVERY">Recuperação</option>
            </Select>
          </div>
          <div>
            <Label>Valor</Label>
            <Input name="valueAmount" type="number" step="0.01" />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input name="quantity" type="number" />
          </div>
          <div>
            <Label>Validade</Label>
            <Input name="expiresAt" type="datetime-local" />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea name="description" />
          </div>
          <Button type="submit" variant="gold">Emitir</Button>
        </form>
      </Card>

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Resgatar voucher</h2>
        <form action={redeemVoucherAction} className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <Label>Código</Label>
            <Input name="code" required />
          </div>
          <div>
            <Label>Paciente</Label>
            <Select name="patientId" required>
              <option value="">Selecione</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit">Resgatar</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {vouchers.map((v) => (
          <Card key={v.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{v.name}</p>
                <p className="text-sm text-slate-500">
                  {v.code} · {labelPt(v.type)} · usos {v.usedCount}/{v.quantity ?? "∞"}
                </p>
              </div>
              <Badge tone={v.status === "ACTIVE" ? "success" : "muted"}>{labelPt(v.status)}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
