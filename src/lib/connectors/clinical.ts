import { z } from "zod";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/patients";
import { confirmAppointment } from "@/lib/reception";
import { writeAuditLog } from "@/lib/audit";

export const CLINICAL_CONNECTORS = [
  {
    code: "feegow",
    name: "Feegow",
    description: "Agenda e atendimento clínico — ingestão via webhook/API.",
  },
  {
    code: "clinicorp",
    name: "Clinicorp",
    description: "Gestão de clínicas — sincroniza atendimentos confirmados.",
  },
  {
    code: "generic_appointment",
    name: "Agenda genérica",
    description: "Contrato JSON padrão FIDELIZE para qualquer ERP clínico.",
  },
] as const;

export type ClinicalConnectorCode = (typeof CLINICAL_CONNECTORS)[number]["code"];

const appointmentIngestSchema = z.object({
  connector: z
    .enum(["feegow", "clinicorp", "generic_appointment"])
    .default("generic_appointment"),
  externalId: z.string().min(1).optional(),
  patient: z.object({
    cpf: z.string().optional(),
    phone: z.string().optional(),
    fullName: z.string().optional(),
    externalCode: z.string().optional(),
  }),
  procedureCode: z.string().optional(),
  grossAmount: z.number().positive(),
  discountAmount: z.number().min(0).optional(),
  benefitToUse: z.number().min(0).optional(),
  professionalName: z.string().optional(),
  unitId: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export type AppointmentIngestInput = z.infer<typeof appointmentIngestSchema>;

export function parseClinicalAppointmentPayload(body: unknown) {
  return appointmentIngestSchema.parse(body);
}

/**
 * Resolve ou cria paciente a partir do payload do conector clínico e confirma
 * o atendimento no fluxo de recepção (cashback/pontos).
 */
export async function ingestClinicalAppointment(input: {
  clinicId: string;
  operatorId: string;
  organizationId: string;
  payload: AppointmentIngestInput;
}) {
  const data = input.payload;
  const cpf = data.patient.cpf ? onlyDigits(data.patient.cpf) : null;
  const phone = data.patient.phone ? onlyDigits(data.patient.phone) : null;

  const orFilters = [
    ...(cpf ? [{ cpf }] : []),
    ...(phone ? [{ phone }] : []),
    ...(data.patient.externalCode
      ? [{ externalCode: data.patient.externalCode }]
      : []),
  ];

  let patient =
    orFilters.length > 0
      ? await prisma.patient.findFirst({
          where: { clinicId: input.clinicId, OR: orFilters },
        })
      : null;

  if (!patient) {
    if (!cpf || !data.patient.fullName || !phone) {
      throw new Error(
        "Paciente não encontrado. Informe cpf, telefone e nome para cadastro automático.",
      );
    }
    const { createPatient } = await import("@/lib/patients");
    patient = await createPatient({
      clinicId: input.clinicId,
      actorId: input.operatorId,
      organizationId: input.organizationId,
      data: {
        fullName: data.patient.fullName,
        cpf,
        phone,
        email: null,
        regulationConsent: true,
        marketingConsent: false,
        externalCode: data.patient.externalCode ?? null,
        status: "ACTIVE",
      },
    });
  }

  let procedure = data.procedureCode
    ? await prisma.procedure.findFirst({
        where: {
          clinicId: input.clinicId,
          code: data.procedureCode,
          active: true,
        },
      })
    : null;

  if (!procedure) {
    procedure = await prisma.procedure.findFirst({
      where: { clinicId: input.clinicId, active: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!procedure) {
    throw new Error(
      "Nenhum procedimento ativo na clínica para lançar o atendimento",
    );
  }

  const wallet = await prisma.wallet.findFirst({
    where: {
      clinicId: input.clinicId,
      patientId: patient.id,
      status: "ACTIVE",
    },
  });
  if (!wallet) throw new Error("Carteira do paciente não encontrada");

  const result = await confirmAppointment({
    clinicId: input.clinicId,
    unitId: data.unitId,
    patientId: patient.id,
    walletId: wallet.id,
    procedureId: procedure.id,
    operatorId: input.operatorId,
    professionalName: data.professionalName,
    grossAmount: data.grossAmount,
    discountAmount: data.discountAmount ?? 0,
    benefitToUse: data.benefitToUse ?? 0,
    idempotencyKey: data.idempotencyKey,
    notes: data.externalId
      ? `connector:${data.connector}:${data.externalId}`
      : `connector:${data.connector}`,
  });

  if (!result.appointment) {
    throw new Error("Falha ao confirmar atendimento via conector");
  }

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.operatorId,
    action: "OTHER",
    entityType: "Appointment",
    entityId: result.appointment.id,
    afterData: {
      connector: data.connector,
      ingest: true,
      idempotencyKey: data.idempotencyKey,
    },
  });

  return {
    patientId: patient.id,
    appointmentId: result.appointment.id,
    reused: Boolean(result.reused),
    connector: data.connector,
  };
}

export function clinicalConnectorDocs(baseUrl: string) {
  return {
    endpoints: {
      ingest: `POST ${baseUrl}/api/v1/connectors/clinical/appointments`,
      list: `GET ${baseUrl}/api/v1/connectors/clinical`,
    },
    auth: "Header x-api-key com escopo de clínica",
    connectors: CLINICAL_CONNECTORS,
    sample: {
      connector: "feegow",
      patient: {
        cpf: "39053344705",
        phone: "11999999999",
        fullName: "Maria Silva",
      },
      procedureCode: "CONSULTA",
      grossAmount: 250,
      idempotencyKey: "feegow-appt-12345",
    },
  };
}
