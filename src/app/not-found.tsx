import Link from "next/link";
import { classesBotao } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-blue-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Página não encontrada
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        O endereço pode ter mudado ou você não tem acesso a esta tela.
      </p>
      <Link href="/" className={classesBotao({ className: "mt-6" })}>
        Voltar ao início
      </Link>
    </div>
  );
}
