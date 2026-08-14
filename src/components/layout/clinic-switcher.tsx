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
}: {
  currentClinicId?: string | null;
  currentUnitId?: string | null;
  isSupport?: boolean;
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

  return (
    <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
      {isSupport ? (
        <button
          type="button"
          onClick={endSupport}
          disabled={pending}
          className="w-full rounded-md bg-amber-100 px-2 py-1.5 text-left text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        >
          Encerrar suporte
        </button>
      ) : null}
      {clinics.length > 0 ? (
        <>
          <label className="block text-xs font-medium text-slate-500">
            Clínica
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={clinicId}
              disabled={pending}
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
            <label className="block text-xs font-medium text-slate-500">
              Unidade
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={unitId}
                disabled={pending || !clinicId}
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
