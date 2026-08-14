"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Campo, Card, EmptyState, Select, toast } from "@/components/ui";
import {
  createPatientBookingAction,
  listPatientSlotsAction,
} from "@/app/patient-agenda-actions";
import type { BookingCatalog, BookingSlot } from "@/lib/agenda/booking";

export function PatientBookingClient({ catalog }: { catalog: BookingCatalog }) {
  const [procedureId, setProcedureId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [depositMethod, setDepositMethod] = useState<"" | "PIX" | "CASHBACK">("");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [pending, start] = useTransition();

  const professionals = useMemo(() => {
    if (!procedureId) return catalog.professionals;
    return catalog.professionals.filter((p) =>
      p.procedureIds.includes(procedureId),
    );
  }, [catalog.professionals, procedureId]);

  function loadSlots(nextProcedure: string, nextProfessional: string) {
    if (!nextProcedure || !nextProfessional) {
      setSlots([]);
      return;
    }
    start(async () => {
      const data = await listPatientSlotsAction({
        procedureId: nextProcedure,
        professionalId: nextProfessional,
      });
      setSlots(data);
    });
  }

  function onProcedure(value: string) {
    setProcedureId(value);
    const stillValid = catalog.professionals.some(
      (p) => p.id === professionalId && p.procedureIds.includes(value),
    );
    const nextPro = stillValid ? professionalId : "";
    if (!stillValid) setProfessionalId("");
    loadSlots(value, nextPro);
  }

  function onProfessional(value: string) {
    setProfessionalId(value);
    loadSlots(procedureId, value);
  }

  function book(slot: BookingSlot) {
    start(async () => {
      try {
        await createPatientBookingAction({
          professionalId,
          procedureId,
          startsAt: slot.startsAt,
          depositMethod: depositMethod || null,
          depositAmount: depositMethod
            ? Math.max(
                20,
                Math.round(
                  (catalog.procedures.find((p) => p.id === procedureId)
                    ?.basePrice ?? 0) * 0.1,
                ),
              )
            : undefined,
        });
        toast.success(
          depositMethod === "PIX"
            ? "Horário reservado. Pague o sinal via PIX na clínica ou envie o comprovante."
            : "Horário reservado. Confirme pelo WhatsApp com SIM.",
        );
        loadSlots(procedureId, professionalId);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível agendar",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3">
          <Campo label="Serviço" obrigatorio>
            <Select
              value={procedureId}
              onChange={(e) => onProcedure(e.target.value)}
            >
              <option value="">Selecione</option>
              {catalog.procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.durationMinutes} min
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Profissional" obrigatorio>
            <Select
              value={professionalId}
              onChange={(e) => onProfessional(e.target.value)}
              disabled={!procedureId}
            >
              <option value="">Selecione</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.specialty}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Sinal (opcional)">
            <Select
              value={depositMethod}
              onChange={(e) =>
                setDepositMethod(e.target.value as "" | "PIX" | "CASHBACK")
              }
            >
              <option value="">Sem sinal</option>
              <option value="PIX">PIX (10% do serviço, mín. R$ 20)</option>
              <option value="CASHBACK">Cashback da carteira</option>
            </Select>
          </Campo>
        </div>
      </Card>

      {!procedureId || !professionalId ? (
        <EmptyState
          titulo="Escolha serviço e profissional"
          descricao="Mostramos os horários livres dos próximos 14 dias."
        />
      ) : pending && slots.length === 0 ? (
        <p className="text-sm text-slate-500">Buscando horários...</p>
      ) : slots.length === 0 ? (
        <EmptyState
          titulo="Sem horários livres"
          descricao="Tente outro profissional ou fale com a recepção."
        />
      ) : (
        <div className="portal-booking__slots">
          {slots.map((slot) => (
            <Button
              key={slot.startsAt}
              type="button"
              variante="contorno"
              disabled={pending}
              onClick={() => book(slot)}
            >
              {slot.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
