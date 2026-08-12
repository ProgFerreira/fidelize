"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Campo, Input, Card } from "@/components/ui";
import {
  createOrganizationAction,
  startSupportAction,
} from "@/app/actions/tenant";

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  tradeName: string | null;
  plan: string;
  active: boolean;
  suspendedAt: Date | null;
  createdAt: Date;
  _count: { clinics: number; users: number };
};

export function OrganizacoesPainel({ initial }: { initial: OrgRow[] }) {
  const [orgs, setOrgs] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdCred, setCreatedCred] = useState<{
    slug: string;
    adminEmail: string;
    senhaProvisoria: string;
  } | null>(null);
  const { update } = useSession();
  const router = useRouter();

  function onCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createOrganizationAction(formData);
        setCreatedCred({
          slug: result.slug,
          adminEmail: result.adminEmail,
          senhaProvisoria: result.senhaProvisoria,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao criar");
      }
    });
  }

  function onSupport(orgId: string) {
    const reason = window.prompt(
      "Motivo do acesso de suporte (mín. 10 caracteres):",
    );
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("organizationId", orgId);
        fd.set("reason", reason);
        const result = await startSupportAction(fd);
        await update({
          suporteAcessoId: result.acessoId,
          organizationId: result.organizationId,
          organizationSlug: null,
          suporteMotivo: result.reason,
          suporteOrganizacaoNome: result.organizationName,
        });
        window.location.assign("/dashboard");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha no suporte");
      }
    });
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {createdCred ? (
        <Card>
          <p className="text-sm text-slate-700">
            Organização <strong>{createdCred.slug}</strong> criada. Admin:{" "}
            <strong>{createdCred.adminEmail}</strong> / senha provisória:{" "}
            <strong>{createdCred.senhaProvisoria}</strong>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Acesse em {createdCred.slug}.localhost
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 text-lg font-medium">Nova organização</h2>
        <form action={onCreate} className="grid gap-3 sm:grid-cols-2">
          <Campo label="Slug" obrigatorio>
            <Input name="slug" required placeholder="clinica-xyz" />
          </Campo>
          <Campo label="Nome" obrigatorio>
            <Input name="name" required />
          </Campo>
          <Campo label="Nome fantasia">
            <Input name="tradeName" />
          </Campo>
          <Campo label="Documento">
            <Input name="document" />
          </Campo>
          <Campo label="E-mail admin" obrigatorio>
            <Input name="adminEmail" type="email" required />
          </Campo>
          <Campo label="Nome admin">
            <Input name="adminName" />
          </Campo>
          <Campo label="Código afiliado (opcional)">
            <Input name="affiliateCode" placeholder="ex: abc12xyz" />
          </Campo>
          <div className="sm:col-span-2">
            <Button type="submit" carregando={pending}>
              Criar organização
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {orgs.map((org) => (
          <Card key={org.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {org.name}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    ({org.slug})
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {org._count.clinics} clínicas · {org._count.users} usuários ·{" "}
                  {org.plan}
                  {!org.active || org.suspendedAt ? " · suspensa" : ""}
                </p>
              </div>
              <Button
                type="button"
                variante="secundario"
                carregando={pending}
                onClick={() => onSupport(org.id)}
              >
                Entrar em suporte
              </Button>
            </div>
          </Card>
        ))}
        {orgs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma organização ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
