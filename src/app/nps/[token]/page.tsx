import { prisma } from "@/lib/db";
import { submitNpsResponse } from "@/lib/nps";
import { semOrganizacao } from "@/lib/tenant";
import { Card, CabecalhoPagina, classesBotao } from "@/components/ui";
import { NpsForm } from "@/components/nps/nps-form";
import Link from "next/link";

async function submitNps(formData: FormData) {
  "use server";
  await submitNpsResponse({
    token: String(formData.get("token") || ""),
    score: Number(formData.get("score")),
    comment: String(formData.get("comment") || "") || null,
  });
}

export default async function NpsPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await semOrganizacao(() =>
    prisma.surveyResponse.findFirst({
      where: { token },
      include: {
        survey: { include: { clinic: { select: { name: true, tradeName: true } } } },
        patient: { select: { fullName: true } },
      },
    }),
  );

  const clinicName =
    row?.survey.clinic.tradeName || row?.survey.clinic.name || "Clínica";

  if (!row) {
    return (
      <div className="nps-page">
        <CabecalhoPagina titulo="Pesquisa inválida" descricao="Link não encontrado." />
      </div>
    );
  }

  if (row.respondedAt) {
    return (
      <div className="nps-page">
        <p className="nps-page__eyebrow">{clinicName}</p>
        <CabecalhoPagina
          titulo="Obrigado!"
          descricao="Sua resposta já foi registrada."
        />
        {row.classification === "PROMOTER" ? (
          <Card className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Que bom saber! Indique a clínica a um amigo pelo portal do paciente.
            </p>
            <Link href="/paciente" className={classesBotao({ variante: "gold" })}>
              Abrir portal e indicar
            </Link>
          </Card>
        ) : null}
      </div>
    );
  }

  if (row.expiresAt < new Date()) {
    return (
      <div className="nps-page">
        <p className="nps-page__eyebrow">{clinicName}</p>
        <CabecalhoPagina
          titulo="Pesquisa expirada"
          descricao="O prazo de resposta encerrou."
        />
      </div>
    );
  }

  return (
    <NpsForm
      token={token}
      clinicName={clinicName}
      patientName={row.patient.fullName}
      surveyName={row.survey.name}
      action={submitNps}
    />
  );
}
