import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOnboardingProgress } from "@/lib/onboarding";
import { CabecalhoPagina, Card, Badge, Button } from "@/components/ui";
import { completeOnboardingStepAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function ImplantacaoPage() {
  const session = await requirePermission(PERMISSIONS.ONBOARDING_MANAGE);
  const clinicId = session.clinicId;
  const progress = await getOnboardingProgress(clinicId);

  return (
    <div>
      <CabecalhoPagina
        titulo="Assistente de implantação"
        descricao={`${progress.percent}% concluído · ${progress.pending.length} pendência(s)`}
      />
      <Card className="mb-6">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-600">Checklist de publicação</p>
        <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2">
          {Object.entries(progress.publishReady).map(([key, ok]) => (
            <li key={key} className="flex items-center gap-2">
              <Badge tone={ok ? "success" : "warning"}>{ok ? "OK" : "Pendente"}</Badge>
              <span>{labelPt(key)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-3">
        {progress.steps.map((step) => (
          <Card key={step.step}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm text-slate-500">{step.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={step.completed ? "success" : "muted"}>
                  {step.completed ? "Concluído" : "Pendente"}
                </Badge>
                {!step.completed && (
                  <form action={completeOnboardingStepAction}>
                    <input type="hidden" name="step" value={step.step} />
                    <input type="hidden" name="completed" value="true" />
                    <Button type="submit" tamanho="sm">Marcar concluído</Button>
                  </form>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
