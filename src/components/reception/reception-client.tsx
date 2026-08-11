"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button, Card, Input, Label, Select, Badge } from "@/components/ui";
import {
  searchPatientsAction,
  simulateReceptionAction,
  confirmReceptionAction,
  updateReceptionSaleAction,
  getSaleForEditAction,
  linkCardFormAction,
  getPatientAppointmentHistoryAction,
} from "@/app/actions";
import { formatBRL } from "@/lib/money";
import {
  AppointmentHistoryCard,
  type AppointmentHistoryItem,
} from "@/components/patients/appointment-history";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui";

type PatientResult = Awaited<ReturnType<typeof searchPatientsAction>>[number];

type ProcedureOption = {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  description: string | null;
  validityDays: number | null;
  durationMinutes: number | null;
  cashbackPercent: number | null;
};

type ProfessionalOption = {
  id: string;
  name: string;
  specialty: string;
  procedureIds: string[];
};

type CartLine = {
  procedureId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  cashbackPercent: number | null;
};

export function ReceptionClient({
  procedures,
  professionals,
  campaigns,
  availableCards,
}: {
  procedures: ProcedureOption[];
  professionals: ProfessionalOption[];
  campaigns: Array<{ id: string; name: string; extraCashbackPct: number }>;
  availableCards: Array<{ id: string; cardNumber: string; publicToken: string }>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [selected, setSelected] = useState<PatientResult | null>(null);
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [benefitToUse, setBenefitToUse] = useState(0);
  const [simulation, setSimulation] = useState<Awaited<
    ReturnType<typeof simulateReceptionAction>
  > | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const wallet = selected?.wallets[0];
  const cartCount = cart.reduce((n, line) => n + line.quantity, 0);
  const cartSubtotal = cart.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const idempotencyKey = useMemo(() => {
    void cartSubtotal;
    void cartCount;
    void selected?.id;
    return uuidv4();
  }, [selected?.id, cartSubtotal, cartCount]);

  const professionalsForCart = useMemo(() => {
    if (cart.length === 0) return professionals;
    const needed = new Set(
      cart.map((l) => l.procedureId).filter(Boolean),
    );
    return professionals.filter(
      (p) =>
        p.procedureIds.length === 0 ||
        [...needed].some((id) => p.procedureIds.includes(id)),
    );
  }, [professionals, cart]);

  function loadHistory(patientId: string) {
    startTransition(async () => {
      const data = await getPatientAppointmentHistoryAction(patientId);
      if (selectedIdRef.current === patientId) {
        setHistory(data);
      }
    });
  }

  function resetSaleDraft() {
    setCart([]);
    setEditingSaleId(null);
    setBenefitToUse(0);
    setDiscountAmount(0);
    setProfessionalId("");
    setCampaignId("");
    setSimulation(null);
    setReceipt(null);
  }

  function selectPatient(patient: PatientResult) {
    selectedIdRef.current = patient.id;
    setSelected(patient);
    resetSaleDraft();
    setHistory([]);
    loadHistory(patient.id);
  }

  function cancelEdit() {
    resetSaleDraft();
    toast.info("Edição cancelada");
  }

  function startEdit(appointmentId: string) {
    startTransition(async () => {
      setError(null);
      try {
        const sale = await getSaleForEditAction(appointmentId);
        if (selectedIdRef.current && selectedIdRef.current !== sale.patientId) {
          throw new Error("Selecione o paciente desta venda para editar");
        }
        setEditingSaleId(sale.id);
        setDiscountAmount(sale.discountAmount);
        setBenefitToUse(sale.benefitUsed);
        setSimulation(null);
        setReceipt(null);
        setCart(
          sale.items.map((item) => {
            const proc = item.procedureId
              ? procedures.find((p) => p.id === item.procedureId)
              : null;
            return {
              procedureId: item.procedureId || proc?.id || item.name,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              cashbackPercent: proc?.cashbackPercent ?? null,
            };
          }),
        );
        const pro = sale.professionalName
          ? professionals.find((p) => p.name === sale.professionalName)
          : null;
        setProfessionalId(pro?.id ?? "");
        toast.info("Venda carregada no carrinho para edição");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar venda");
      }
    });
  }

  function addToCart(procedureId: string) {
    const proc = procedures.find((p) => p.id === procedureId);
    if (!proc) return;
    setSimulation(null);
    setReceipt(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.procedureId === procedureId);
      if (existing) {
        return prev.map((l) =>
          l.procedureId === procedureId
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          procedureId: proc.id,
          name: proc.name,
          unitPrice: proc.basePrice,
          quantity: 1,
          cashbackPercent: proc.cashbackPercent,
        },
      ];
    });
  }

  function setQty(procedureId: string, quantity: number) {
    setSimulation(null);
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.procedureId !== procedureId);
      return prev.map((l) =>
        l.procedureId === procedureId ? { ...l, quantity } : l,
      );
    });
  }

  function removeLine(procedureId: string) {
    setSimulation(null);
    setCart((prev) => prev.filter((l) => l.procedureId !== procedureId));
  }

  function clearCart() {
    setCart([]);
    setSimulation(null);
  }

  function search() {
    startTransition(async () => {
      setError(null);
      const data = await searchPatientsAction(query);
      setResults(data);
    });
  }

  function cartPayload() {
    return cart.map((l) => ({
      procedureId: procedures.some((p) => p.id === l.procedureId)
        ? l.procedureId
        : undefined,
      name: l.name,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
    }));
  }

  function simulate() {
    if (!wallet || cart.length === 0) return;
    startTransition(async () => {
      setError(null);
      try {
        const data = await simulateReceptionAction({
          walletId: wallet.id,
          campaignId: campaignId || undefined,
          grossAmount: cartSubtotal,
          discountAmount,
          benefitToUse,
          items: cartPayload().map((l) => ({
            procedureId: l.procedureId,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
          })),
        });
        setSimulation(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha na simulação");
      }
    });
  }

  function confirm() {
    if (!selected || !wallet || cart.length === 0) return;
    startTransition(async () => {
      setError(null);
      try {
        const professionalName =
          professionals.find((p) => p.id === professionalId)?.name ?? undefined;
        const items = cartPayload();

        if (editingSaleId) {
          const result = await updateReceptionSaleAction({
            appointmentId: editingSaleId,
            campaignId: campaignId || undefined,
            discountAmount,
            benefitToUse,
            professionalName,
            items,
          });
          setReceipt(
            `Venda ${result.appointment?.id} atualizada · Pago ${formatBRL(
              result.appointment?.paidAmount ?? 0,
            )} · Cashback ${formatBRL(result.appointment?.cashbackGenerated ?? 0)}.`,
          );
          toast.success("Venda atualizada");
        } else {
          const result = await confirmReceptionAction({
            patientId: selected.id,
            walletId: wallet.id,
            procedureId: items[0]?.procedureId,
            campaignId: campaignId || undefined,
            grossAmount: cartSubtotal,
            discountAmount,
            benefitToUse,
            idempotencyKey,
            professionalName,
            items,
          });
          setReceipt(
            `Venda ${result.appointment?.id} confirmada · ${cartCount} item(ns) · Pago ${formatBRL(
              result.appointment?.paidAmount ?? 0,
            )} · Cashback ${formatBRL(result.appointment?.cashbackGenerated ?? 0)}.`,
          );
          toast.success("Venda confirmada");
        }

        setSimulation(null);
        setCart([]);
        setEditingSaleId(null);
        const data = await getPatientAppointmentHistoryAction(selected.id);
        setHistory(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao salvar venda");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-3">
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
          <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
            {results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => selectPatient(patient)}
                className={
                  "w-full rounded-xl border px-3 py-3 text-left hover:border-blue-400 " +
                  (selected?.id === patient.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200")
                }
              >
                <p className="font-semibold">{patient.fullName}</p>
                <p className="text-sm text-slate-500">
                  {patient.wallets[0]?.category?.name ?? "—"} ·{" "}
                  {formatBRL(patient.wallets[0]?.availableBalance ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  CPF {patient.cpf} · Tel {patient.phone}
                </p>
              </button>
            ))}
          </div>

          {selected && wallet && !wallet.cards.length ? (
            <form
              action={linkCardFormAction}
              className="mt-6 space-y-2 border-t border-slate-200 pt-4"
            >
              <p className="text-sm font-semibold">Vincular cartão disponível</p>
              <input type="hidden" name="walletId" value={wallet.id} />
              <Select
                name="publicToken"
                defaultValue={availableCards[0]?.publicToken}
              >
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

        <Card className="xl:col-span-5">
          {selected && wallet ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl">{selected.fullName}</h2>
                <Badge tone="gold">
                  {wallet.category?.name ?? "Sem categoria"}
                </Badge>
                <Badge>{formatBRL(wallet.availableBalance)} disponível</Badge>
              </div>

              <div className="mt-5">
                <Label>Catálogo — clique para adicionar ao carrinho</Label>
                {procedures.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Cadastre serviços em Cadastros → Serviços.
                  </p>
                ) : (
                  <div className="mt-2 grid max-h-[28rem] gap-2 overflow-y-auto sm:grid-cols-2">
                    {procedures.map((p) => {
                      const inCart = cart.find((l) => l.procedureId === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addToCart(p.id)}
                          className={cn(
                            "pdv-catalog__item",
                            inCart && "pdv-catalog__item--incart",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-900">
                              {p.name}
                            </p>
                            <p className="shrink-0 text-sm font-semibold tabular">
                              {formatBRL(p.basePrice)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{p.code}</p>
                          {p.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {p.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span>
                              {p.durationMinutes != null
                                ? `${p.durationMinutes} min`
                                : "—"}
                              {p.validityDays != null
                                ? ` · validade ${p.validityDays}d`
                                : ""}
                            </span>
                            {inCart ? (
                              <Badge tone="success">{inCart.quantity} no carrinho</Badge>
                            ) : (
                              <span className="font-medium text-blue-600">
                                + Adicionar
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-slate-500">
              Selecione um paciente para montar o carrinho de atendimento.
            </p>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <ShoppingCart className="h-5 w-5" aria-hidden />
              {editingSaleId ? "Editando venda" : "Carrinho"}
            </h2>
            {cartCount > 0 ? (
              <Badge>{cartCount} item{cartCount === 1 ? "" : "s"}</Badge>
            ) : null}
          </div>

          {editingSaleId ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Venda <span className="font-mono">{editingSaleId.slice(0, 10)}…</span>{" "}
              carregada. Altere o carrinho, simule e salve.
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={cancelEdit}
                >
                  Cancelar edição
                </Button>
              </div>
            </div>
          ) : null}

          {!selected ? (
            <p className="mt-4 text-sm text-slate-500">
              Localize o paciente para iniciar a venda.
            </p>
          ) : cart.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              O carrinho está vazio. Adicione serviços do catálogo.
            </p>
          ) : (
            <ul className="pdv-cart__list mt-4">
              {cart.map((line) => (
                <li key={line.procedureId} className="pdv-cart__line">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {line.name}
                    </p>
                    <p className="text-xs text-slate-500 tabular">
                      {formatBRL(line.unitPrice)} un.
                    </p>
                  </div>
                  <div className="pdv-cart__qty">
                    <button
                      type="button"
                      aria-label="Diminuir"
                      onClick={() =>
                        setQty(line.procedureId, line.quantity - 1)
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="tabular">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() =>
                        setQty(line.procedureId, line.quantity + 1)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-semibold tabular">
                    {formatBRL(line.unitPrice * line.quantity)}
                  </p>
                  <button
                    type="button"
                    className="pdv-cart__remove"
                    aria-label={`Remover ${line.name}`}
                    onClick={() => removeLine(line.procedureId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && cart.length > 0 ? (
            <>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm text-slate-600">Subtotal</span>
                <span className="text-lg font-semibold tabular">
                  {formatBRL(cartSubtotal)}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <Label>Profissional</Label>
                  <Select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                  >
                    <option value="">—</option>
                    {professionalsForCart.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.specialty}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Campanha</Label>
                  <Select
                    value={campaignId}
                    onChange={(e) => {
                      setCampaignId(e.target.value);
                      setSimulation(null);
                    }}
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
                  <Label>Descontos</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => {
                      setDiscountAmount(Number(e.target.value));
                      setSimulation(null);
                    }}
                  />
                </div>
                <div>
                  <Label>Benefício a resgatar</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={benefitToUse}
                    onChange={(e) => {
                      setBenefitToUse(Number(e.target.value));
                      setSimulation(null);
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={clearCart}
                  disabled={pending}
                >
                  Limpar
                </Button>
                <Button onClick={simulate} disabled={pending}>
                  Simular
                </Button>
                <Button
                  variant="gold"
                  onClick={confirm}
                  disabled={pending || !simulation}
                >
                  {editingSaleId ? "Salvar edição" : "Fechar venda"}
                </Button>
              </div>

              {simulation ? (
                <div className="mt-4 rounded-xl bg-slate-100/80 p-3 text-sm">
                  <p className="font-semibold">Resumo</p>
                  <div className="mt-2 grid gap-1">
                    <p>Bruto: {formatBRL(simulation.grossAmount)}</p>
                    <p>Desconto: {formatBRL(simulation.discountAmount)}</p>
                    <p>Benefício: {formatBRL(simulation.benefitUsed)}</p>
                    <p className="font-semibold">
                      A pagar: {formatBRL(simulation.paidAmount)}
                    </p>
                    <p>
                      Cashback ({simulation.cashbackPercent}%):{" "}
                      {formatBRL(simulation.cashbackAmount)}
                    </p>
                    <p>Pontos: {simulation.points}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {receipt ? (
            <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-green-700">
              {receipt}
            </div>
          ) : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </Card>
      </div>

      {selected ? (
        <AppointmentHistoryCard
          patientName={selected.fullName}
          items={history}
          onEdit={startEdit}
        />
      ) : null}
    </div>
  );
}
