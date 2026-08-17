import { Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina, IconTag } from "@/components/ui";
import { ServicesClient } from "@/components/services/services-client";
import { listServices } from "@/lib/services";
import { toPlain } from "@/lib/serialize";

export default async function ServicosPage() {
  const session = await requirePermission(PERMISSIONS.SERVICES_MANAGE);
  const services = await listServices({ clinicId: session.clinicId });

  return (
    <div className="services-page">
      <CabecalhoPagina
        titulo="Serviços"
        descricao="Catálogo premium de atendimentos — valor, duração e validade para encantar na agenda e na recepção."
        acoes={
          <IconTag icone={Sparkles}>Portfólio</IconTag>
        }
      />
      <ServicesClient initialServices={toPlain(services)} />
    </div>
  );
}
