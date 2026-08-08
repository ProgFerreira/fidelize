import { Card, Input, Label, Button } from "@/components/ui";
import { requestPasswordResetAction } from "@/app/actions";
import Link from "next/link";

export default function RecuperarSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Card className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Recuperar senha
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Enviaremos um link de redefinição (simulado em desenvolvimento).
          </p>
        </div>
        <form action={requestPasswordResetAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" className="w-full">
            Enviar
          </Button>
        </form>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Voltar ao login
        </Link>
      </Card>
    </div>
  );
}
