import { requirePatientSession } from "@/lib/otp/session";
import { getPatientBookingCatalog } from "@/lib/agenda/booking";
import { CabecalhoPagina } from "@/components/ui";
import { PatientBookingClient } from "@/components/patient/booking-client";
import { toPlain } from "@/lib/serialize";

export default async function PortalAgendarPage() {
  const session = await requirePatientSession("/p/agendar");
  const catalog = toPlain(await getPatientBookingCatalog(session.clinicId));

  return (
    <div>
      <CabecalhoPagina
        titulo="Agendar"
        descricao="Escolha o serviço, o profissional e um horário. Confirmamos no WhatsApp."
      />
      <PatientBookingClient catalog={catalog} />
    </div>
  );
}
