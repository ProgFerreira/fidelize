import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listConsentRecords } from "@/lib/consent";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, Button, Label, Select, Textarea } from "@/components/ui";
import { recordConsentAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function ConsentimentosPage() {
  const session = await requirePermission(PERMISSIONS.CONSENT_MANAGE);
  const clinicId = session.clinicId;
  const [records, patients] = await Promise.all([
    listConsentRecords(clinicId),
    prisma.patient.findMany({
      where: { clinicId: clinicId },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Central de consentimento"
        description="Canal, finalidade, versão do texto e revogação."
      />
      <Card className="mb-6 max-w-3xl">
        <form action={recordConsentAction} className="grid gap-3 md:grid-cols-2">
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
            <Label>Finalidade</Label>
            <Select name="purpose" defaultValue="MARKETING">
              <option value="MARKETING">Marketing</option>
              <option value="SERVICE">Serviço</option>
              <option value="TRANSACTIONAL">Transacional</option>
              <option value="SURVEY">Pesquisas</option>
              <option value="REFERRAL">Indicações</option>
            </Select>
          </div>
          <div>
            <Label>Canal</Label>
            <Select name="channel" defaultValue="WHATSAPP">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="SMS">SMS</option>
              <option value="">Todos</option>
            </Select>
          </div>
          <div>
            <Label>Aceito?</Label>
            <Select name="accepted" defaultValue="true">
              <option value="true">Sim</option>
              <option value="false">Não / Revogar</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Texto aceito</Label>
            <Textarea name="textAccepted" defaultValue="Autorizo comunicações do clube de benefícios." />
          </div>
          <Button type="submit" variant="gold">Registrar</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {records.map((row) => (
          <Card key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{row.patient.fullName}</p>
                <p className="text-sm text-slate-500">
                  {labelPt(row.purpose)} {row.channel ? `· ${labelPt(row.channel)}` : ""} · v{row.version}
                </p>
              </div>
              <Badge tone={row.accepted && !row.revokedAt ? "success" : "warning"}>
                {row.accepted && !row.revokedAt ? "Aceito" : "Revogado/Negado"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
