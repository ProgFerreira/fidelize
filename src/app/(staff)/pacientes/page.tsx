import Link from "next/link";
import {
  Search,
  UserPlus,
  Users,
  UserCheck,
  Phone,
  IdCard,
  MapPin,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Badge, Button, Input } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { onlyDigits } from "@/lib/patients/cpf";
import { labelPt } from "@/lib/i18n/labels";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const clinicId = session.clinicId;
  const { q } = await searchParams;
  const digits = q ? onlyDigits(q) : "";

  const [patients, totalPatients, activePatients] = await Promise.all([
    prisma.patient.findMany({
      where: {
        clinicId,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                ...(digits
                  ? [
                      { cpf: { contains: digits } },
                      { phone: { contains: digits } },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      include: {
        wallets: { include: { category: true }, take: 1 },
        unit: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.patient.count({ where: { clinicId } }),
    prisma.patient.count({ where: { clinicId, status: "ACTIVE" } }),
  ]);

  return (
    <div className="patients-page">
      <PageHeader
        title="Pacientes"
        description="Cadastro comercial do clube — encontre membros, saldos e categorias com facilidade."
        actions={
          <Link href="/pacientes/novo">
            <Button variant="gold">
              <UserPlus className="h-4 w-4" aria-hidden />
              Novo paciente
            </Button>
          </Link>
        }
      />

      <div className="patients-stats">
        <div className="patients-stat">
          <div className="patients-stat__icon">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Total cadastrado</p>
            <p className="patients-stat__value">{totalPatients}</p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--green">
            <UserCheck className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Ativos no clube</p>
            <p className="patients-stat__value">{activePatients}</p>
          </div>
        </div>
        <div className="patients-stat">
          <div className="patients-stat__icon patients-stat__icon--gold">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">
              {q ? "Resultados da busca" : "Exibindo agora"}
            </p>
            <p className="patients-stat__value">{patients.length}</p>
          </div>
        </div>
      </div>

      <div className="patients-search">
        <form className="patients-search__row">
          <div className="patients-search__field">
            <Search aria-hidden />
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Buscar por nome, CPF ou telefone"
              aria-label="Buscar pacientes"
            />
          </div>
          <Button type="submit">Buscar</Button>
          {q ? (
            <Link href="/pacientes">
              <Button type="button" variant="contorno">
                Limpar
              </Button>
            </Link>
          ) : null}
        </form>
        <p className="patients-search__hint">
          Dica: digite parte do nome ou só os números do CPF/telefone.
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="patients-empty">
          <div className="patients-empty__icon">
            <Users className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="patients-empty__title">
            {q ? "Nenhum paciente encontrado" : "Ainda não há pacientes"}
          </h3>
          <p className="patients-empty__desc">
            {q
              ? "Tente outro termo ou limpe a busca para ver a lista completa."
              : "Cadastre o primeiro membro do clube e comece a acompanhar cashback, pontos e categorias."}
          </p>
          <div className="patients-empty__actions">
            {q ? (
              <Link href="/pacientes">
                <Button variant="contorno">Ver todos</Button>
              </Link>
            ) : null}
            <Link href="/pacientes/novo">
              <Button variant="gold">
                <UserPlus className="h-4 w-4" aria-hidden />
                Cadastrar paciente
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="patients-list">
          {patients.map((patient) => {
            const wallet = patient.wallets[0];
            const categoryName = wallet?.category?.name ?? "Sem categoria";
            const statusTone =
              patient.status === "ACTIVE"
                ? "success"
                : patient.status === "BLOCKED"
                  ? "danger"
                  : "muted";

            return (
              <Link
                key={patient.id}
                href={`/pacientes/${patient.id}`}
                className="patient-row"
              >
                <div className="patient-row__inner">
                  <div className="patient-row__main">
                    <div className="patient-avatar" aria-hidden>
                      {initials(patient.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="patient-row__name">{patient.fullName}</p>
                      <div className="patient-row__meta">
                        <span className="patient-row__meta-item">
                          <IdCard aria-hidden />
                          CPF {formatCpf(patient.cpf)}
                        </span>
                        <span className="patient-row__meta-item">
                          <Phone aria-hidden />
                          {formatPhone(patient.phone)}
                        </span>
                        {patient.unit ? (
                          <span className="patient-row__meta-item">
                            <MapPin aria-hidden />
                            {patient.unit.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="patient-row__side">
                    <div className="patient-row__balance">
                      <p className="patient-row__balance-label">Saldo</p>
                      <p className="patient-row__balance-value">
                        {formatBRL(wallet?.availableBalance ?? 0)}
                      </p>
                    </div>
                    <Badge tone="gold">{categoryName}</Badge>
                    <Badge tone={statusTone}>
                      {labelPt(patient.status)}
                    </Badge>
                    <ChevronRight
                      className="patient-row__chevron h-5 w-5"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
