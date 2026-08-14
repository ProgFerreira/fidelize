"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Campo,
  Card,
  Input,
  Label,
  Select,
  toast,
} from "@/components/ui";
import {
  lookupReceptionGiftCardAction,
  simulateReceptionAction,
  updateReceptionSaleAction,
} from "@/app/actions";
import { formatBRL } from "@/lib/money";
import { resolveServicePrice } from "@/lib/professionals/price";
import { PDV_PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payments/methods";
import { cn } from "@/lib/utils";

export type SaleEditItem = {
  procedureId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  professionalName: string | null;
};

export type SaleEditDTO = {
  id: string;
  patientId: string;
  patientName: string;
  walletId: string;
  professionalName: string | null;
  discountAmount: number;
  benefitUsed: number;
  giftCardCode: string | null;
  giftCardAmount: number;
  paymentMethod: string | null;
  items: SaleEditItem[];
};

type ProcedureOption = {
  id: string;
  name: string;
  basePrice: number;
};

type ProfessionalOption = {
  id: string;
  name: string;
  specialty: string;
  procedurePrices: Record<string, number | null>;
};

type Line = SaleEditItem & { key: string };

function lineKey(item: SaleEditItem, index: number) {
  return `${item.procedureId ?? item.name}::${item.professionalName ?? ""}::${index}`;
}

export function SaleEditClient({
  sale,
  procedures,
  professionals,
  giftCardEnabled,
  backHref,
}: {
  sale: SaleEditDTO;
  procedures: ProcedureOption[];
  professionals: ProfessionalOption[];
  giftCardEnabled: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(
    sale.items.map((item, index) => ({ ...item, key: lineKey(item, index) })),
  );
  const [professionalId, setProfessionalId] = useState(
    professionals.find((p) => p.name === sale.professionalName)?.id ?? "",
  );
  const [discountAmount, setDiscountAmount] = useState(sale.discountAmount);
  const [benefitToUse, setBenefitToUse] = useState(sale.benefitUsed);
  const [giftCardCode, setGiftCardCode] = useState(sale.giftCardCode ?? "");
  const [giftCardAmount, setGiftCardAmount] = useState(
    sale.giftCardAmount ? String(sale.giftCardAmount) : "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    sale.paymentMethod || "dinheiro",
  );
  const [addProcedureId, setAddProcedureId] = useState("");
  const [simulation, setSimulation] = useState<Awaited<
    ReturnType<typeof simulateReceptionAction>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedProfessional = professionals.find((p) => p.id === professionalId);
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  const payload = useMemo(
    () =>
      lines.map((l) => ({
        procedureId: l.procedureId || undefined,
        name: l.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        professionalName: l.professionalName,
      })),
    [lines],
  );

  function dirty() {
    setSimulation(null);
  }

  function setQty(key: string, quantity: number) {
    dirty();
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.key !== key);
      return prev.map((l) => (l.key === key ? { ...l, quantity } : l));
    });
  }

  function setPrice(key: string, unitPrice: number) {
    dirty();
    setLines((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0 } : l,
      ),
    );
  }

  function addProcedure() {
    const proc = procedures.find((p) => p.id === addProcedureId);
    if (!proc) return;
    const unitPrice = resolveServicePrice(
      proc.basePrice,
      selectedProfessional?.procedurePrices?.[proc.id],
    );
    dirty();
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(
          {
            procedureId: proc.id,
            name: proc.name,
            unitPrice,
            quantity: 1,
            professionalName: selectedProfessional?.name ?? sale.professionalName,
          },
          prev.length,
        ),
        procedureId: proc.id,
        name: proc.name,
        unitPrice,
        quantity: 1,
        professionalName: selectedProfessional?.name ?? sale.professionalName,
      },
    ]);
    setAddProcedureId("");
  }

  function simulate() {
    if (lines.length === 0) {
      setError("A venda precisa de ao menos um serviço");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const data = await simulateReceptionAction({
          walletId: sale.walletId,
          grossAmount: subtotal,
          discountAmount,
          benefitToUse,
          giftCardCode: giftCardEnabled ? giftCardCode || undefined : undefined,
          giftCardAmount:
            giftCardEnabled && giftCardAmount
              ? Number(giftCardAmount)
              : undefined,
          editingAppointmentId: sale.id,
          items: payload.map((l) => ({
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

  function lookupGift() {
    const code = giftCardCode.trim();
    if (!code) return;
    startTransition(async () => {
      setError(null);
      try {
        const card = await lookupReceptionGiftCardAction(code, sale.id);
        setGiftCardCode(card.code);
        if (!giftCardAmount) {
          setGiftCardAmount(String(Number(card.remainingAmount)));
        }
        dirty();
        toast.success("Vale encontrado", `Saldo ${formatBRL(card.remainingAmount)}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Vale-presente inválido");
      }
    });
  }

  function save() {
    if (lines.length === 0) {
      setError("A venda precisa de ao menos um serviço");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        await updateReceptionSaleAction({
          appointmentId: sale.id,
          discountAmount,
          benefitToUse,
          professionalName: selectedProfessional?.name ?? sale.professionalName ?? undefined,
          giftCardCode: giftCardEnabled ? giftCardCode || undefined : undefined,
          giftCardAmount:
            giftCardEnabled && giftCardAmount
              ? Number(giftCardAmount)
              : undefined,
          paymentMethod,
          items: payload,
        });
        toast.success("Venda corrigida");
        router.push(backHref);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível salvar a correção");
      }
    });
  }

  return (
    <div className="pdv-sale-edit">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{sale.patientName}</h2>
          <Badge>Correção de venda</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          O financeiro anterior é estornado e a venda é relançada com os dados
          novos.
        </p>

        <div className="mt-4 grid gap-3">
          <Campo label="Profissional">
            <Select
              value={professionalId}
              onChange={(e) => {
                const nextId = e.target.value;
                const nextName =
                  professionals.find((p) => p.id === nextId)?.name ?? null;
                setProfessionalId(nextId);
                setLines((prev) =>
                  prev.map((l) => ({ ...l, professionalName: nextName })),
                );
                dirty();
              }}
            >
              <option value="">Sem profissional</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.specialty}
                </option>
              ))}
            </Select>
          </Campo>

          <div>
            <Label>Itens</Label>
            <ul className="pdv-cart__list mt-2">
              {lines.map((line) => (
                <li key={line.key} className="pdv-cart__line">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.name}</p>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 max-w-[9rem]"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setPrice(line.key, Number(e.target.value))
                      }
                      aria-label={`Preço de ${line.name}`}
                    />
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
                    onClick={() => setQty(line.key, 0)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="pdv-gift__row mt-3">
              <Select
                value={addProcedureId}
                onChange={(e) => setAddProcedureId(e.target.value)}
              >
                <option value="">Adicionar serviço…</option>
                {procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatBRL(p.basePrice)}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variante="contorno"
                onClick={addProcedure}
                disabled={!addProcedureId}
              >
                Adicionar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-600">Subtotal</span>
            <span className="text-lg font-semibold tabular">
              {formatBRL(subtotal)}
            </span>
          </div>

          <Campo label="Descontos (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={discountAmount}
              onChange={(e) => {
                setDiscountAmount(Number(e.target.value));
                dirty();
              }}
            />
          </Campo>
          <Campo label="Benefício a resgatar (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={benefitToUse}
              onChange={(e) => {
                setBenefitToUse(Number(e.target.value));
                dirty();
              }}
            />
          </Campo>

          {giftCardEnabled ? (
            <div className="pdv-gift">
              <Campo label="Vale-presente">
                <div className="pdv-gift__row">
                  <Input
                    value={giftCardCode}
                    onChange={(e) => {
                      setGiftCardCode(e.target.value.toUpperCase());
                      dirty();
                    }}
                    placeholder="Código do vale"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variante="contorno"
                    onClick={lookupGift}
                    disabled={pending || !giftCardCode.trim()}
                  >
                    Consultar
                  </Button>
                </div>
              </Campo>
              <Campo label="Valor do vale (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={giftCardAmount}
                  onChange={(e) => {
                    setGiftCardAmount(e.target.value);
                    dirty();
                  }}
                />
              </Campo>
            </div>
          ) : null}

          <div>
            <Label>Forma de pagamento</Label>
            <div className="pdv-pay" role="group" aria-label="Forma de pagamento">
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
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variante="secundario" onClick={simulate} disabled={pending}>
            Simular
          </Button>
          <Button
            variante="gold"
            onClick={save}
            disabled={pending || !simulation}
          >
            Salvar correção
          </Button>
        </div>

        {simulation ? (
          <div className="mt-4 rounded-xl bg-slate-100/80 p-3 text-sm">
            <p className="font-semibold">Resumo da correção</p>
            <div className="mt-2 grid gap-1">
              <p>Bruto: {formatBRL(simulation.grossAmount)}</p>
              <p>Desconto: {formatBRL(simulation.discountAmount)}</p>
              <p>Benefício: {formatBRL(simulation.benefitUsed)}</p>
              {simulation.giftCardAmount &&
              Number(simulation.giftCardAmount) > 0 ? (
                <p>Vale-presente: {formatBRL(simulation.giftCardAmount)}</p>
              ) : null}
              <p className="font-semibold">
                A pagar: {formatBRL(simulation.paidAmount)}
                {Number(simulation.paidAmount) > 0
                  ? ` · ${paymentMethodLabel(paymentMethod)}`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Simule para conferir o valor a pagar antes de salvar.
          </p>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </Card>
    </div>
  );
}
