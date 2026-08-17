"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Banknote,
  ClipboardList,
  CreditCard,
  Gift,
  Link2,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Trash2,
  UserPlus,
  UserRound,
  WalletCards,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  Avatar,
  Button,
  Campo,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Badge,
  CabecalhoPagina,
  classesBotao,
  toast,
} from "@/components/ui";
import {
  searchPatientsAction,
  simulateReceptionAction,
  confirmReceptionAction,
  updateReceptionSaleAction,
  getSaleForEditAction,
  linkCardFormAction,
  getPatientAppointmentHistoryAction,
  lookupReceptionGiftCardAction,
  getReceptionCopilotAction,
} from "@/app/actions";
import { formatBRL } from "@/lib/money";
import { formatCpf, formatPhone } from "@/lib/patients/cpf";
import { resolveServicePrice } from "@/lib/professionals/price";
import {
  AppointmentHistoryCard,
  type AppointmentHistoryItem,
} from "@/components/patients/appointment-history";
import { cn } from "@/lib/utils";
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
  packageSessions: number | null;
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

const PAYMENT_METHOD_ICON: Record<string, typeof Banknote> = {
  dinheiro: Banknote,
  pix: Smartphone,
  credito: CreditCard,
  debito: WalletCards,
  link: Link2,
};

export function ReceptionClient({
  procedures,
  professionals,
  campaigns,
  availableCards,
  giftCardEnabled = false,
  kpi,
}: {
  procedures: ProcedureOption[];
  professionals: ProfessionalOption[];
  campaigns: Array<{ id: string; name: string; extraCashbackPct: number }>;
  availableCards: Array<{ id: string; cardNumber: string; publicToken: string }>;
  giftCardEnabled?: boolean;
  kpi?: {
    sales: number;
    withCard: number;
    withBenefit: number;
    scheduled: number;
    identifiedPct: number;
  };
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [selected, setSelected] = useState<PatientResult | null>(null);
  const [copilot, setCopilot] = useState<Awaited<
    ReturnType<typeof getReceptionCopilotAction>
  > | null>(null);
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
  const [searching, startSearch] = useTransition();
  const [giftPending, startGift] = useTransition();
  const [simulating, startSimulate] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const [historyPending, startHistory] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  function reportError(message: string) {
    setError(message);
    toast.error(message);
  }

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
    startHistory(async () => {
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

  function startNewClient() {
    selectedIdRef.current = null;
    setSelected(null);
    setCopilot(null);
    setQuery("");
    setResults([]);
    setHistory([]);
    setError(null);
    resetSaleDraft();
    toast.success("Pronto para o próximo cliente");
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function selectPatient(patient: PatientResult) {
    selectedIdRef.current = patient.id;
    setSelected(patient);
    setCopilot(null);
    resetSaleDraft();
    setHistory([]);
    loadHistory(patient.id);
    const walletId = patient.wallets[0]?.id;
    if (walletId) {
      void getReceptionCopilotAction(patient.id, walletId).then((data) => {
        if (selectedIdRef.current === patient.id) setCopilot(data);
      });
    }
  }

  function cancelEdit() {
    resetSaleDraft();
    toast.info("Edição cancelada");
  }

  function startEdit(appointmentId: string) {
    startConfirm(async () => {
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
        reportError(e instanceof Error ? e.message : "Falha ao carregar venda");
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
    startSearch(async () => {
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
    startGift(async () => {
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
        reportError(e instanceof Error ? e.message : "Vale-presente inválido");
      }
    });
  }

  function simulate() {
    if (!wallet || cart.length === 0) return;
    startSimulate(async () => {
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
        reportError(e instanceof Error ? e.message : "Falha na simulação");
      }
    });
  }

  function confirm() {
    if (!selected || !wallet || cart.length === 0) return;
    startConfirm(async () => {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        reportError(e instanceof Error ? e.message : "Falha ao salvar venda");
      }
    });
  }

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Recepção"
        descricao="PDV de atendimento: escolha o profissional, os serviços do portfólio, simule benefício e confirme a venda."
        acoes={
          <div className="pdv-header-actions">
            {kpi ? (
              <div className="pdv-kpi" title="Vendas do dia identificadas com cartão">
                <strong>{kpi.identifiedPct}%</strong>
                <span>
                  identificadas · {kpi.sales} vendas · {kpi.scheduled} na agenda
                </span>
              </div>
            ) : null}
            {receipt ? (
              <button
                type="button"
                className="pdv-new-client"
                onClick={startNewClient}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Novo cliente
              </button>
            ) : null}
            <Link href="/extrato-dia" className="pdv-extract-link">
              <ClipboardList className="h-4 w-4" aria-hidden />
              Extrato
            </Link>
          </div>
        }
      />

      {receipt ? (
        <div className="pdv-sale-done" role="status">
          <p className="pdv-sale-done__msg">{receipt}</p>
          <button
            type="button"
            className="pdv-new-client"
            onClick={startNewClient}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Novo cliente
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            Localizar paciente
          </h2>
          <div className="mt-4 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Campo label="Nome, CPF, telefone ou token QR">
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Ex.: Ana, 123.456.789-00 ou QR"
                />
              </Campo>
            </div>
            <Button onClick={search} disabled={searching} carregando={searching}>
              Buscar
            </Button>
          </div>
          <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
            {results.length === 0 ? (
              <EmptyState
                icone={UserRound}
                titulo="Nenhum paciente ainda"
                descricao="Busque por nome, CPF, telefone ou token do QR para iniciar o atendimento."
                acao={
                  <Link
                    href="/pacientes/novo"
                    className={classesBotao({ variante: "gold", tamanho: "sm" })}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Cadastrar paciente
                  </Link>
                }
              />
            ) : (
              results.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => selectPatient(patient)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50",
                    selected?.id === patient.id
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200",
                  )}
                >
                  <Avatar nome={patient.fullName} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {patient.fullName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {patient.wallets[0]?.category?.name ?? "—"} ·{" "}
                      {formatBRL(patient.wallets[0]?.availableBalance ?? 0)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      CPF {formatCpf(patient.cpf)} · Tel {formatPhone(patient.phone)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {selected && wallet && !wallet.cards.length ? (
            <form
              action={linkCardFormAction}
              className="mt-6 space-y-2 border-t border-slate-200 pt-4"
            >
              <input type="hidden" name="walletId" value={wallet.id} />
              <Campo label="Cartão disponível">
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
              </Campo>
              <Button type="submit" variante="contorno">
                Vincular
              </Button>
            </form>
          ) : null}
        </Card>

        <Card className="xl:col-span-5">
          {selected && wallet ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar nome={selected.fullName} />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-slate-900">
                    {selected.fullName}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="gold">
                      {wallet.category?.name ?? "Sem categoria"}
                    </Badge>
                    <Badge tone="success">
                      {formatBRL(wallet.availableBalance)} disponível
                    </Badge>
                    {"sharedWallet" in selected && selected.sharedWallet && "holderName" in selected && selected.holderName ? (
                      <Badge tone="gold">Titular: {String(selected.holderName)}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              {copilot ? (
                <div className="pdv-copilot">
                  <p className="pdv-copilot__script">
                    Você tem {copilot.availableBalance} para usar hoje (máx.{" "}
                    {copilot.maxRedemptionPercent}% do ticket).
                  </p>
                  {copilot.sharedWallet && copilot.holderName ? (
                    <p className="pdv-copilot__family">
                      Carteira compartilhada do titular {copilot.holderName}.
                    </p>
                  ) : null}
                  <ul className="pdv-copilot__list">
                    {copilot.birthdayToday ? (
                      <li>Aniversariante hoje — ofereça o benefício do clube.</li>
                    ) : copilot.birthdaySoon ? (
                      <li>
                        Aniversário em {copilot.daysToBirthday} dia
                        {copilot.daysToBirthday === 1 ? "" : "s"}.
                      </li>
                    ) : null}
                    {copilot.almostUpgrade && copilot.nextCategoryName ? (
                      <li>
                        Quase {copilot.nextCategoryName} ({copilot.progressPercent}
                        %). Faltam {formatBRL(copilot.remainingSpend)}.
                      </li>
                    ) : null}
                    {copilot.hasExpiringSoon ? (
                      <li>
                        {copilot.expiringSoonAmount} vencem nos próximos 14 dias.
                      </li>
                    ) : null}
                    {copilot.packages.map((pkg) => (
                      <li key={pkg.id}>
                        {pkg.procedureName}: {pkg.remainingSessions}/
                        {pkg.totalSessions} sessões
                        {pkg.lastSession ? " — última sessão" : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="pdv-copilot__qr">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={copilot.portalQrDataUrl}
                      alt="QR do portal do paciente"
                      width={72}
                      height={72}
                    />
                    <p>Paciente entra no clube com este QR.</p>
                  </div>
                </div>
              ) : null}

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
                <Label className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {selectedProfessional
                    ? `Serviços de ${selectedProfessional.name} — clique para adicionar`
                    : "Catálogo — clique para adicionar ao carrinho"}
                </Label>
                {procedures.length === 0 ? (
                  <EmptyState
                    icone={Stethoscope}
                    titulo="Nenhum serviço cadastrado"
                    descricao="Cadastre serviços em Cadastros → Serviços."
                  />
                ) : catalogProcedures.length === 0 ? (
                  <EmptyState
                    icone={Stethoscope}
                    titulo="Portfólio vazio"
                    descricao="Este profissional não tem serviços no portfólio. Vincule em Cadastros → Profissionais."
                  />
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
                              {p.packageSessions != null && p.packageSessions >= 2
                                ? ` · pacote ${p.packageSessions} sessões`
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
            <EmptyState
              icone={Stethoscope}
              titulo="Aguardando paciente"
              descricao="Selecione um paciente à esquerda para escolher o profissional e montar o carrinho."
            />
          )}
        </Card>

        <Card className="pdv-cart-sticky xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <ShoppingCart className="h-4 w-4" aria-hidden />
              </span>
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

          {error ? (
            <p className="pdv-error" role="alert">
              {error}
            </p>
          ) : null}

          {editingSaleId ? (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              Venda <span className="font-mono">{editingSaleId.slice(0, 10)}…</span>{" "}
              carregada. Altere o carrinho, simule e salve.
              <div className="mt-2">
                <Button
                  type="button"
                  tamanho="sm"
                  variante="secundario"
                  onClick={cancelEdit}
                >
                  Cancelar edição
                </Button>
              </div>
            </div>
          ) : null}

          {!selected ? (
            <EmptyState
              icone={ShoppingCart}
              titulo="Carrinho vazio"
              descricao="Localize o paciente para iniciar a venda."
            />
          ) : cart.length === 0 ? (
            <EmptyState
              icone={ShoppingCart}
              titulo="Carrinho vazio"
              descricao={
                selectedProfessional
                  ? `Adicione serviços de ${selectedProfessional.name}.`
                  : "Escolha o profissional e adicione serviços do catálogo."
              }
            />
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
                <Campo label="Profissional do carrinho">
                  <p className="text-sm text-slate-700">
                    {cartProfessionals.length > 0
                      ? cartProfessionals.join(", ")
                      : selectedProfessional
                        ? `${selectedProfessional.name} · ${selectedProfessional.specialty}`
                        : "Nenhum selecionado — escolha no catálogo para filtrar os serviços."}
                  </p>
                </Campo>
                <Campo label="Campanha">
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
                </Campo>
                <Campo label="Descontos (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => {
                      setDiscountAmount(Number(e.target.value));
                      setSimulation(null);
                    }}
                  />
                </Campo>
                <Campo label="Benefício a resgatar (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={benefitToUse}
                    onChange={(e) => {
                      setBenefitToUse(Number(e.target.value));
                      setSimulation(null);
                    }}
                  />
                </Campo>
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
                          variante="contorno"
                          onClick={lookupGift}
                          disabled={giftPending || !giftCardCode.trim()}
                          carregando={giftPending}
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
                <Campo
                  label="Forma de pagamento"
                  dica="Vale-presente e benefício da carteira são registrados à parte. Esta forma vale para o valor a pagar."
                >
                  <div
                    className="pdv-pay"
                    role="group"
                    aria-label="Forma de pagamento"
                  >
                    {PDV_PAYMENT_METHODS.map((m) => {
                      const Icone = PAYMENT_METHOD_ICON[m.id] ?? Banknote;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={cn(
                            "pdv-pay__opt",
                            paymentMethod === m.id && "pdv-pay__opt--active",
                          )}
                          aria-pressed={paymentMethod === m.id}
                          onClick={() => setPaymentMethod(m.id)}
                        >
                          <Icone className="h-3.5 w-3.5" aria-hidden />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </Campo>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variante="secundario"
                  onClick={clearCart}
                  disabled={simulating || confirming}
                >
                  Limpar
                </Button>
                <Button
                  onClick={simulate}
                  disabled={simulating || confirming || cart.length === 0}
                  carregando={simulating}
                >
                  Simular
                </Button>
                <Button
                  variante="gold"
                  onClick={confirm}
                  disabled={confirming || !simulation}
                  carregando={confirming}
                >
                  {editingSaleId ? "Salvar edição" : "Fechar venda"}
                </Button>
              </div>
              {!simulation && cart.length > 0 ? (
                <p className="pdv-gift__hint mt-2">
                  Simule o cashback antes de fechar a venda.
                </p>
              ) : null}

              {simulation ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Receipt className="h-4 w-4" aria-hidden />
                    Resumo da venda
                  </p>
                  <div className="mt-2.5 grid gap-1 text-slate-600">
                    <p className="flex justify-between">
                      <span>Bruto</span>
                      <span className="tabular">{formatBRL(simulation.grossAmount)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Desconto</span>
                      <span className="tabular">{formatBRL(simulation.discountAmount)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Benefício</span>
                      <span className="tabular">{formatBRL(simulation.benefitUsed)}</span>
                    </p>
                    {simulation.giftCardAmount &&
                    Number(simulation.giftCardAmount) > 0 ? (
                      <p className="flex justify-between">
                        <span>
                          Vale-presente
                          {simulation.giftCardCode
                            ? ` ${simulation.giftCardCode}`
                            : ""}
                        </span>
                        <span className="tabular">{formatBRL(simulation.giftCardAmount)}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2.5 shadow-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      A pagar
                      {Number(simulation.paidAmount) > 0
                        ? ` · ${paymentMethodLabel(paymentMethod)}`
                        : ""}
                    </span>
                    <span className="text-xl font-bold tabular text-slate-900">
                      {formatBRL(simulation.paidAmount)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs text-emerald-700">
                    <span>Cashback gerado ({simulation.cashbackPercent}%)</span>
                    <span className="tabular font-semibold">
                      {formatBRL(simulation.cashbackAmount)} · {simulation.points} pts
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>

      {selected ? (
        <div aria-busy={historyPending || undefined}>
          <AppointmentHistoryCard
            patientName={selected.fullName}
            items={history}
            onEdit={startEdit}
          />
        </div>
      ) : null}
    </div>
  );
}
