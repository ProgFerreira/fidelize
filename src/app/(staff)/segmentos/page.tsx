import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listSegments } from "@/lib/segments";
import { listTags } from "@/lib/tags";
import { PageHeader, Card, Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { createSegmentAction, refreshSegmentAction, createTagAction } from "@/app/v2-actions";

export default async function SegmentosPage() {
  const session = await requirePermission(PERMISSIONS.SEGMENTS_MANAGE);
  const clinicId = session.clinicId;
  const [segments, tags] = await Promise.all([
    listSegments(clinicId),
    listTags(clinicId),
  ]);

  return (
    <div>
      <PageHeader
        title="Segmentos e etiquetas"
        description="Públicos dinâmicos e etiquetas CRM para campanhas."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Nova etiqueta</h2>
          <form action={createTagAction} className="mt-3 grid gap-3">
            <div>
              <Label>Nome</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>Cor</Label>
              <Input name="color" type="color" defaultValue="#64748b" />
            </div>
            <Button type="submit" variant="gold">Criar etiqueta</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag.id} tone="muted">
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ background: tag.color }}
                />
                {tag.name} ({tag._count.assignments})
              </Badge>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Novo segmento</h2>
          <form action={createSegmentAction} className="mt-3 grid gap-3">
            <div>
              <Label>Nome</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea name="description" />
            </div>
            <div>
              <Label>Campo</Label>
              <Select name="field" defaultValue="marketingConsent">
                <option value="marketingConsent">Consentimento marketing</option>
                <option value="minSpend">Gasto mínimo anual</option>
                <option value="minPoints">Pontos mínimos</option>
                <option value="minBalance">Saldo mínimo</option>
                <option value="minAppointments">Qtd. atendimentos</option>
                <option value="birthMonth">Mês de aniversário</option>
                <option value="tag">Etiqueta</option>
                <option value="categoryId">Categoria</option>
                <option value="unitId">Unidade</option>
              </Select>
            </div>
            <div>
              <Label>Operador</Label>
              <Select name="operator" defaultValue="eq">
                <option value="eq">Igual</option>
                <option value="gte">Maior ou igual</option>
                <option value="lte">Menor ou igual</option>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <Input name="value" placeholder="true / 100 / slug ou id" required />
            </div>
            <Button type="submit" variant="gold">Salvar segmento</Button>
          </form>
        </Card>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => (
          <Card key={segment.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{segment.name}</p>
                <p className="text-sm text-slate-500">{segment.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Regras: {segment.rules.map((r) => `${r.field} ${r.operator}`).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="muted">{segment.estimatedCount ?? 0} destinatários</Badge>
                <form action={refreshSegmentAction}>
                  <input type="hidden" name="segmentId" value={segment.id} />
                  <Button type="submit" size="sm" variant="secondary">Atualizar contagem</Button>
                </form>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
