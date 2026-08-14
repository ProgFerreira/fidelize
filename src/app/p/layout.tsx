import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPatientSession, establishPatientTenantContext } from "@/lib/otp/session";
import { patientLogoutAction } from "@/app/patient-actions";
import { HEADER_PATHNAME } from "@/lib/organization-host";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const links = [
  { href: "/p", label: "Início" },
  { href: "/p/carteira", label: "Carteira" },
  { href: "/p/extrato", label: "Extrato" },
  { href: "/p/recompensas", label: "Prêmios" },
  { href: "/p/beneficios", label: "Benefícios" },
  { href: "/p/perfil", label: "Perfil" },
];

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
  const pathname = (await headers()).get(HEADER_PATHNAME) ?? "/p";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 px-4 pb-24 pt-6 dark:bg-slate-950">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {clinicName}
          </p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {session.fullName}
          </p>
        </div>
        <form action={patientLogoutAction}>
          <Button type="submit" variante="fantasma" tamanho="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
      <nav
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
        aria-label="Menu do paciente"
      >
        <div className="mx-auto flex max-w-lg justify-between px-2 py-2 text-[11px] font-semibold text-slate-500 sm:px-4 sm:text-xs">
          {links.map((link) => {
            const atual =
              link.href === "/p"
                ? pathname === "/p"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "rounded-md px-1.5 py-1 hover:text-blue-600",
                  atual && "text-blue-600",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
