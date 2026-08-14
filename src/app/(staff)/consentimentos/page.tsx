import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listConsentRecords } from "@/lib/consent";
import { prisma } from "@/lib/db";
import { CabecalhoPagina, Card, Badge, Button, Select, Textarea, Campo } from "@/components/ui";
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
      <CabecalhoPagina
        titulo="Central de consentimento"
        descricao="Canal, finalidade, versão do texto e revogação."
      />
      <Card className="mb-6 max-w-3xl">
        <form action={recordConsentAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo label="Paciente" obrigatorio>
              <Select name="patientId" required>
                <option value="">Selecione</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
            </Campo>
          </div>
          <Campo label="Finalidade">
            <Select name="purpose" defaultValue="MARKETING">
              <option value="MARKETING">Marketing</option>
              <option value="SERVICE">Serviço</option>
              <option value="TRANSACTIONAL">Transacional</option>
              <option value="SURVEY">Pesquisas</option>
              <option value="REFERRAL">Indicações</option>
            </Select>
          </Campo>
          <Campo label="Canal">
            <Select name="channel" defaultValue="WHATSAPP">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="SMS">SMS</option>
              <option value="">Todos</option>
            </Select>
          </Campo>
          <Campo label="Aceito?">
            <Select name="accepted" defaultValue="true">
              <option value="true">Sim</option>
              <option value="false">Não / Revogar</option>
            </Select>
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Texto aceito">
              <Textarea name="textAccepted" defaultValue="Autorizo comunicações do clube de benefícios." />
            </Campo>
          </div>
          <Button type="submit" variante="gold">Registrar</Button>
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
