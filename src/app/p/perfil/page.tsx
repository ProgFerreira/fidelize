import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPatientSession } from "@/lib/otp/session";
import { Card, Button, Label } from "@/components/ui";
import { updatePatientPreferencesAction } from "@/app/patient-actions";

export default async function PerfilPage() {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

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
        <p><strong>Nome:</strong> {patient?.fullName}</p>
        <p><strong>Telefone:</strong> {patient?.phone}</p>
        <p><strong>E-mail:</strong> {patient?.email ?? "—"}</p>
      </Card>

      <Card>
        <h2 className="text-xl">Preferências de comunicação</h2>
        <form action={updatePatientPreferencesAction} className="mt-3 space-y-3 text-sm">
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
              <input type="checkbox" name="whatsapp" defaultChecked={Boolean(pref("WHATSAPP"))} />
              WhatsApp
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="email" defaultChecked={Boolean(pref("EMAIL"))} />
              E-mail
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="sms" defaultChecked={Boolean(pref("SMS"))} />
              SMS
            </label>
          </div>
          <Button type="submit" variant="gold">Salvar preferências</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-xl">LGPD</h2>
        <p className="mt-2 text-sm text-slate-500">
          Você pode solicitar acesso, correção ou exclusão de dados comerciais
          do clube. Dados clínicos nunca são armazenados neste sistema.
        </p>
      </Card>
    </div>
  );
}
