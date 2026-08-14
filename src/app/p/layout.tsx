import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPatientSession, establishPatientTenantContext } from "@/lib/otp/session";
import { patientLogoutAction } from "@/app/patient-actions";
import { HEADER_PATHNAME } from "@/lib/organization-host";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui";
import { QueryToast } from "@/components/ui/query-toast";
import { PatientNav } from "@/components/patient/patient-nav";
import { isModuleEnabled } from "@/lib/modules";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPatientSession();
  if (!session) {
    const pathname = (await headers()).get(HEADER_PATHNAME);
    redirect(
      pathname && pathname !== "/p"
        ? `/paciente?callbackUrl=${encodeURIComponent(pathname)}`
        : "/paciente",
    );
  }
  await establishPatientTenantContext(session.clinicId);

  const clinic = await prisma.clinic.findFirst({
    where: { id: session.clinicId },
    select: { name: true, tradeName: true },
  });
  const clinicName = clinic?.tradeName || clinic?.name || "Clube de fidelidade";
  const [referralOn, vouchersOn, rafflesOn] = await Promise.all([
    isModuleEnabled(session.clinicId, "REFERRAL"),
    isModuleEnabled(session.clinicId, "VOUCHERS"),
    isModuleEnabled(session.clinicId, "RAFFLES"),
  ]);

  return (
    <div className="portal-light mx-auto min-h-screen max-w-lg bg-slate-50 px-4 pb-24 pt-6 text-slate-900">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">
            {clinicName}
          </p>
          <p className="text-xl font-semibold text-slate-900">{session.fullName}</p>
        </div>
        <form action={patientLogoutAction}>
          <Button type="submit" variante="fantasma" tamanho="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
      <Suspense fallback={null}>
        <QueryToast
          mensagens={{
            resgatado: { mensagem: "Recompensa resgatada" },
            bilhete: { mensagem: "Bilhete comprado" },
            salvo: { mensagem: "Preferências salvas" },
          }}
        />
      </Suspense>
      <PatientNav
        modules={{
          REFERRAL: referralOn,
          VOUCHERS: vouchersOn,
          RAFFLES: rafflesOn,
        }}
      />
    </div>
  );
}
