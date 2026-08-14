import { requirePatientSession } from "@/lib/otp/session";
import { isModuleEnabled } from "@/lib/modules";
import { listRaffles, buyRaffleTicket } from "@/lib/raffles";
import { CabecalhoPagina, Card, Button, Badge, EmptyState } from "@/components/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function buyTicketAction(formData: FormData) {
  "use server";
  const session = await requirePatientSession();
  await buyRaffleTicket({
    clinicId: session.clinicId,
    raffleId: String(formData.get("raffleId")),
    patientId: session.patientId,
    quantity: 1,
  });
  revalidatePath("/p/sorteios");
  redirect("/p/sorteios?ok=bilhete");
}

export default async function PortalSorteiosPage() {
  const session = await requirePatientSession();
  if (!(await isModuleEnabled(session.clinicId, "RAFFLES"))) {
    return (
      <div>
        <CabecalhoPagina titulo="Sorteios" descricao="Módulo desativado." />
      </div>
    );
  }

  const raffles = (await listRaffles(session.clinicId)).filter(
    (r) => r.status === "ACTIVE",
  );

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Sorteios" />
      {raffles.length === 0 ? (
        <EmptyState
          titulo="Nenhum sorteio ativo"
          descricao="Quando houver um sorteio aberto, você poderá trocar pontos por bilhetes aqui."
        />
      ) : (
        raffles.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-slate-500">{r.prizeDescription}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {r.ticketCostPoints} pontos por bilhete · {r.ticketCount} inscritos
                </p>
              </div>
              <Badge tone="success">Ativo</Badge>
            </div>
            <form action={buyTicketAction} className="mt-3">
              <input type="hidden" name="raffleId" value={r.id} />
              <Button type="submit" variante="gold">
                Comprar bilhete
              </Button>
            </form>
          </Card>
        ))
      )}
    </div>
  );
}
