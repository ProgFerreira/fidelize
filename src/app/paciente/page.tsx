import { PatientLoginForm } from "@/components/patient/login-form";
import { getPatientSession, safePatientCallbackUrl } from "@/lib/otp/session";
import { redirect } from "next/navigation";
import { Stethoscope } from "lucide-react";
import {
  LoginMobileBanner,
  LoginVisual,
} from "@/components/auth/login-visual";

export default async function PacienteLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safePatientCallbackUrl(rawCallbackUrl);

  const session = await getPatientSession();
  if (session) redirect(callbackUrl ?? "/p");

  const contexto = "Portal do paciente";

  return (
    <div className="login-page">
      <LoginVisual />
      <LoginMobileBanner contexto={contexto} />
      <main className="login-panel">
        <div className="login-panel__inner">
          <div className="login-panel__brand">
            <div className="login-panel__brand-icon">
              <Stethoscope aria-hidden />
            </div>
            <div className="login-panel__brand-text">
              <span className="login-panel__brand-name">Fidelize</span>
              <span className="login-panel__brand-sub">{contexto}</span>
            </div>
          </div>
          <h2 className="login-panel__heading">Seu clube de fidelidade</h2>
          <p className="login-panel__lede">
            Acesse com telefone e código temporário.
          </p>
          <PatientLoginForm callbackUrl={callbackUrl ?? undefined} />
        </div>
      </main>
    </div>
  );
}
