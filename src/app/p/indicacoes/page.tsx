import { requirePatientSession } from "@/lib/otp/session";
import {
  ensureReferralLink,
  getReferrerStats,
  referralQrUrl,
  referralShareUrl,
} from "@/lib/referrals";
import { isModuleEnabled } from "@/lib/modules";
import { CabecalhoPagina, Card, Button } from "@/components/ui";

export default async function PortalIndicacoesPage() {
  const session = await requirePatientSession();

  if (!(await isModuleEnabled(session.clinicId, "REFERRAL"))) {
    return (
      <div>
        <CabecalhoPagina titulo="Indicações" descricao="Módulo desativado no momento." />
      </div>
    );
  }

  const { referral } = await ensureReferralLink({
    clinicId: session.clinicId,
    patientId: session.patientId,
  });
  const stats = await getReferrerStats(session.clinicId, session.patientId);

  const link = referralShareUrl(referral.shortCode);
  const qr = referralQrUrl(referral.shortCode);
  const wa = `https://wa.me/?text=${encodeURIComponent(
    `Venha para o clube de benefícios! ${link}`,
  )}`;

  return (
    <div>
      <CabecalhoPagina
        titulo="Indique e ganhe"
        descricao="Compartilhe seu link exclusivo."
      />
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card>
          <p className="text-xs text-slate-500">Cadastraram</p>
          <p className="text-2xl font-semibold">{stats.cadastrados}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Vieram</p>
          <p className="text-2xl font-semibold">{stats.vieram}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Convertidos</p>
          <p className="text-2xl font-semibold">{stats.convertidos}</p>
        </Card>
      </div>
      <Card>
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code" width={180} height={180} className="rounded-md border" />
          <p className="text-sm text-slate-600">Seu código: {referral.shortCode}</p>
          <p className="break-all font-mono text-sm">{link}</p>
          <a href={wa} target="_blank" rel="noreferrer">
            <Button type="button" variante="gold">Compartilhar no WhatsApp</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
