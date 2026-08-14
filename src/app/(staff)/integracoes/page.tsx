import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listIntegrations } from "@/lib/integrations";
import { CabecalhoPagina, Card, Badge, Button, Input, Select, Campo } from "@/components/ui";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  createWebhookAction,
  addWidgetOriginAction,
} from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";
import { getProvidersConfig, providersStatusSummary } from "@/lib/providers";
import { listWidgetOrigins, widgetEmbedSnippet } from "@/lib/widget";
import { describeMobileWhiteLabel } from "@/lib/mobile/contract";
import { CLINICAL_CONNECTORS, clinicalConnectorDocs } from "@/lib/connectors/clinical";
import { observabilityStatus } from "@/lib/observability";
import { prisma } from "@/lib/db";

export default async function IntegracoesPage() {
  const session = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE);
  const clinicId = session.clinicId;
  const [data, providers, origins, clinic] = await Promise.all([
    listIntegrations(clinicId),
    getProvidersConfig(clinicId),
    listWidgetOrigins(clinicId),
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { slug: true },
    }),
  ]);
  const status = providersStatusSummary(providers);
  const mobile = describeMobileWhiteLabel();
  const obs = observabilityStatus();
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  const snippet = widgetEmbedSnippet(baseUrl, clinic?.slug || clinicId);
  const connectorDocs = clinicalConnectorDocs(baseUrl);

  return (
    <div>
      <CabecalhoPagina
        titulo="Integrações"
        descricao="Chaves de API, webhooks, conectores clínicos, provedores, widget e contrato mobile."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <p className="text-xs uppercase text-slate-400">E-mail</p>
          <p className="font-semibold">{status.email}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">SMS</p>
          <p className="font-semibold">{status.sms}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">WhatsApp</p>
          <p className="font-semibold">{status.whatsapp}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Push</p>
          <p className="font-semibold">{status.push}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Observabilidade</p>
          <p className="font-semibold">
            {obs.sentryConfigured ? "Sentry" : "log local"}
          </p>
        </Card>
      </div>

      {status.whatsapp === "simulated" || status.email === "simulated" ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Canais em modo simulado. Configure RESEND_API_KEY, WHATSAPP_TOKEN e
            WHATSAPP_PHONE_NUMBER_ID no .env para piloto real. Webhook de saldo:
            POST /api/webhooks/whatsapp (WHATSAPP_VERIFY_TOKEN).
          </p>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Nova chave de API</h2>
          <form action={createApiKeyAction} className="mt-3 grid gap-3">
            <Campo label="Nome" obrigatorio>
              <Input name="name" required defaultValue="Integração clínica" />
            </Campo>
            <Campo label="Ambiente">
              <Select name="environment" defaultValue="test">
                <option value="test">Teste</option>
                <option value="live">Produção</option>
              </Select>
            </Campo>
            <Button type="submit" variante="gold">
              Gerar chave
            </Button>
            <p className="text-xs text-slate-500">
              Use a chave no header x-api-key — nunca na URL do widget.
            </p>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Webhook</h2>
          <form action={createWebhookAction} className="mt-3 grid gap-3">
            <Campo label="URL" obrigatorio>
              <Input name="url" type="url" required placeholder="https://..." />
            </Campo>
            <Campo label="Eventos (separados por vírgula)">
              <Input
                name="events"
                defaultValue="appointment.confirmed,*,referral.converted"
              />
            </Campo>
            <Button type="submit">Salvar endpoint</Button>
          </form>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Conectores clínicos</h2>
      <Card className="mb-8">
        <p className="text-sm text-slate-500">
          Ingestão de atendimentos via {connectorDocs.endpoints.ingest}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {CLINICAL_CONNECTORS.map((c) => (
            <li key={c.code}>
              <strong>{c.name}</strong> — {c.description}
            </li>
          ))}
        </ul>
        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify(connectorDocs.sample, null, 2)}
        </pre>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Credenciais</h2>
      <div className="mb-8 space-y-3">
        {data.credentials.map((cred) => (
          <Card key={cred.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{cred.name}</p>
                <p className="text-sm text-slate-500">
                  {cred.keyPrefix}… · {labelPt(cred.environment)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={cred.revokedAt ? "danger" : "success"}>
                  {cred.revokedAt ? "Revogada" : "Ativa"}
                </Badge>
                {!cred.revokedAt && (
                  <form action={revokeApiKeyAction}>
                    <input type="hidden" name="credentialId" value={cred.id} />
                    <Button type="submit" tamanho="sm" variante="perigo">
                      Revogar
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Webhooks</h2>
      <div className="mb-8 space-y-3">
        {data.webhooks.map((wh) => (
          <Card key={wh.id}>
            <p className="font-semibold">{wh.url}</p>
            <p className="text-sm text-slate-500">
              {(wh.events as string[]).join(", ")} · {wh._count.deliveries}{" "}
              entregas
            </p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Widget incorporável</h2>
      <Card className="mb-8">
        <form action={addWidgetOriginAction} className="mb-4 flex flex-wrap gap-2">
          <Input
            name="origin"
            placeholder="https://seusite.com.br"
            required
            className="max-w-md"
          />
          <Button type="submit" variante="secundario">
            Permitir origem
          </Button>
        </form>
        <p className="mb-2 text-sm text-slate-500">
          Origens: {origins.map((o) => o.origin).join(", ") || "nenhuma"}
        </p>
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {snippet}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Embed usa clinic + allowlist (sem API key na URL). Mobile v
          {mobile.version}
        </p>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Logs recentes</h2>
      <div className="space-y-2">
        {data.logs.map((log) => (
          <Card key={log.id}>
            <p className="text-sm">
              {labelPt(log.direction)} {log.method} {log.path} ·{" "}
              {log.statusCode ?? "—"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
