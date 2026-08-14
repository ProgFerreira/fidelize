import { requirePatientSession } from "@/lib/otp/session";
import {
  ensureReferralLink,
  referralQrUrl,
  referralShareUrl,
} from "@/lib/referrals";
import { isModuleEnabled } from "@/lib/modules";
import { PageHeader, Card, Button } from "@/components/ui";

export default async function PortalIndicacoesPage() {
  const session = await requirePatientSession();

  if (!(await isModuleEnabled(session.clinicId, "REFERRAL"))) {
    return (
      <div>
        <PageHeader title="Indicações" description="Módulo desativado no momento." />
      </div>
    );
  }

  const { referral } = await ensureReferralLink({
    clinicId: session.clinicId,
    patientId: session.patientId,
  });

  const link = referralShareUrl(referral.shortCode);
  const qr = referralQrUrl(referral.shortCode);
  const wa = `https://wa.me/?text=${encodeURIComponent(
    `Venha para o clube de benefícios! ${link}`,
  )}`;

  return (
    <div>
      <PageHeader
        title="Indique e ganhe"
        description="Compartilhe seu link exclusivo."
      />
      <Card>
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code" width={180} height={180} className="rounded-md border" />
          <p className="text-sm text-slate-600">Seu código: {referral.shortCode}</p>
          <p className="break-all font-mono text-sm">{link}</p>
          <a href={wa} target="_blank" rel="noreferrer">
            <Button type="button" variant="gold">Compartilhar no WhatsApp</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
