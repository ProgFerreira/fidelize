import { prisma } from "@/lib/db";
import { requirePatientSession } from "@/lib/otp/session";
import { Card, Button, Label } from "@/components/ui";
import { updatePatientPreferencesAction } from "@/app/patient-actions";
import { LgpdPatientActions } from "@/components/patient/lgpd-actions";

export default async function PerfilPage() {
  const session = await requirePatientSession();

  const patient = await prisma.patient.findFirst({
    where: { id: session.patientId, clinicId: session.clinicId },
    include: {
      communicationPreferences: true,
    },
  });

  const pref = (channel: string) =>
    patient?.communicationPreferences.find(
      (p) => p.channel === channel && p.purpose === "MARKETING",
    )?.allowed ?? patient?.marketingConsent;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-slate-900">Perfil</h1>
      <Card className="space-y-2 text-sm">
        <p>
          <strong>Nome:</strong> {patient?.fullName}
        </p>
        <p>
          <strong>Telefone:</strong> {patient?.phone}
        </p>
        <p>
          <strong>E-mail:</strong> {patient?.email ?? "—"}
        </p>
      </Card>

      <Card>
        <h2 className="text-xl">Preferências de comunicação</h2>
        <form
          action={updatePatientPreferencesAction}
          className="mt-3 space-y-3 text-sm"
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="marketingConsent"
              defaultChecked={Boolean(patient?.marketingConsent)}
            />
            Autorizo mensagens de marketing do clube
          </label>
          <div className="grid gap-2 pl-1">
            <Label>Canais</Label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="whatsapp"
                defaultChecked={Boolean(pref("WHATSAPP"))}
              />
              WhatsApp
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="email"
                defaultChecked={Boolean(pref("EMAIL"))}
              />
              E-mail
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="sms"
                defaultChecked={Boolean(pref("SMS"))}
              />
              SMS
            </label>
          </div>
          <Button type="submit" variant="gold">
            Salvar preferências
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-xl">LGPD</h2>
        <p className="mt-2 text-sm text-slate-500">
          Você pode exportar uma cópia dos seus dados comerciais do clube ou
          solicitar a anonimização (exclusão prática do titular). Lançamentos
          financeiros são preservados de forma não identificável para auditoria.
        </p>
        <LgpdPatientActions />
      </Card>
    </div>
  );
}
