import { prisma } from "@/lib/db";
import { submitNpsResponse } from "@/lib/nps";
import { Button, Card, Input, Label, PageHeader, Textarea } from "@/components/ui";

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
  const row = await prisma.surveyResponse.findUnique({
    where: { token },
    include: {
      survey: true,
      patient: { select: { fullName: true } },
    },
  });

  if (!row) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <PageHeader title="Pesquisa inválida" description="Link não encontrado." />
      </div>
    );
  }

  if (row.respondedAt) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <PageHeader
          title="Obrigado!"
          description="Sua resposta já foi registrada."
        />
        {row.classification === "PROMOTER" ? (
          <Card className="mt-4">
            <p className="text-sm text-slate-600">
              Que bom saber! Se quiser, indique a clínica a um amigo pelo portal do paciente.
            </p>
          </Card>
        ) : null}
      </div>
    );
  }

  if (row.expiresAt < new Date()) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <PageHeader title="Pesquisa expirada" description="O prazo de resposta encerrou." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <PageHeader
        title={row.survey.name}
        description={`Olá ${row.patient.fullName}, de 0 a 10, qual a probabilidade de você recomendar a clínica?`}
      />
      <Card>
        <form action={submitNps} className="grid gap-3">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label>Nota (0–10)</Label>
            <Input name="score" type="number" min={0} max={10} required />
          </div>
          <div>
            <Label>Comentário (opcional)</Label>
            <Textarea name="comment" />
          </div>
          <Button type="submit" variant="gold">Enviar</Button>
        </form>
      </Card>
    </div>
  );
}
