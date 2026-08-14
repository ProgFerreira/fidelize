import { PatientLoginForm } from "@/components/patient/login-form";
import { getPatientSession, safePatientCallbackUrl } from "@/lib/otp/session";
import { redirect } from "next/navigation";

export default async function PacienteLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safePatientCallbackUrl(rawCallbackUrl);

  const session = await getPatientSession();
  if (session) redirect(callbackUrl ?? "/p");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <PatientLoginForm callbackUrl={callbackUrl ?? undefined} />
    </div>
  );
}
