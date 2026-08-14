"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  History,
  Link2,
  Printer,
  RefreshCw,
  ShieldOff,
  Unlock,
} from "lucide-react";
import { Badge, Button, classesBotao, Input } from "@/components/ui";
import { toast } from "@/components/ui/toast-provider";
import {
  blockCardAction,
  replaceCardAction,
  unblockCardAction,
} from "@/app/actions";
import { labelPt } from "@/lib/i18n/labels";

export type CardListItem = {
  id: string;
  cardNumber: string;
  publicToken: string;
  kind: string;
  status: string;
  expiresAt: string | null;
  linkedAt: string | null;
  createdAt: string;
  blockedReason: string | null;
  unitName: string | null;
  patient: { id: string; fullName: string } | null;
};

function statusTone(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "BLOCKED" || status === "CANCELLED") return "danger";
  if (status === "AVAILABLE") return "gold";
  return "muted";
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("pt-BR");
}

export function CardsList({
  cards,
  availableOptions,
}: {
  cards: CardListItem[];
  availableOptions: Array<{ id: string; cardNumber: string; publicToken: string }>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [replaceFor, setReplaceFor] = React.useState<string | null>(null);

  async function onBlock(cardId: string, form: HTMLFormElement) {
    setBusyId(cardId);
    try {
      const fd = new FormData(form);
      fd.set("cardId", cardId);
      const res = await blockCardAction(fd);
      if (!res.ok) {
        toast.error("Bloqueio", res.error);
        return;
      }
      toast.success("Cartão bloqueado");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onUnblock(cardId: string) {
    setBusyId(cardId);
    try {
      const fd = new FormData();
      fd.set("cardId", cardId);
      fd.set("reason", "Desbloqueio administrativo");
      const res = await unblockCardAction(fd);
      if (!res.ok) {
        toast.error("Desbloqueio", res.error);
        return;
      }
      toast.success("Cartão desbloqueado");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onReplace(cardId: string, form: HTMLFormElement) {
    setBusyId(cardId);
    try {
      const fd = new FormData(form);
      fd.set("oldCardId", cardId);
      const res = await replaceCardAction(fd);
      if (!res.ok) {
        toast.error("2ª via", res.error);
        return;
      }
      toast.success("2ª via emitida");
      setReplaceFor(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (cards.length === 0) return null;

  return (
    <div className="cartoes-list">
      {cards.map((card) => {
        const canBlock =
          card.status === "ACTIVE" || card.status === "AVAILABLE";
        const canUnblock = card.status === "BLOCKED";
        const canReplace =
          (card.status === "ACTIVE" || card.status === "BLOCKED") &&
          card.kind === "PHYSICAL" &&
          Boolean(card.patient);
        const expired =
          card.expiresAt && new Date(card.expiresAt).getTime() < Date.now();

        return (
          <article key={card.id} className="cartao-row">
            <div className="cartao-row__inner">
              <div className="cartao-row__main">
                <div className="cartao-row__avatar" aria-hidden>
                  {card.kind === "VIRTUAL" ? "V" : "F"}
                </div>
                <div className="min-w-0">
                  <div className="cartao-row__title-line">
                    <p className="cartao-row__number">{card.cardNumber}</p>
                    <Badge tone={statusTone(card.status)}>
                      {labelPt(card.status)}
                    </Badge>
                    <Badge tone={card.kind === "VIRTUAL" ? "azul" : "muted"}>
                      {card.kind === "VIRTUAL" ? "Virtual" : "Físico"}
                    </Badge>
                    {expired ? <Badge tone="danger">Expirado</Badge> : null}
                  </div>
                  <div className="cartao-row__meta">
                    <span className="cartao-row__meta-item">
                      Token {card.publicToken.slice(0, 10)}…
                    </span>
                    <span className="cartao-row__meta-item">
                      {card.unitName ?? "Estoque geral"}
                    </span>
                    <span className="cartao-row__meta-item">
                      Criado {formatDate(card.createdAt)}
                    </span>
                    {card.linkedAt ? (
                      <span className="cartao-row__meta-item">
                        Vinculado {formatDate(card.linkedAt)}
                      </span>
                    ) : null}
                    {card.expiresAt ? (
                      <span className="cartao-row__meta-item">
                        Validade {formatDate(card.expiresAt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="cartao-row__patient">
                    {card.patient ? (
                      <Link
                        href={`/pacientes/${card.patient.id}`}
                        className="cartao-row__patient-link"
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden />
                        {card.patient.fullName}
                      </Link>
                    ) : (
                      <span className="cartao-row__unlinked">
                        Sem vínculo com paciente
                      </span>
                    )}
                    {card.blockedReason ? (
                      <span className="cartao-row__reason">
                        Motivo: {card.blockedReason}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="cartao-row__actions">
                <Link
                  href={`/cartoes/${card.id}`}
                  className={classesBotao({ variante: "contorno", size: "sm" })}
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  Detalhe / WhatsApp
                </Link>
                {card.status === "AVAILABLE" ? (
                  <Link
                    href={`/cartoes/imprimir?ids=${card.id}`}
                    className={classesBotao({ variante: "contorno", size: "sm" })}
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden />
                    QR
                  </Link>
                ) : null}
                {canUnblock ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secundario"
                    disabled={busyId === card.id}
                    onClick={() => void onUnblock(card.id)}
                  >
                    <Unlock className="h-3.5 w-3.5" aria-hidden />
                    Desbloquear
                  </Button>
                ) : null}
                {canReplace ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="contorno"
                    onClick={() =>
                      setReplaceFor((cur) => (cur === card.id ? null : card.id))
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    2ª via
                  </Button>
                ) : null}
                {canBlock ? (
                  <form
                    className="cartao-row__block"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void onBlock(card.id, e.currentTarget);
                    }}
                  >
                    <Input
                      name="reason"
                      placeholder="Motivo do bloqueio"
                      required
                      aria-label={`Motivo para bloquear ${card.cardNumber}`}
                    />
                    <Button
                      type="submit"
                      variant="danger"
                      size="sm"
                      disabled={busyId === card.id}
                    >
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                      Bloquear
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>

            {replaceFor === card.id ? (
              <form
                className="cartao-row__replace"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onReplace(card.id, e.currentTarget);
                }}
              >
                <p className="cartao-row__replace-title">
                  Emitir 2ª via — escolha um cartão disponível do estoque
                </p>
                <div className="cartao-row__replace-fields">
                  <select name="newCardId" required className="cartao-row__select">
                    <option value="">Selecione o novo cartão</option>
                    {availableOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.cardNumber}
                      </option>
                    ))}
                  </select>
                  <Input
                    name="reason"
                    placeholder="Motivo (perda, dano…)"
                    defaultValue="2ª via"
                  />
                  <Button type="submit" size="sm" disabled={busyId === card.id}>
                    Confirmar substituição
                  </Button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
