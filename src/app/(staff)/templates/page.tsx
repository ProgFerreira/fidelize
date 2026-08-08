import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listTemplates, SAFE_VARIABLES } from "@/lib/templates";
import { PageHeader, Card, Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { createTemplateAction, approveTemplateAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function TemplatesPage() {
  const session = await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  const clinicId = session.clinicId;
  const templates = await listTemplates(clinicId);
  const canApprove = session.user.permissions.includes(PERMISSIONS.TEMPLATES_APPROVE);

  return (
    <div>
      <PageHeader
        title="Modelos de mensagens"
        description="Variáveis seguras, versões e aprovação administrativa."
      />
      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Novo modelo</h2>
        <p className="mt-1 text-xs text-slate-500">
          Variáveis: {SAFE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}
        </p>
        <form action={createTemplateAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label>Código</Label>
            <Input name="code" required placeholder="boas_vindas" />
          </div>
          <div>
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Canal</Label>
            <Select name="channel" defaultValue="INTERNAL">
              <option value="INTERNAL">Interno</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="SMS">SMS</option>
            </Select>
          </div>
          <div>
            <Label>Assunto</Label>
            <Input name="subject" />
          </div>
          <div className="md:col-span-2">
            <Label>Corpo</Label>
            <Textarea
              name="body"
              required
              defaultValue="Olá {{nome_paciente}}, seu saldo é {{saldo}}."
            />
          </div>
          <Button type="submit" variant="gold">Salvar rascunho</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {templates.map((tpl) => (
          <Card key={tpl.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {tpl.name}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    v{tpl.version} · {labelPt(tpl.channel)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{tpl.body}</p>
                <p className="mt-1 text-xs text-slate-400">{tpl.body.length} caracteres</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  tone={
                    tpl.approvalStatus === "APPROVED"
                      ? "success"
                      : tpl.approvalStatus === "REJECTED"
                        ? "danger"
                        : "muted"
                  }
                >
                  {labelPt(tpl.approvalStatus)}
                </Badge>
                {canApprove && tpl.approvalStatus !== "APPROVED" && (
                  <form action={approveTemplateAction}>
                    <input type="hidden" name="templateId" value={tpl.id} />
                    <input type="hidden" name="status" value="APPROVED" />
                    <Button type="submit" size="sm">Aprovar</Button>
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
