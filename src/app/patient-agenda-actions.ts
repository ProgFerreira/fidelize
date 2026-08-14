"use server";

import { revalidatePath } from "next/cache";
import { requirePatientSession } from "@/lib/otp/session";
import {
  createPatientBooking,
  getPatientBookingCatalog,
  listPatientAvailableSlots,
} from "@/lib/agenda/booking";
import { toPlain } from "@/lib/serialize";

export async function getPatientBookingCatalogAction() {
  const session = await requirePatientSession("/p/agendar");
  return toPlain(await getPatientBookingCatalog(session.clinicId));
}

export async function listPatientSlotsAction(input: {
  professionalId: string;
  procedureId: string;
}) {
  const session = await requirePatientSession("/p/agendar");
  if (!input.professionalId || !input.procedureId) return [];
  const slots = await listPatientAvailableSlots({
    clinicId: session.clinicId,
    professionalId: input.professionalId,
    procedureId: input.procedureId,
  });
  return toPlain(slots);
}

export async function createPatientBookingAction(input: {
  professionalId: string;
  procedureId: string;
  startsAt: string;
  depositMethod?: "PIX" | "CASHBACK" | null;
  depositAmount?: number;
}) {
  const session = await requirePatientSession("/p/agendar");
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Horário inválido");
  }
  const event = await createPatientBooking({
    clinicId: session.clinicId,
    patientId: session.patientId,
    patientName: session.fullName,
    professionalId: input.professionalId,
    procedureId: input.procedureId,
    startsAt,
    depositMethod: input.depositMethod ?? null,
    depositAmount: input.depositAmount,
  });
  revalidatePath("/p/agendar");
  revalidatePath("/agenda");
  return { ok: true as const, event: toPlain(event) };
}
