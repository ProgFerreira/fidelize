"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Gift, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button, Campo, Card, Input, Label, Select, Badge } from "@/components/ui";
import {
  searchPatientsAction,
  simulateReceptionAction,
  confirmReceptionAction,
  updateReceptionSaleAction,
  getSaleForEditAction,
  linkCardFormAction,
  getPatientAppointmentHistoryAction,
  lookupReceptionGiftCardAction,
} from "@/app/actions";
import { formatBRL } from "@/lib/money";
import { resolveServicePrice } from "@/lib/professionals/price";
import {
  AppointmentHistoryCard,
  type AppointmentHistoryItem,
} from "@/components/patients/appointment-history";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui";
import { PDV_PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payments/methods";

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
  procedurePrices: Record<string, number | null>;
};

type CartLine = {
  key: string;
  procedureId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  cashbackPercent: number | null;
  professionalId: string;
  professionalName: string | null;
};

function cartLineKey(procedureId: string, professionalId: string) {
  return `${procedureId}::${professionalId}`;
}

export function ReceptionClient({
  procedures,
  professionals,
  campaigns,
  availableCards,
  giftCardEnabled = false,
}: {
  procedures: ProcedureOption[];
  professionals: ProfessionalOption[];
  campaigns: Array<{ id: string; name: string; extraCashbackPct: number }>;
  availableCards: Array<{ id: string; cardNumber: string; publicToken: string }>;
  giftCardEnabled?: boolean;
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
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardAmount, setGiftCardAmount] = useState("");
  const [giftPreview, setGiftPreview] = useState<{
    code: string;
    remainingAmount: string | number;
    allowPartial: boolean;
    beneficiaryName: string | null;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
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

  const selectedProfessional = professionals.find(
    (p) => p.id === professionalId,
  );

  const catalogProcedures = useMemo(() => {
    if (!selectedProfessional) return procedures;
    if (selectedProfessional.procedureIds.length === 0) return [];
    return procedures.filter((p) =>
      selectedProfessional.procedureIds.includes(p.id),
    );
  }, [procedures, selectedProfessional]);

  const cartProfessionals = useMemo(() => {
    const names = [
      ...new Set(
        cart
          .map((line) => line.professionalName)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    return names;
  }, [cart]);

  function priceFor(procedureId: string, catalogPrice: number) {
    return resolveServicePrice(
      catalogPrice,
      selectedProfessional?.procedurePrices?.[procedureId],
    );
  }

  function applyProfessional(nextId: string) {
    setProfessionalId(nextId);
  }

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
    setGiftCardCode("");
    setGiftCardAmount("");
    setGiftPreview(null);
    setPaymentMethod("dinheiro");
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
        setGiftCardCode(sale.giftCardCode ?? "");
        setGiftCardAmount(
          sale.giftCardAmount ? String(sale.giftCardAmount) : "",
        );
        setGiftPreview(null);
        setPaymentMethod(sale.paymentMethod || "dinheiro");
        setSimulation(null);
        setReceipt(null);
        setCart(
          sale.items.map((item) => {
            const proc = item.procedureId
              ? procedures.find((p) => p.id === item.procedureId)
              : null;
            const itemPro = item.professionalName
              ? professionals.find((p) => p.name === item.professionalName)
              : sale.professionalName
                ? professionals.find((p) => p.name === sale.professionalName)
                : null;
            const lineProfessionalId = itemPro?.id ?? "";
            const procedureId = item.procedureId || proc?.id || item.name;
            return {
              key: cartLineKey(procedureId, lineProfessionalId),
              procedureId,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              cashbackPercent: proc?.cashbackPercent ?? null,
              professionalId: lineProfessionalId,
              professionalName:
                item.professionalName || itemPro?.name || sale.professionalName || null,
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
    const lineProfessionalId = professionalId || "";
    const lineKey = cartLineKey(proc.id, lineProfessionalId);
    setSimulation(null);
    setReceipt(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.key === lineKey);
      if (existing) {
        return prev.map((l) =>
          l.key === lineKey ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: lineKey,
          procedureId: proc.id,
          name: proc.name,
          unitPrice: priceFor(proc.id, proc.basePrice),
          quantity: 1,
          cashbackPercent: proc.cashbackPercent,
          professionalId: lineProfessionalId,
          professionalName: selectedProfessional?.name ?? null,
        },
      ];
    });
  }

  function setQty(lineKey: string, quantity: number) {
    setSimulation(null);
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.key !== lineKey);
      return prev.map((l) => (l.key === lineKey ? { ...l, quantity } : l));
    });
  }

  function removeLine(lineKey: string) {
    setSimulation(null);
    setCart((prev) => prev.filter((l) => l.key !== lineKey));
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
      professionalName: l.professionalName,
    }));
  }

  function saleProfessionalName() {
    if (cartProfessionals.length > 0) return cartProfessionals.join(", ");
    return selectedProfessional?.name;
  }

  function lookupGift() {
    const code = giftCardCode.trim();
    if (!code) return;
    startTransition(async () => {
      setError(null);
      try {
        const card = await lookupReceptionGiftCardAction(
          code,
          editingSaleId || undefined,
        );
        setGiftPreview({
          code: card.code,
          remainingAmount: card.remainingAmount,
          allowPartial: card.allowPartial,
          beneficiaryName: card.beneficiaryName,
        });
        setGiftCardCode(card.code);
        if (!giftCardAmount) {
          setGiftCardAmount(String(Number(card.remainingAmount)));
        }
        setSimulation(null);
        toast.success("Vale encontrado", `Saldo ${formatBRL(card.remainingAmount)}`);
      } catch (e) {
        setGiftPreview(null);
        setError(e instanceof Error ? e.message : "Vale-presente inválido");
      }
    });
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
          giftCardCode: giftCardEnabled ? giftCardCode || undefined : undefined,
          giftCardAmount:
            giftCardEnabled && giftCardAmount
              ? Number(giftCardAmount)
              : undefined,
          editingAppointmentId: editingSaleId || undefined,
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
        const professionalName = saleProfessionalName();
        const items = cartPayload();

        if (editingSaleId) {
          const result = await updateReceptionSaleAction({
            appointmentId: editingSaleId,
            campaignId: campaignId || undefined,
            discountAmount,
            benefitToUse,
            professionalName,
            giftCardCode: giftCardEnabled ? giftCardCode || undefined : undefined,
            giftCardAmount:
              giftCardEnabled && giftCardAmount
                ? Number(giftCardAmount)
                : undefined,
            paymentMethod,
            items,
          });
          setReceipt(
            `Venda ${result.appointment?.id} atualizada · Pago ${formatBRL(
              result.appointment?.paidAmount ?? 0,
            )}${
              result.simulation?.giftCardAmount &&
              Number(result.simulation.giftCardAmount) > 0
                ? ` · Vale ${formatBRL(result.simulation.giftCardAmount)}`
                : ""
            } · ${paymentMethodLabel(paymentMethod)} · Cashback ${formatBRL(result.appointment?.cashbackGenerated ?? 0)}.`,
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
            giftCardCode: giftCardEnabled ? giftCardCode || undefined : undefined,
            giftCardAmount:
              giftCardEnabled && giftCardAmount
                ? Number(giftCardAmount)
                : undefined,
            paymentMethod,
            items,
          });
          setReceipt(
            `Venda ${result.appointment?.id} confirmada · ${cartCount} item(ns) · Pago ${formatBRL(
              result.appointment?.paidAmount ?? 0,
            )}${
              result.simulation?.giftCardAmount &&
              Number(result.simulation.giftCardAmount) > 0
                ? ` · Vale ${formatBRL(result.simulation.giftCardAmount)}`
                : ""
            } · ${paymentMethodLabel(paymentMethod)} · Cashback ${formatBRL(result.appointment?.cashbackGenerated ?? 0)}.`,
          );
          toast.success("Venda confirmada");
        }

        setSimulation(null);
        setCart([]);
        setEditingSaleId(null);
        setGiftCardCode("");
        setGiftCardAmount("");
        setGiftPreview(null);
        setPaymentMethod("dinheiro");
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

              <div className="pdv-professional">
                <Campo
                  label="Profissional"
                  dica={
                    selectedProfessional
                      ? `Catálogo de ${selectedProfessional.name}. Trocar o profissional não limpa o carrinho.`
                      : "Selecione o profissional para filtrar o catálogo. O carrinho permanece ao trocar."
                  }
                >
                  <Select
                    value={professionalId}
                    onChange={(e) => applyProfessional(e.target.value)}
                    disabled={professionals.length === 0}
                  >
                    <option value="">
                      {professionals.length === 0
                        ? "Nenhum profissional cadastrado"
                        : "Todos os serviços"}
                    </option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.specialty}
                        {p.procedureIds.length > 0
                          ? ` · ${p.procedureIds.length} serviço${
                              p.procedureIds.length === 1 ? "" : "s"
                            }`
                          : " · sem portfólio"}
                      </option>
                    ))}
                  </Select>
                </Campo>
              </div>

              <div className="mt-5">
                <Label>
                  {selectedProfessional
                    ? `Serviços de ${selectedProfessional.name} — clique para adicionar`
                    : "Catálogo — clique para adicionar ao carrinho"}
                </Label>
                {procedures.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Cadastre serviços em Cadastros → Serviços.
                  </p>
                ) : catalogProcedures.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Este profissional não tem serviços no portfólio. Vincule em
                    Cadastros → Profissionais.
                  </p>
                ) : (
                  <div className="mt-2 grid max-h-[28rem] gap-2 overflow-y-auto sm:grid-cols-2">
                    {catalogProcedures.map((p) => {
                      const inCart = cart.find(
                        (l) =>
                          l.procedureId === p.id &&
                          l.professionalId === (professionalId || ""),
                      );
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
                              {formatBRL(priceFor(p.id, p.basePrice))}
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
              Selecione um paciente para escolher o profissional e montar o
              carrinho.
            </p>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <ShoppingCart className="h-5 w-5" aria-hidden />
              {editingSaleId ? "Editando venda" : "Carrinho"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {cartProfessionals.map((name) => (
                <Badge key={name}>{name}</Badge>
              ))}
              {cartCount > 0 ? (
                <Badge>
                  {cartCount} item{cartCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
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
              {selectedProfessional
                ? `O carrinho está vazio. Adicione serviços de ${selectedProfessional.name}.`
                : "O carrinho está vazio. Escolha o profissional e adicione serviços do catálogo."}
            </p>
          ) : (
            <ul className="pdv-cart__list mt-4">
              {cart.map((line) => (
                <li key={line.key} className="pdv-cart__line">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {line.name}
                    </p>
                    <p className="text-xs text-slate-500 tabular">
                      {formatBRL(line.unitPrice)} un.
                      {line.professionalName
                        ? ` · ${line.professionalName}`
                        : ""}
                    </p>
                  </div>
                  <div className="pdv-cart__qty">
                    <button
                      type="button"
                      aria-label="Diminuir"
                      onClick={() => setQty(line.key, line.quantity - 1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="tabular">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() => setQty(line.key, line.quantity + 1)}
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
                    onClick={() => removeLine(line.key)}
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
                  <p className="mt-1 text-sm text-slate-700">
                    {cartProfessionals.length > 0
                      ? cartProfessionals.join(", ")
                      : selectedProfessional
                        ? `${selectedProfessional.name} · ${selectedProfessional.specialty}`
                        : "Nenhum selecionado — escolha no catálogo para filtrar os serviços."}
                  </p>
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
                {giftCardEnabled ? (
                  <div className="pdv-gift">
                    <Campo
                      label="Vale-presente"
                      dica="Informe o código e consulte o saldo. O valor abate o que falta pagar, sem gerar cashback."
                    >
                      <div className="pdv-gift__row">
                        <Input
                          value={giftCardCode}
                          onChange={(e) => {
                            setGiftCardCode(e.target.value.toUpperCase());
                            setGiftPreview(null);
                            setSimulation(null);
                          }}
                          placeholder="Ex.: GP1A2B3C4D"
                          autoComplete="off"
                          aria-label="Código do vale-presente"
                        />
                        <Button
                          type="button"
                          variant="contorno"
                          onClick={lookupGift}
                          disabled={pending || !giftCardCode.trim()}
                        >
                          <Gift className="h-4 w-4" aria-hidden />
                          Consultar
                        </Button>
                      </div>
                    </Campo>
                    {giftPreview ? (
                      <p className="pdv-gift__hint">
                        Saldo {formatBRL(giftPreview.remainingAmount)}
                        {giftPreview.allowPartial
                          ? " · uso parcial permitido"
                          : " · somente valor total"}
                        {giftPreview.beneficiaryName
                          ? ` · ${giftPreview.beneficiaryName}`
                          : ""}
                      </p>
                    ) : null}
                    <Campo label="Valor do vale (R$)">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={giftCardAmount}
                        onChange={(e) => {
                          setGiftCardAmount(e.target.value);
                          setSimulation(null);
                        }}
                        placeholder="Vazio = usar o máximo possível"
                      />
                    </Campo>
                  </div>
                ) : null}
                <div>
                  <Label>Forma de pagamento</Label>
                  <div
                    className="pdv-pay"
                    role="group"
                    aria-label="Forma de pagamento"
                  >
                    {PDV_PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={cn(
                          "pdv-pay__opt",
                          paymentMethod === m.id && "pdv-pay__opt--active",
                        )}
                        onClick={() => setPaymentMethod(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="pdv-gift__hint mt-1">
                    Vale-presente e benefício da carteira são registrados à
                    parte. Esta forma vale para o valor a pagar.
                  </p>
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
                    {simulation.giftCardAmount &&
                    Number(simulation.giftCardAmount) > 0 ? (
                      <p>
                        Vale-presente
                        {simulation.giftCardCode
                          ? ` ${simulation.giftCardCode}`
                          : ""}
                        : {formatBRL(simulation.giftCardAmount)}
                      </p>
                    ) : null}
                    <p className="font-semibold">
                      A pagar: {formatBRL(simulation.paidAmount)}
                      {Number(simulation.paidAmount) > 0
                        ? ` · ${paymentMethodLabel(paymentMethod)}`
                        : ""}
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
