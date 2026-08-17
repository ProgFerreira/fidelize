"use client";

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
  listClinicsForSessionAction,
  switchClinicAction,
  endSupportAction,
} from "@/app/actions/tenant";

type ClinicOpt = {
  id: string;
  name: string;
  slug: string | null;
  units: { id: string; name: string; code: string | null }[];
};

export function ClinicSwitcher({
  currentClinicId,
  currentUnitId,
  isSupport,
  variant = "sidebar",
}: {
  currentClinicId?: string | null;
  currentUnitId?: string | null;
  isSupport?: boolean;
  variant?: "sidebar" | "header";
}) {
  const [clinics, setClinics] = useState<ClinicOpt[]>([]);
  const [clinicId, setClinicId] = useState(currentClinicId ?? "");
  const [unitId, setUnitId] = useState(currentUnitId ?? "");
  const [pending, startTransition] = useTransition();
  const { update } = useSession();

  useEffect(() => {
    listClinicsForSessionAction().then(setClinics).catch(() => setClinics([]));
  }, []);

  useEffect(() => {
    setClinicId(currentClinicId ?? "");
    setUnitId(currentUnitId ?? "");
  }, [currentClinicId, currentUnitId]);

  const units = clinics.find((c) => c.id === clinicId)?.units ?? [];

  function apply(nextClinic: string, nextUnit: string) {
    startTransition(async () => {
      await switchClinicAction(nextClinic, nextUnit || null);
      window.location.reload();
    });
  }

  function endSupport() {
    startTransition(async () => {
      await endSupportAction();
      await update({
        suporteAcessoId: null,
        organizationId: null,
        organizationSlug: null,
        suporteMotivo: null,
        suporteOrganizacaoNome: null,
      });
      window.location.assign("/organizacoes");
    });
  }

  if (clinics.length === 0 && !isSupport) return null;

  const compact = variant === "header";

  return (
    <div
      className={
        compact
          ? "flex min-w-0 items-center gap-2"
          : "space-y-2 border-t border-slate-200 p-3"
      }
    >
      {isSupport ? (
        <button
          type="button"
          onClick={endSupport}
          disabled={pending}
          className={
            compact
              ? "shrink-0 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-900"
              : "w-full rounded-md bg-blue-100 px-2 py-1.5 text-left text-xs font-medium text-blue-900"
          }
        >
          Encerrar suporte
        </button>
      ) : null}
      {clinics.length > 0 ? (
        <>
          <label
            className={
              compact
                ? "min-w-0 flex-1 text-xs font-medium text-slate-500"
                : "block text-xs font-medium text-slate-500"
            }
          >
            {compact ? (
              <span className="sr-only">Clínica</span>
            ) : (
              "Clínica"
            )}
            <select
              className={
                compact
                  ? "w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                  : "mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              }
              value={clinicId}
              disabled={pending}
              aria-label="Clínica"
              onChange={(e) => {
                const next = e.target.value;
                setClinicId(next);
                setUnitId("");
                apply(next, "");
              }}
            >
              <option value="">Selecione</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {units.length > 0 ? (
            <label
              className={
                compact
                  ? "min-w-0 flex-1 text-xs font-medium text-slate-500"
                  : "block text-xs font-medium text-slate-500"
              }
            >
              {compact ? <span className="sr-only">Unidade</span> : "Unidade"}
              <select
                className={
                  compact
                    ? "w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                    : "mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                }
                value={unitId}
                disabled={pending || !clinicId}
                aria-label="Unidade"
                onChange={(e) => {
                  const next = e.target.value;
                  setUnitId(next);
                  apply(clinicId, next);
                }}
              >
                <option value="">Todas</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
