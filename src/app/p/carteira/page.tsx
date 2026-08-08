import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPatientSession } from "@/lib/otp/session";
import { generateCardQrDataUrl } from "@/lib/cards";

export default async function CarteiraPage() {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

  const wallet = await prisma.wallet.findFirst({
    where: { patientId: session.patientId, clinicId: session.clinicId },
    include: {
      category: true,
      cards: { where: { status: "ACTIVE" } },
      patient: true,
    },
  });
  if (!wallet) redirect("/p");

  const card = wallet.cards[0];
  const qr = card ? await generateCardQrDataUrl(card.publicToken) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-slate-900">Carteira</h1>
      <div className="digital-card min-h-[420px]">
        <p className="text-xs uppercase tracking-[0.25em] text-blue-200">
          Clínica Dermaphios
        </p>
        <h2 className="mt-10 text-4xl">{wallet.patient.fullName}</h2>
        <p className="mt-3 text-blue-600">{wallet.category?.name}</p>
        <p className="mt-8 font-mono text-lg tracking-widest">
          {card?.cardNumber ?? "Sem cartão vinculado"}
        </p>
        {qr ? (
          <div className="mt-10 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code" className="h-40 w-40 rounded-2xl bg-white p-2" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
