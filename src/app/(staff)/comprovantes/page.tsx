import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listReceipts } from "@/lib/receipts";
import { CabecalhoPagina, Card, Badge, Button, Input, Select, Campo } from "@/components/ui";
import { submitReceiptAction, reviewReceiptAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";
import { formatBRL } from "@/lib/money";
import { prisma } from "@/lib/db";

export default async function ComprovantesPage() {
  const session = await requirePermission(PERMISSIONS.RECEIPTS_MANAGE);
  const clinicId = session.clinicId;
  const [receipts, patients] = await Promise.all([
    listReceipts(clinicId),
    prisma.patient.findMany({
      where: { clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      take: 100,
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div>
      <CabecalhoPagina
        titulo="Comprovantes"
        descricao="Upload com OCR, score antifraude e crédito após aprovação."
      />

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Registrar comprovante</h2>
        <form action={submitReceiptAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo label="Paciente" obrigatorio>
              <Select name="patientId" required>
                <option value="">Selecione</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>
          <div className="md:col-span-2">
            <Campo label="URL da imagem">
              <Input name="imageUrl" type="url" placeholder="https://..." />
            </Campo>
          </div>
          <Campo label="Valor declarado">
            <Input name="declaredAmount" type="number" step="0.01" />
          </Campo>
          <Campo label="Estabelecimento">
            <Input name="merchantName" />
          </Campo>
          <Button type="submit" variante="gold">Enviar para OCR</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {receipts.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.patient.fullName}</p>
                <p className="text-sm text-slate-500">
                  {r.merchantName ?? "—"} ·{" "}
                  {r.extractedAmount ? formatBRL(r.extractedAmount) : "sem valor OCR"}
                </p>
                <p className="text-xs text-slate-400">
                  Score fraude: {r.fraudScore}
                  {Array.isArray(r.fraudFlags)
                    ? ` · ${(r.fraudFlags as string[]).join(", ")}`
                    : ""}
                </p>
              </div>
              <Badge
                tone={
                  r.status === "CREDITED"
                    ? "success"
                    : r.status === "REJECTED"
                      ? "danger"
                      : "muted"
                }
              >
                {labelPt(r.status)}
              </Badge>
            </div>
            {r.status === "NEEDS_REVIEW" || r.status === "PROCESSING" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={reviewReceiptAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="receiptId" value={r.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <Campo label="Crédito">
                    <Input
                      name="creditAmount"
                      type="number"
                      step="0.01"
                      defaultValue={r.extractedAmount ? String(r.extractedAmount) : ""}
                      className="w-28"
                    />
                  </Campo>
                  <Button type="submit" tamanho="sm" variante="gold">
                    Aprovar
                  </Button>
                </form>
                <form action={reviewReceiptAction}>
                  <input type="hidden" name="receiptId" value={r.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <Button type="submit" tamanho="sm" variante="perigo">
                    Rejeitar
                  </Button>
                </form>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
