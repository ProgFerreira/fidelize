"use client";

import Link from "next/link";
import { Filter, Search } from "lucide-react";
import { Button, classesBotao, Input, Select } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

const PATIENT_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;

export function PatientsSearchForm({
  q,
  status,
  categoria,
  unidade,
  hasFilters,
  categories,
  units,
}: {
  q?: string;
  status?: string;
  categoria?: string;
  unidade?: string;
  hasFilters: boolean;
  categories: { id: string; name: string }[];
  units: { id: string; name: string }[];
}) {
  function submitOnChange(form: HTMLFormElement | null) {
    form?.requestSubmit();
  }

  return (
    <div className="patients-search">
      <form className="patients-search__form" method="get">
        <div className="patients-search__row">
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
          {hasFilters ? (
            <Link href="/pacientes" className={classesBotao({ variante: "contorno" })}>
              Limpar
            </Link>
          ) : null}
        </div>

        <div className="patients-search__filters">
          <div className="patients-search__filter">
            <label htmlFor="filtro-status">Status</label>
            <Select
              id="filtro-status"
              name="status"
              defaultValue={status ?? ""}
              aria-label="Filtrar por status"
              onChange={(e) => submitOnChange(e.currentTarget.form)}
            >
              <option value="">Todos</option>
              {PATIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labelPt(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="patients-search__filter">
            <label htmlFor="filtro-categoria">Categoria</label>
            <Select
              id="filtro-categoria"
              name="categoria"
              defaultValue={categoria ?? ""}
              aria-label="Filtrar por categoria"
              onChange={(e) => submitOnChange(e.currentTarget.form)}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="patients-search__filter">
            <label htmlFor="filtro-unidade">Unidade</label>
            <Select
              id="filtro-unidade"
              name="unidade"
              defaultValue={unidade ?? ""}
              aria-label="Filtrar por unidade"
              onChange={(e) => submitOnChange(e.currentTarget.form)}
            >
              <option value="">Todas</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </form>
      <p className="patients-search__hint">
        <Filter className="patients-search__hint-icon" aria-hidden />
        Os filtros aplicam na hora. A busca por nome, CPF ou telefone usa o botão
        Buscar.
      </p>
    </div>
  );
}
