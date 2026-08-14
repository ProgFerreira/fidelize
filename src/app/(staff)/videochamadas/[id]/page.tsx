import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getVideoCallRoom } from "@/lib/videocalls";
import { CabecalhoPagina } from "@/components/ui";
import { CallRoom } from "@/components/videochamadas/call-room";

export default async function VideochamadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission(PERMISSIONS.VIDEOCALLS_MANAGE);
  const room = await getVideoCallRoom(session.user.clinicId, id);
  if (!room) notFound();

  return (
    <div>
      <CabecalhoPagina titulo={`Videochamada · ${room.patient.fullName}`} />
      <CallRoom roomId={room.id} role="PROFISSIONAL" />
    </div>
  );
}
