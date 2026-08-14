import { notFound } from "next/navigation";
import { requirePatientSession } from "@/lib/otp/session";
import { isModuleEnabled } from "@/lib/modules";
import { getVideoCallRoom } from "@/lib/videocalls";
import { CabecalhoPagina } from "@/components/ui";
import { CallRoom } from "@/components/videochamadas/call-room";

export default async function PortalVideochamadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePatientSession(`/p/videochamadas/${id}`);

  const moduleEnabled = await isModuleEnabled(session.clinicId, "VIDEOCALLS");
  const room = await getVideoCallRoom(session.clinicId, id);

  if (!moduleEnabled) {
    return (
      <div>
        <CabecalhoPagina titulo="Videochamada" descricao="Módulo desativado." />
      </div>
    );
  }

  if (!room || room.patientId !== session.patientId) notFound();

  return (
    <div>
      <CabecalhoPagina titulo="Videochamada" />
      <CallRoom roomId={room.id} role="PACIENTE" />
    </div>
  );
}
