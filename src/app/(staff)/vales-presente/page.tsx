import { Gift } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listGiftCards } from "@/lib/giftcards";
import { PageHeader } from "@/components/ui";
import { GiftCardsClient } from "@/components/giftcards/giftcards-client";
import { toPlain } from "@/lib/serialize";

export default async function ValesPresentePage() {
  const session = await requirePermission(PERMISSIONS.GIFTCARDS_MANAGE);
  const clinicId = session.clinicId;
  const cards = await listGiftCards(clinicId);

  return (
    <div className="services-page">
      <PageHeader
        title="Vales-presente"
        description="Pré-pago digital separado do saldo promocional — emissão, ativação e débito."
        actions={
          <span className="services-page__pill">
            <Gift className="h-3.5 w-3.5" aria-hidden />
            Gift cards
          </span>
        }
      />
      <GiftCardsClient initialCards={toPlain(cards)} />
    </div>
  );
}
