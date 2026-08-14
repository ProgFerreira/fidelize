import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  IdCard,
  Phone,
  Building2,
  ShieldCheck,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  CabecalhoPagina,
  Button,
  classesBotao,
  Input,
  Label,
  Select,
  Textarea,
  Badge,
} from "@/components/ui";
import { updatePatientAction } from "@/app/actions";
import { onlyDigits } from "@/lib/patients/cpf";
import { labelPt } from "@/lib/i18n/labels";
import { comOrganizacao } from "@/lib/tenant";

function formatCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11) return value;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(value: string) {
  const d = onlyDigits(value);
  if (d.length === 11) {
    return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (d.length === 10) {
    return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return value;
}

function toDateInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_WRITE);
  const clinicId = session.clinicId;
  const { id } = await params;

  const [patient, units, holders] = await comOrganizacao(
    { organizationId: session.organizationId },
    () =>
      Promise.all([
        prisma.patient.findFirst({
          where: { id, clinicId },
        }),
        prisma.unit.findMany({
          where: { clinicId, active: true },
          orderBy: { name: "asc" },
        }),
        prisma.patient.findMany({
          where: {
            clinicId,
            status: { not: "BLOCKED" },
            holderPatientId: null,
            NOT: { id },
          },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
          take: 200,
        }),
      ]),
  );

  if (!patient) notFound();

  const patientId = patient.id;

  async function action(formData: FormData) {
    "use server";
    // Checkbox desmarcado não vem no FormData — normaliza para gravar false.
    formData.set(
      "regulationConsent",
      formData.get("regulationConsent") === "on" ? "on" : "off",
    );
    formData.set(
      "marketingConsent",
      formData.get("marketingConsent") === "on" ? "on" : "off",
    );
    await updatePatientAction(patientId, formData);
    redirect(`/pacientes/${patientId}`);
  }

  return (
    <div className="patients-page patient-new patient-edit">
      <CabecalhoPagina
        titulo="Editar paciente"
        descricao="Atualize os dados comerciais e de contato do membro."
        breadcrumbs={[
          { label: "Pacientes", href: "/pacientes" },
          { label: patient.fullName, href: `/pacientes/${patient.id}` },
          { label: "Editar" },
        ]}
        acoes={
          <Link
            href={`/pacientes/${patient.id}`}
            className={classesBotao({ variante: "contorno" })}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar
          </Link>
        }
      />

      <section className="patient-new__hero" aria-label="Resumo da edição">
        <div className="patient-new__hero-main">
          <div className="patient-new__hero-icon" aria-hidden>
            <Pencil className="h-6 w-6" />
          </div>
          <div>
            <p className="patient-new__eyebrow">Ficha comercial</p>
            <h2 className="patient-new__hero-title">{patient.fullName}</h2>
            <p className="patient-new__hero-desc">
              Altere apenas o necessário. CPF continua único por clínica.
            </p>
          </div>
        </div>
        <div className="patient-new__steps" aria-hidden>
          <span className="patient-new__step patient-new__step--active">
            <span className="patient-new__step-num">
              <UserRound className="h-3.5 w-3.5" />
            </span>
            {labelPt(patient.status)}
          </span>
        </div>
      </section>

      <form action={action} className="patient-new__layout">
        <div className="patient-new__main">
          <section className="patient-new__panel patient-new__panel--enter">
            <div className="patient-new__panel-head">
              <div className="patient-new__panel-icon" aria-hidden>
                <IdCard className="h-4 w-4" />
              </div>
              <div>
                <h3 className="patient-new__panel-title">Identificação</h3>
                <p className="patient-new__panel-desc">
                  Nome, documento e status no clube.
                </p>
              </div>
              <Badge tone="azul">Obrigatório</Badge>
            </div>

            <div className="patient-new__grid">
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  autoComplete="name"
                  defaultValue={patient.fullName}
                />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  defaultValue={formatCpf(patient.cpf)}
                />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  defaultValue={toDateInput(patient.birthDate)}
                />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="gender">Sexo</Label>
                <Select
                  id="gender"
                  name="gender"
                  defaultValue={patient.gender ?? ""}
                >
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                  <option value="O">Outro</option>
                </Select>
              </div>
              <div className="patient-new__field">
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={patient.status}>
                  <option value="ACTIVE">{labelPt("ACTIVE")}</option>
                  <option value="INACTIVE">{labelPt("INACTIVE")}</option>
                  <option value="BLOCKED">{labelPt("BLOCKED")}</option>
                </Select>
              </div>
            </div>
          </section>

          <section
            className="patient-new__panel patient-new__panel--enter"
            style={{ animationDelay: "60ms" }}
          >
            <div className="patient-new__panel-head">
              <div className="patient-new__panel-icon" aria-hidden>
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <h3 className="patient-new__panel-title">Contato</h3>
                <p className="patient-new__panel-desc">
                  Canais para atendimento e comunicações.
                </p>
              </div>
            </div>

            <div className="patient-new__grid">
              <div className="patient-new__field">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue={formatPhone(patient.phone)}
                />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={patient.email ?? ""}
                />
              </div>
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  defaultValue={patient.address ?? ""}
                />
              </div>
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="holderPatientId">Titular da carteira (dependente)</Label>
                <Select
                  id="holderPatientId"
                  name="holderPatientId"
                  defaultValue={patient.holderPatientId ?? ""}
                >
                  <option value="">Paciente é o titular</option>
                  {holders.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </section>

          <section
            className="patient-new__panel patient-new__panel--enter"
            style={{ animationDelay: "120ms" }}
          >
            <div className="patient-new__panel-head">
              <div className="patient-new__panel-icon" aria-hidden>
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="patient-new__panel-title">Clínica e origem</h3>
                <p className="patient-new__panel-desc">
                  Unidade, código externo e notas comerciais.
                </p>
              </div>
            </div>

            <div className="patient-new__grid">
              <div className="patient-new__field">
                <Label htmlFor="unitId">Unidade de origem</Label>
                <Select
                  id="unitId"
                  name="unitId"
                  defaultValue={patient.unitId ?? ""}
                >
                  <option value="">Selecione</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="patient-new__field">
                <Label htmlFor="externalCode">Código no sistema clínico</Label>
                <Input
                  id="externalCode"
                  name="externalCode"
                  defaultValue={patient.externalCode ?? ""}
                />
              </div>
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="commercialNotes">Observações comerciais</Label>
                <Textarea
                  id="commercialNotes"
                  name="commercialNotes"
                  rows={3}
                  defaultValue={patient.commercialNotes ?? ""}
                />
              </div>
            </div>
          </section>

          <section
            className="patient-new__panel patient-new__panel--enter"
            style={{ animationDelay: "180ms" }}
          >
            <div className="patient-new__panel-head">
              <div
                className="patient-new__panel-icon patient-new__panel-icon--accent"
                aria-hidden
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="patient-new__panel-title">Consentimentos</h3>
                <p className="patient-new__panel-desc">
                  Registro de aceite para o regulamento e marketing.
                </p>
              </div>
            </div>

            <div className="patient-new__consents">
              <label className="patient-new__consent patient-new__consent--required">
                <input
                  type="checkbox"
                  name="regulationConsent"
                  required
                  defaultChecked={patient.regulationConsent}
                  className="patient-new__consent-input"
                />
                <span className="patient-new__consent-box" aria-hidden>
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="patient-new__consent-body">
                  <span className="patient-new__consent-title">
                    Consentimento com o regulamento
                    <span className="patient-new__required">*</span>
                  </span>
                  <span className="patient-new__consent-desc">
                    O paciente declara conhecer e aceitar as regras do clube.
                  </span>
                </span>
              </label>

              <label className="patient-new__consent">
                <input
                  type="checkbox"
                  name="marketingConsent"
                  defaultChecked={patient.marketingConsent}
                  className="patient-new__consent-input"
                />
                <span className="patient-new__consent-box" aria-hidden>
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="patient-new__consent-body">
                  <span className="patient-new__consent-title">
                    Consentimento para comunicações
                  </span>
                  <span className="patient-new__consent-desc">
                    Autoriza contatos comerciais e campanhas do clube.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <div className="patient-new__actions">
            <Link
              href={`/pacientes/${patient.id}`}
              className={classesBotao({
                variante: "contorno",
                className: "patient-new__actions-cancel",
              })}
            >
              Cancelar
            </Link>
            <Button type="submit" variante="primario" className="patient-new__submit">
              <Pencil className="h-4 w-4" aria-hidden />
              Salvar alterações
            </Button>
          </div>
        </div>

        <aside className="patient-new__aside">
          <div
            className="patient-new__tip patient-new__panel--enter"
            style={{ animationDelay: "100ms" }}
          >
            <div className="patient-new__tip-icon" aria-hidden>
              <IdCard className="h-5 w-5" />
            </div>
            <h3 className="patient-new__tip-title">CPF único</h3>
            <p className="patient-new__tip-desc">
              Se alterar o CPF, ele precisa continuar livre nesta clínica. A
              carteira e o histórico permanecem vinculados ao paciente.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
