import { requirePatientSession } from "@/lib/otp/session";
import { getProgramRegulation } from "@/lib/benefits/regulation";
import { CabecalhoPagina, Card } from "@/components/ui";

export default async function RegulamentoPage() {
  const session = await requirePatientSession();
  const rules = await getProgramRegulation(session.clinicId);

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Regulamento"
        descricao={`Regras do ${rules.clinicName}.`}
      />
      <Card>
        <ul className="space-y-2 text-sm text-slate-700">
          {rules.rules.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
          {rules.maxCashbackLabel ? (
            <li>• Teto de cashback por atendimento: {rules.maxCashbackLabel}.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
