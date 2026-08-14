import { notFound } from "next/navigation";
import { requirePatientSession } from "@/lib/otp/session";
import { isModuleEnabled } from "@/lib/modules";
import { getVideoCallRoom } from "@/lib/videocalls";
import { PageHeader } from "@/components/ui";
import { CallRoom } from "@/components/videochamadas/call-room";

export default async function PortalVideochamadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePatientSession();

  const moduleEnabled = await isModuleEnabled(session.clinicId, "VIDEOCALLS");
  const room = await getVideoCallRoom(session.clinicId, id);

  if (!moduleEnabled) {
    return (
      <div>
        <PageHeader title="Videochamada" description="Módulo desativado." />
      </div>
    );
  }

  if (!room || room.patientId !== session.patientId) notFound();

  return (
    <div>
      <PageHeader title="Videochamada" />
      <CallRoom roomId={room.id} role="PACIENTE" />
    </div>
  );
}
