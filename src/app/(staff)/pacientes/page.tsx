import Link from "next/link";
import {
  UserPlus,
  Users,
  UserCheck,
  Phone,
  IdCard,
  MapPin,
  ChevronRight,
  ShieldAlert,
  Pencil,
} from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina, Badge, classesBotao, Paginacao } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { onlyDigits } from "@/lib/patients/cpf";
import { labelPt } from "@/lib/i18n/labels";
import { PatientsSearchForm } from "@/components/patients/patients-search-form";

const PAGE_SIZE = 50;
const PATIENT_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
type PatientStatusFilter = (typeof PATIENT_STATUSES)[number];

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

function parseStatus(value?: string): PatientStatusFilter | undefined {
  if (!value) return undefined;
  return PATIENT_STATUSES.includes(value as PatientStatusFilter)
    ? (value as PatientStatusFilter)
    : undefined;
}

function parsePage(value?: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    categoria?: string;
    unidade?: string;
    pagina?: string;
  }>;
}) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const clinicId = session.clinicId;
  const canWrite = hasPermission(
    session.user.permissions,
    PERMISSIONS.PATIENTS_WRITE,
  );
  const {
    q,
    status: statusParam,
    categoria,
    unidade,
    pagina: paginaParam,
  } = await searchParams;

  const status = parseStatus(statusParam);
  const paginaSolicitada = parsePage(paginaParam);
  const digits = q ? onlyDigits(q) : "";
  const hasFilters = Boolean(q || status || categoria || unidade);

  const where: Prisma.PatientWhereInput = {
    clinicId,
    ...(status ? { status } : {}),
    ...(unidade ? { unitId: unidade } : {}),
    ...(categoria
      ? { wallets: { some: { clinicId, categoryId: categoria } } }
      : {}),
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
  };

  const [
    categories,
    units,
    totalPatients,
    activePatients,
    blockedPatients,
    filteredTotal,
  ] = await Promise.all([
    prisma.category.findMany({
      where: { clinicId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.unit.findMany({
      where: { clinicId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.patient.count({ where: { clinicId } }),
    prisma.patient.count({ where: { clinicId, status: "ACTIVE" } }),
    prisma.patient.count({ where: { clinicId, status: "BLOCKED" } }),
    prisma.patient.count({ where }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
  const rangeStart = filteredTotal === 0 ? 0 : (paginaAtual - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(paginaAtual * PAGE_SIZE, filteredTotal);
  const queryParams = {
    q: q || undefined,
    status: status || undefined,
    categoria: categoria || undefined,
    unidade: unidade || undefined,
  };

  const patients = await prisma.patient.findMany({
    where,
    include: {
      wallets: { include: { category: true }, take: 1 },
      unit: true,
    },
    orderBy: { createdAt: "desc" },
    skip: (paginaAtual - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="patients-page">
      <CabecalhoPagina
        titulo="Pacientes"
        descricao="Cadastro comercial do clube — encontre membros, saldos e categorias com facilidade."
        acoes={
          canWrite ? (
            <Link href="/pacientes/novo" className={classesBotao({ variante: "gold" })}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Novo paciente
            </Link>
          ) : undefined
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
          <div className="patients-stat__icon patients-stat__icon--danger">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="patients-stat__label">Bloqueados</p>
            <p className="patients-stat__value">{blockedPatients}</p>
          </div>
        </div>
      </div>

      <PatientsSearchForm
        q={q}
        status={status}
        categoria={categoria}
        unidade={unidade}
        hasFilters={hasFilters}
        categories={categories}
        units={units}
      />

      {filteredTotal > 0 ? (
        <div className="patients-range" role="status">
          <p>
            Exibindo <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{" "}
            <strong>{filteredTotal}</strong>
            {hasFilters ? " resultado(s) filtrado(s)" : " paciente(s)"}
            {hasFilters && filteredTotal !== totalPatients
              ? ` · ${totalPatients} no total da clínica`
              : null}
          </p>
          {totalPaginas > 1 ? (
            <p className="patients-range__pages">
              Página {paginaAtual} de {totalPaginas}
            </p>
          ) : null}
        </div>
      ) : null}

      {patients.length === 0 ? (
        <div className="patients-empty">
          <div className="patients-empty__icon">
            <Users className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="patients-empty__title">
            {hasFilters ? "Nenhum paciente encontrado" : "Ainda não há pacientes"}
          </h3>
          <p className="patients-empty__desc">
            {hasFilters
              ? "Tente outro termo, ajuste os filtros ou limpe a busca para ver a lista completa."
              : "Cadastre o primeiro membro do clube e comece a acompanhar cashback, pontos e categorias."}
          </p>
          <div className="patients-empty__actions">
            {hasFilters ? (
              <Link href="/pacientes" className={classesBotao({ variante: "contorno" })}>
                Ver todos
              </Link>
            ) : null}
            {canWrite ? (
              <Link href="/pacientes/novo" className={classesBotao({ variante: "gold" })}>
                <UserPlus className="h-4 w-4" aria-hidden />
                Cadastrar paciente
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <>
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
                <div key={patient.id} className="patient-row">
                  <div className="patient-row__inner">
                    <Link
                      href={`/pacientes/${patient.id}`}
                      className="patient-row__link"
                    >
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
                    </Link>

                    {canWrite ? (
                      <div className="patient-row__actions">
                        <Link
                          href={`/pacientes/${patient.id}/editar`}
                          className={classesBotao({ tamanho: "sm", variante: "contorno" })}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Editar
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPaginas > 1 ? (
            <Paginacao
              pagina={paginaAtual}
              totalPaginas={totalPaginas}
              total={filteredTotal}
              params={queryParams}
              className="patients-pagination"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
