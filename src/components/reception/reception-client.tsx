"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button, Card, Input, Label, Select, Badge } from "@/components/ui";
import {
  searchPatientsAction,
  simulateReceptionAction,
  confirmReceptionAction,
  linkCardAction,
  getPatientAppointmentHistoryAction,
} from "@/app/actions";
import { formatBRL } from "@/lib/money";
import {
  AppointmentHistoryCard,
  type AppointmentHistoryItem,
} from "@/components/patients/appointment-history";

type PatientResult = Awaited<ReturnType<typeof searchPatientsAction>>[number];

export function ReceptionClient({
  procedures,
  campaigns,
  availableCards,
}: {
  procedures: Array<{ id: string; name: string; basePrice: number }>;
  campaigns: Array<{ id: string; name: string; extraCashbackPct: number }>;
  availableCards: Array<{ id: string; cardNumber: string; publicToken: string }>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [selected, setSelected] = useState<PatientResult | null>(null);
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const [procedureId, setProcedureId] = useState(procedures[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [grossAmount, setGrossAmount] = useState(procedures[0]?.basePrice ?? 0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [benefitToUse, setBenefitToUse] = useState(0);
  const [simulation, setSimulation] = useState<Awaited<
    ReturnType<typeof simulateReceptionAction>
  > | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useMemo(() => uuidv4(), [selected?.id, grossAmount]);

  const wallet = selected?.wallets[0];

  function loadHistory(patientId: string) {
    startTransition(async () => {
      const data = await getPatientAppointmentHistoryAction(patientId);
      if (selectedIdRef.current === patientId) {
        setHistory(data);
      }
    });
  }

  function selectPatient(patient: PatientResult) {
    selectedIdRef.current = patient.id;
    setSelected(patient);
    setBenefitToUse(0);
    setSimulation(null);
    setReceipt(null);
    setHistory([]);
    loadHistory(patient.id);
  }

  function search() {
    startTransition(async () => {
      setError(null);
      const data = await searchPatientsAction(query);
      setResults(data);
    });
  }

  function simulate() {
    if (!wallet) return;
    startTransition(async () => {
      setError(null);
      try {
        const data = await simulateReceptionAction({
          walletId: wallet.id,
          procedureId: procedureId || undefined,
          campaignId: campaignId || undefined,
          grossAmount,
          discountAmount,
          benefitToUse,
        });
        setSimulation(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha na simulação");
      }
    });
  }

  function confirm() {
    if (!selected || !wallet) return;
    startTransition(async () => {
      setError(null);
      try {
        const result = await confirmReceptionAction({
          patientId: selected.id,
          walletId: wallet.id,
          procedureId: procedureId || undefined,
          campaignId: campaignId || undefined,
          grossAmount,
          discountAmount,
          benefitToUse,
          idempotencyKey,
        });
        setReceipt(
          `Atendimento ${result.appointment?.id} confirmado. Pago ${formatBRL(
            result.appointment?.paidAmount ?? 0,
          )}. Cashback ${formatBRL(result.appointment?.cashbackGenerated ?? 0)}.`,
        );
        setSimulation(null);
        const data = await getPatientAppointmentHistoryAction(selected.id);
        setHistory(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha na confirmação");
      }
    });
  }

  return (
    <div className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <h2 className="text-2xl">Localizar paciente</h2>
        <div className="mt-4 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, CPF, telefone ou token QR"
          />
          <Button onClick={search} disabled={pending}>
            Buscar
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => selectPatient(patient)}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-left hover:border-blue-400"
            >
              <p className="font-semibold">{patient.fullName}</p>
              <p className="text-sm text-slate-500">
                {patient.wallets[0]?.category?.name ?? "—"} ·{" "}
                {formatBRL(patient.wallets[0]?.availableBalance ?? 0)}
              </p>
            </button>
          ))}
        </div>

        {selected && wallet && !wallet.cards.length ? (
          <form action={linkCardAction} className="mt-6 space-y-2 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold">Vincular cartão disponível</p>
            <input type="hidden" name="walletId" value={wallet.id} />
            <Select name="publicToken" defaultValue={availableCards[0]?.publicToken}>
              {availableCards.map((card) => (
                <option key={card.id} value={card.publicToken}>
                  {card.cardNumber}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              Vincular
            </Button>
          </form>
        ) : null}
      </Card>

      <Card className="xl:col-span-2">
        {selected && wallet ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl">{selected.fullName}</h2>
              <Badge tone="gold">{wallet.category?.name ?? "Sem categoria"}</Badge>
              <Badge>{formatBRL(wallet.availableBalance)} disponível</Badge>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Procedimento</Label>
                <Select
                  value={procedureId}
                  onChange={(e) => {
                    setProcedureId(e.target.value);
                    const proc = procedures.find((p) => p.id === e.target.value);
                    if (proc) setGrossAmount(proc.basePrice);
                  }}
                >
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Campanha</Label>
                <Select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (+{c.extraCashbackPct}%)
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Valor do atendimento</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Descontos existentes</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Benefício a resgatar</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={benefitToUse}
                  onChange={(e) => setBenefitToUse(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={simulate} disabled={pending}>
                Simular
              </Button>
              <Button
                variant="gold"
                onClick={confirm}
                disabled={pending || !simulation}
              >
                Confirmar atendimento
              </Button>
            </div>

            {simulation ? (
              <div className="mt-6 rounded-2xl bg-slate-100/80 p-4">
                <h3 className="text-xl">Resumo da simulação</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                  <p>Bruto: {formatBRL(simulation.grossAmount)}</p>
                  <p>Desconto: {formatBRL(simulation.discountAmount)}</p>
                  <p>Benefício: {formatBRL(simulation.benefitUsed)}</p>
                  <p>A pagar: {formatBRL(simulation.paidAmount)}</p>
                  <p>Cashback ({simulation.cashbackPercent}%): {formatBRL(simulation.cashbackAmount)}</p>
                  <p>Pontos: {simulation.points}</p>
                </div>
              </div>
            ) : null}

            {receipt ? (
              <div className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4 text-green-700">
                {receipt}
              </div>
            ) : null}
            {error ? <p className="mt-4 text-red-600">{error}</p> : null}
          </>
        ) : (
          <p className="text-slate-500">Selecione um paciente para iniciar o atendimento.</p>
        )}
      </Card>
    </div>

    {selected ? (
      <AppointmentHistoryCard
        patientName={selected.fullName}
        items={history}
      />
    ) : null}
    </div>
  );
}
