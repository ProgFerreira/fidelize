import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
  IdCard,
  Phone,
  Building2,
  ShieldCheck,
  Wallet,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  CabecalhoPagina,
  Button,
  Input,
  Label,
  Select,
  Textarea,
  Badge,
} from "@/components/ui";
import { createPatientFormAction } from "@/app/actions";
import { comOrganizacao } from "@/lib/tenant";

export default async function NovoPacientePage() {
  const session = await requirePermission(PERMISSIONS.PATIENTS_WRITE);
  const clinicId = session.clinicId;
  // comOrganizacao reforça o tenant (ALS.run) — evita 500 intermitente no soft-nav
  // quando enterWith do auth() se perde entre boundaries do RSC.
  const units = await comOrganizacao(
    { organizationId: session.organizationId },
    () =>
      prisma.unit.findMany({
        where: { clinicId, active: true },
        orderBy: { name: "asc" },
      }),
  );

  return (
    <div className="patients-page patient-new">
      <CabecalhoPagina
        titulo="Novo paciente"
        descricao="Cadastre um membro do clube. A carteira é criada automaticamente."
        breadcrumbs={[
          { label: "Pacientes", href: "/pacientes" },
          { label: "Novo" },
        ]}
        acoes={
          <Link href="/pacientes">
            <Button variant="contorno">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar
            </Button>
          </Link>
        }
      />

      <section className="patient-new__hero" aria-label="Resumo do cadastro">
        <div className="patient-new__hero-main">
          <div className="patient-new__hero-icon" aria-hidden>
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <p className="patient-new__eyebrow">Clube de fidelidade</p>
            <h2 className="patient-new__hero-title">
              Bem-vindo ao cadastro comercial
            </h2>
            <p className="patient-new__hero-desc">
              Preencha os dados essenciais. CPF é único por clínica e o
              consentimento do regulamento é obrigatório.
            </p>
          </div>
        </div>
        <div className="patient-new__steps" aria-hidden>
          <span className="patient-new__step patient-new__step--active">
            <span className="patient-new__step-num">1</span>
            Dados
          </span>
          <span className="patient-new__step-line" />
          <span className="patient-new__step">
            <span className="patient-new__step-num">2</span>
            Carteira
          </span>
          <span className="patient-new__step-line" />
          <span className="patient-new__step">
            <span className="patient-new__step-num">3</span>
            Pronto
          </span>
        </div>
      </section>

      <form action={createPatientFormAction} className="patient-new__layout">
        <div className="patient-new__main">
          <section className="patient-new__panel patient-new__panel--enter">
            <div className="patient-new__panel-head">
              <div className="patient-new__panel-icon" aria-hidden>
                <IdCard className="h-4 w-4" />
              </div>
              <div>
                <h3 className="patient-new__panel-title">Identificação</h3>
                <p className="patient-new__panel-desc">
                  Nome e documento usados em todo o clube.
                </p>
              </div>
              <Badge tone="gold">Obrigatório</Badge>
            </div>

            <div className="patient-new__grid">
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  autoComplete="name"
                  placeholder="Ex.: Ana Beatriz Costa"
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
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="gender">Sexo</Label>
                <Select id="gender" name="gender" defaultValue="">
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                  <option value="O">Outro</option>
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
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="patient-new__field">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@email.com"
                />
              </div>
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  placeholder="Rua, número, bairro, cidade"
                />
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
                <Select id="unitId" name="unitId" defaultValue="">
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
                  placeholder="Opcional"
                />
              </div>
              <div className="patient-new__field patient-new__field--full">
                <Label htmlFor="commercialNotes">Observações comerciais</Label>
                <Textarea
                  id="commercialNotes"
                  name="commercialNotes"
                  rows={3}
                  placeholder="Preferências, indicação, contexto comercial…"
                />
              </div>
            </div>
          </section>

          <section
            className="patient-new__panel patient-new__panel--enter"
            style={{ animationDelay: "180ms" }}
          >
            <div className="patient-new__panel-head">
              <div className="patient-new__panel-icon patient-new__panel-icon--gold" aria-hidden>
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
            <Link href="/pacientes" className="patient-new__actions-cancel">
              <Button type="button" variant="contorno">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" variant="gold" className="patient-new__submit">
              <UserPlus className="h-4 w-4" aria-hidden />
              Cadastrar paciente
            </Button>
          </div>
        </div>

        <aside className="patient-new__aside">
          <div className="patient-new__tip patient-new__panel--enter" style={{ animationDelay: "100ms" }}>
            <div className="patient-new__tip-icon" aria-hidden>
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="patient-new__tip-title">Carteira automática</h3>
            <p className="patient-new__tip-desc">
              Ao salvar, o sistema cria a carteira do paciente e deixa o saldo
              pronto para cashback e pontos.
            </p>
          </div>

          <div
            className="patient-new__tip patient-new__tip--soft patient-new__panel--enter"
            style={{ animationDelay: "160ms" }}
          >
            <div className="patient-new__tip-icon patient-new__tip-icon--gold" aria-hidden>
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="patient-new__tip-title">Dicas rápidas</h3>
            <ul className="patient-new__tip-list">
              <li>Use só números ou o CPF formatado — ambos funcionam.</li>
              <li>Telefone com DDD facilita o WhatsApp depois.</li>
              <li>Código clínico ajuda na conciliação com o prontuário.</li>
            </ul>
          </div>
        </aside>
      </form>
    </div>
  );
}
