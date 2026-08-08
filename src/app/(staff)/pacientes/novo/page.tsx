import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Label, Input, Select, Button } from "@/components/ui";
import { createPatientAction } from "@/app/actions";
import { redirect } from "next/navigation";

export default async function NovoPacientePage() {
  const session = await requirePermission(PERMISSIONS.PATIENTS_WRITE);
  const clinicId = session.clinicId;
  const units = await prisma.unit.findMany({
    where: { clinicId: clinicId, active: true },
  });

  async function action(formData: FormData) {
    "use server";
    const result = await createPatientAction(formData);
    redirect(`/pacientes/${result.patientId}`);
  }

  return (
    <div>
      <PageHeader
        title="Novo paciente"
        description="CPF único por clínica. A carteira é criada automaticamente."
      />
      <Card className="max-w-3xl">
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" name="cpf" required />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" required />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input id="birthDate" name="birthDate" type="date" />
          </div>
          <div>
            <Label htmlFor="gender">Sexo (opcional)</Label>
            <Select id="gender" name="gender" defaultValue="">
              <option value="">Não informado</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="O">Outro</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="unitId">Unidade de origem</Label>
            <Select id="unitId" name="unitId" defaultValue="">
              <option value="">Selecione</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="externalCode">Código no sistema clínico</Label>
            <Input id="externalCode" name="externalCode" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Endereço (opcional)</Label>
            <Input id="address" name="address" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="commercialNotes">Observações comerciais</Label>
            <Input id="commercialNotes" name="commercialNotes" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="regulationConsent" required />
            Consentimento com o regulamento
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="marketingConsent" />
            Consentimento para comunicações
          </label>
          <div className="md:col-span-2">
            <Button type="submit" variant="gold">
              Cadastrar paciente
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
