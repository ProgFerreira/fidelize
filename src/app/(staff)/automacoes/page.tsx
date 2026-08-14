import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listAutomations } from "@/lib/automations";
import { CabecalhoPagina, Card, Badge, Button, Input, Select, Textarea, Campo } from "@/components/ui";
import {
  createAutomationAction,
  setAutomationStatusAction,
  seedAutomationsAction,
  duplicateAutomationAction,
} from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function AutomacoesPage() {
  const session = await requirePermission(PERMISSIONS.AUTOMATIONS_MANAGE);
  const clinicId = session.clinicId;
  const automations = await listAutomations(clinicId);

  return (
    <div>
      <CabecalhoPagina
        titulo="Automações"
        descricao="Motor gatilho → condição → ação, com idempotência."
      />
      <form action={seedAutomationsAction} className="mb-4">
        <Button type="submit" variante="secundario">Carregar modelos iniciais</Button>
      </form>

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Nova automação</h2>
        <form action={createAutomationAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <Campo label="Nome" obrigatorio>
            <Input name="name" required />
          </Campo>
          <Campo label="Gatilho">
            <Select name="trigger" defaultValue="PATIENT_REGISTERED">
              <option value="PATIENT_REGISTERED">Paciente cadastrado</option>
              <option value="PAYMENT_CONFIRMED">Pagamento confirmado</option>
              <option value="BIRTHDAY">Aniversário</option>
              <option value="BALANCE_EXPIRING">Saldo expirando</option>
              <option value="PATIENT_INACTIVE">Paciente inativo</option>
              <option value="NPS_RESPONDED">NPS respondido</option>
              <option value="REFERRAL_CONVERTED">Indicação convertida</option>
            </Select>
          </Campo>
          <Campo label="Ação">
            <Select name="actionType" defaultValue="SEND_INTERNAL">
              <option value="SEND_INTERNAL">Notificação interna</option>
              <option value="SEND_WHATSAPP">WhatsApp</option>
              <option value="SEND_EMAIL">E-mail</option>
              <option value="CREDIT_POINTS">Conceder pontos</option>
              <option value="APPLY_TAG">Aplicar etiqueta</option>
              <option value="ISSUE_VOUCHER">Emitir voucher</option>
              <option value="CREATE_TASK">Criar tarefa</option>
            </Select>
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Mensagem / config">
              <Textarea name="body" defaultValue="Olá {{nome_paciente}}!" />
            </Campo>
          </div>
          <Button type="submit" variante="gold">Criar</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {automations.map((auto) => (
          <Card key={auto.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{auto.name}</p>
                <p className="text-sm text-slate-500">
                  {labelPt(auto.trigger)} · {auto.versions[0]?.steps.length ?? 0} passo(s) ·{" "}
                  {auto._count.executions} execuções
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={auto.status === "ACTIVE" ? "success" : "muted"}>
                  {labelPt(auto.status)}
                </Badge>
                <form action={setAutomationStatusAction}>
                  <input type="hidden" name="automationId" value={auto.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={auto.status === "ACTIVE" ? "PAUSED" : "ACTIVE"}
                  />
                  <Button type="submit" tamanho="sm" variante="secundario">
                    {auto.status === "ACTIVE" ? "Pausar" : "Ativar"}
                  </Button>
                </form>
                <form action={duplicateAutomationAction}>
                  <input type="hidden" name="automationId" value={auto.id} />
                  <Button type="submit" tamanho="sm" variante="contorno">
                    Duplicar
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
