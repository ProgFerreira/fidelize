import { prisma } from "@/lib/db";
import {
  registerReferralLead,
  referralQrUrl,
  referralShareUrl,
} from "@/lib/referrals";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

async function submitLead(formData: FormData) {
  "use server";
  const shortCode = String(formData.get("shortCode") || "");
  const referral = await semOrganizacao(() =>
    prisma.referral.findFirst({
      where: { shortCode },
      select: { clinicId: true, organizationId: true },
    }),
  );
  if (!referral?.organizationId) throw new Error("Link de indicação inválido");
  await comOrganizacao({ organizationId: referral.organizationId }, () =>
    registerReferralLead({
      clinicId: referral.clinicId,
      shortCode,
      leadName: String(formData.get("leadName") || ""),
      leadPhone: String(formData.get("leadPhone") || ""),
      leadCpf: String(formData.get("leadCpf") || "") || null,
      leadConsent: formData.get("leadConsent") === "on",
    }),
  );
}

export default async function IndicacaoPublicaPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const referral = await semOrganizacao(() =>
    prisma.referral.findFirst({
      where: { shortCode: code },
      include: {
        referrer: { select: { fullName: true } },
        program: true,
        clinic: { select: { name: true, tradeName: true } },
      },
    }),
  );

  if (!referral) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <PageHeader title="Link inválido" description="Esta indicação não existe ou expirou." />
      </div>
    );
  }

  const alreadyUsed = Boolean(referral.leadPhone || referral.referredId);
  const shareUrl = referralShareUrl(code);
  const qr = referralQrUrl(code);

  return (
    <div className="mx-auto max-w-lg p-6">
      <PageHeader
        title={referral.clinic.tradeName ?? referral.clinic.name}
        description={`${referral.referrer.fullName} indicou você ao clube de benefícios.`}
      />
      <Card>
        <p className="text-sm text-slate-600">
          Ao realizar seu primeiro atendimento elegível, ambos podem receber benefícios do programa{" "}
          {referral.program.name}.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code de indicação" width={160} height={160} className="rounded-md border" />
          <p className="break-all text-xs text-slate-500">{shareUrl}</p>
        </div>
        {alreadyUsed ? (
          <p className="mt-4 text-sm text-emerald-700">
            Cadastro recebido. Compareça à clínica para converter a indicação no primeiro atendimento.
          </p>
        ) : (
          <form action={submitLead} className="mt-4 grid gap-3">
            <input type="hidden" name="shortCode" value={code} />
            <div>
              <Label>Seu nome</Label>
              <Input name="leadName" required />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input name="leadPhone" required />
            </div>
            <div>
              <Label>CPF (opcional)</Label>
              <Input name="leadCpf" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="leadConsent" required className="mt-1" />
              Autorizo o contato da clínica sobre o clube de benefícios.
            </label>
            <Button type="submit" variant="gold">Quero participar</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
