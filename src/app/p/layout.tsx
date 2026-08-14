import Link from "next/link";
import { redirect } from "next/navigation";
import { getPatientSession, establishPatientTenantContext } from "@/lib/otp/session";
import { patientLogoutAction } from "@/app/patient-actions";

const links = [
  { href: "/p", label: "Início" },
  { href: "/p/carteira", label: "Carteira" },
  { href: "/p/recompensas", label: "Prêmios" },
  { href: "/p/vouchers", label: "Vouchers" },
  { href: "/p/sorteios", label: "Sorteios" },
  { href: "/p/indicacoes", label: "Indicar" },
  { href: "/p/perfil", label: "Perfil" },
];

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");
  await establishPatientTenantContext(session.clinicId);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 px-4 pb-24 pt-6 dark:bg-slate-950">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Dermaphios
          </p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {session.fullName}
          </p>
        </div>
        <form action={patientLogoutAction}>
          <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
            Sair
          </button>
        </form>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-lg justify-between px-4 py-3 text-xs font-semibold text-slate-500">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-blue-600"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
