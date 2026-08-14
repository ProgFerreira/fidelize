import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listPushDevices } from "@/lib/push";
import { getProvidersConfig, providersStatusSummary } from "@/lib/providers";
import { CabecalhoPagina, Card, Badge, StatCard } from "@/components/ui";

export default async function PushPage() {
  const session = await requirePermission(PERMISSIONS.PUSH_MANAGE);
  const clinicId = session.clinicId;
  const [devices, config] = await Promise.all([
    listPushDevices(clinicId),
    getProvidersConfig(clinicId),
  ]);
  const status = providersStatusSummary(config);

  return (
    <div>
      <CabecalhoPagina
        titulo="Push nativo"
        descricao="Devices registrados (iOS/Android/Web) e status do provedor FCM."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Devices ativos" value={String(devices.length)} />
        <StatCard label="Provedor push" value={status.push} />
        <StatCard label="WhatsApp" value={status.whatsapp} />
        <StatCard label="E-mail / SMS" value={`${status.email} / ${status.sms}`} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Devices</h2>
        <div className="mt-3 space-y-2">
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum device. Apps white-label registram via{" "}
              <code className="text-xs">/api/v1/mobile/push/register</code>.
            </p>
          ) : (
            devices.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">{d.patient.fullName}</p>
                  <p className="text-xs text-slate-400">
                    {d.platform} · {d.token.slice(0, 16)}…
                  </p>
                </div>
                <Badge tone="success">ativo</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
