import { PatientLoginForm } from "@/components/patient/login-form";
import { getPatientSession } from "@/lib/otp/session";
import { redirect } from "next/navigation";

export default async function PacienteLoginPage() {
  const session = await getPatientSession();
  if (session) redirect("/p");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <PatientLoginForm />
    </div>
  );
}
