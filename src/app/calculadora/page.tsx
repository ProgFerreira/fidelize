"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input, Campo } from "@/components/ui";

const UPLIFT = 0.27; // benchmark de mercado (frequência)

export default function CalculadoraImpactoPage() {
  const [clients, setClients] = useState(500);
  const [ticket, setTicket] = useState(45);
  const [visits, setVisits] = useState(2);

  const { current, withFidelize, delta } = useMemo(() => {
    const cur = clients * ticket * visits;
    const next = clients * ticket * visits * (1 + UPLIFT);
    return {
      current: cur,
      withFidelize: next,
      delta: next - cur,
    };
  }, [clients, ticket, visits]);

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-12 text-slate-50">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-300">
          Calculadora de impacto
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Quanto sua clínica pode faturar a mais?
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Estimativa com base no aumento médio de {(UPLIFT * 100).toFixed(0)}% na
          frequência de retorno — referência de mercado em programas de
          fidelidade digitais.
        </p>

        <Card className="mt-8 border-slate-700 bg-white/5 text-slate-50">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Pacientes ativos / mês">
              <Input
                type="number"
                min={1}
                value={clients}
                onChange={(e) => setClients(Number(e.target.value) || 0)}
              />
            </Campo>
            <Campo label="Ticket médio (R$)">
              <Input
                type="number"
                min={1}
                value={ticket}
                onChange={(e) => setTicket(Number(e.target.value) || 0)}
              />
            </Campo>
            <Campo label="Visitas por mês">
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={visits}
                onChange={(e) => setVisits(Number(e.target.value) || 0)}
              />
            </Campo>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Faturamento atual</p>
              <p className="text-2xl font-semibold">{brl(current)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Com FIDELIZE</p>
              <p className="text-2xl font-semibold text-blue-300">
                {brl(withFidelize)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Ganho estimado / mês</p>
              <p className="text-2xl font-semibold text-emerald-300">
                ↑ {brl(delta)}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <a href="/login">
              <Button variante="gold">Quero esse resultado</Button>
            </a>
          </div>
        </Card>
      </div>
    </main>
  );
}
