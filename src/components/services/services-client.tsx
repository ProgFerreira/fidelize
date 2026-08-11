"use client";

import * as React from "react";
import {
  Clock,
  Eye,
  Gift,
  ImagePlus,
  ImageOff,
  Pencil,
  Plus,
  Power,
  Search,
  ShoppingBag,
  Sparkles,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Campo,
  Card,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import {
  createServiceAction,
  toggleServiceActiveAction,
  updateServiceAction,
} from "@/app/service-actions";
import type { ServiceDTO } from "@/lib/services";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  initialServices: ServiceDTO[];
};

type Draft = {
  id?: string;
  name: string;
  code: string;
  description: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreview: string | null;
  removeImage: boolean;
  basePrice: string;
  compareAtPrice: string;
  validityDays: string;
  durationMinutes: string;
  cashbackPercent: string;
  pointsPerReal: string;
  eligible: boolean;
  active: boolean;
};

type StatusFilter = "all" | "active" | "inactive";

function emptyDraft(): Draft {
  return {
    name: "",
    code: "",
    description: "",
    imageUrl: "",
    imageFile: null,
    imagePreview: null,
    removeImage: false,
    basePrice: "0",
    compareAtPrice: "",
    validityDays: "90",
    durationMinutes: "60",
    cashbackPercent: "",
    pointsPerReal: "",
    eligible: true,
    active: true,
  };
}

function fromService(s: ServiceDTO): Draft {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    description: s.description ?? "",
    imageUrl: s.imageUrl ?? "",
    imageFile: null,
    imagePreview: null,
    removeImage: false,
    basePrice: String(s.basePrice),
    compareAtPrice:
      s.compareAtPrice == null ? "" : String(s.compareAtPrice),
    validityDays: s.validityDays == null ? "" : String(s.validityDays),
    durationMinutes:
      s.durationMinutes == null ? "60" : String(s.durationMinutes),
    cashbackPercent:
      s.cashbackPercent == null ? "" : String(s.cashbackPercent),
    pointsPerReal: s.pointsPerReal == null ? "" : String(s.pointsPerReal),
    eligible: s.eligible,
    active: s.active,
  };
}

function draftPreviewSrc(draft: Draft) {
  if (draft.removeImage) return null;
  if (draft.imagePreview) return draft.imagePreview;
  if (draft.imageUrl) return draft.imageUrl;
  return null;
}

function hasPromo(s: Pick<ServiceDTO, "basePrice" | "compareAtPrice">) {
  return (
    s.compareAtPrice != null &&
    Number(s.compareAtPrice) > Number(s.basePrice)
  );
}

function averagePrice(items: ServiceDTO[]) {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, s) => acc + Number(s.basePrice || 0), 0);
  return sum / items.length;
}

export function ServicesClient({ initialServices }: Props) {
  const [items, setItems] = React.useState(initialServices);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [viewing, setViewing] = React.useState<ServiceDTO | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setItems(initialServices);
  }, [initialServices]);

  React.useEffect(() => {
    return () => {
      if (draft?.imagePreview) URL.revokeObjectURL(draft.imagePreview);
    };
  }, [draft?.imagePreview]);

  const activeCount = items.filter((s) => s.active).length;
  const withPros = items.filter((s) => s.professionalCount > 0).length;
  const avg = averagePrice(items.filter((s) => s.active));

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter === "active" && !s.active) return false;
      if (statusFilter === "inactive" && s.active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("eligible", draft.eligible ? "true" : "false");
    fd.set("active", draft.active ? "true" : "false");
    fd.set("imageUrl", draft.removeImage ? "" : draft.imageUrl);
    fd.set("removeImage", draft.removeImage ? "true" : "false");
    if (draft.imageFile) {
      fd.set("image", draft.imageFile);
    } else {
      fd.delete("image");
    }
    try {
      if (draft.id) {
        const res = await updateServiceAction(draft.id, fd);
        setItems((prev) =>
          prev.map((s) => (s.id === res.service.id ? res.service : s)),
        );
        toast.success("Serviço atualizado");
      } else {
        const res = await createServiceAction(fd);
        setItems((prev) => [res.service, ...prev]);
        toast.success("Serviço cadastrado");
      }
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  function onPickImage(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use imagem JPG, PNG ou WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2 MB");
      return;
    }
    setDraft((p) => {
      if (!p) return p;
      if (p.imagePreview) URL.revokeObjectURL(p.imagePreview);
      return {
        ...p,
        imageFile: file,
        imagePreview: URL.createObjectURL(file),
        removeImage: false,
      };
    });
  }

  function onRemoveImage() {
    setDraft((p) => {
      if (!p) return p;
      if (p.imagePreview) URL.revokeObjectURL(p.imagePreview);
      return {
        ...p,
        imageFile: null,
        imagePreview: null,
        imageUrl: "",
        removeImage: true,
      };
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onToggle(id: string, active: boolean) {
    try {
      await toggleServiceActiveAction(id, active);
      setItems((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active } : s)),
      );
      toast.success(active ? "Serviço ativado" : "Serviço inativado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao alterar status",
      );
    }
  }

  return (
    <>
      <div className="services-hero">
        <p className="services-hero__eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Catálogo da clínica
        </p>
        <h2 className="services-hero__title">
          Experiências de cuidado, com valor e duração claros
        </h2>
        <p className="services-hero__desc">
          Monte o portfólio de atendimentos com preço, validade e tempo —
          pronto para agenda, profissionais e PDV da recepção.
        </p>
      </div>

      <div className="services-stats">
        <div className="services-stat">
          <div className="services-stat__icon">
            <ShoppingBag className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">No catálogo</p>
            <p className="services-stat__value">{items.length}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--green">
            <Power className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Ativos</p>
            <p className="services-stat__value">{activeCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--blue">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Com profissional</p>
            <p className="services-stat__value">{withPros}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--gold">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Ticket médio</p>
            <p className="services-stat__value">{formatBRL(avg)}</p>
          </div>
        </div>
      </div>

      <div className="services-toolbar">
        <div className="services-toolbar__row">
          <div className="services-toolbar__search">
            <Search aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, código ou descrição"
              aria-label="Buscar no catálogo"
            />
          </div>

          <div className="services-toolbar__filters" role="group" aria-label="Filtrar status">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "active", label: "Ativos" },
                { id: "inactive", label: "Inativos" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "services-filter",
                  statusFilter === f.id && "services-filter--active",
                )}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="services-toolbar__actions">
            <Button type="button" variant="gold" onClick={() => setDraft(emptyDraft())}>
              <Plus className="h-4 w-4" aria-hidden />
              Novo serviço
            </Button>
          </div>
        </div>
        <p className="services-toolbar__hint">
          {filtered.length === items.length
            ? `${items.length} serviço${items.length === 1 ? "" : "s"} no catálogo`
            : `Mostrando ${filtered.length} de ${items.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="services-empty">
          <div className="services-empty__icon">
            <ShoppingBag className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="services-empty__title">
            {items.length === 0
              ? "Nenhum serviço no catálogo"
              : "Nenhum resultado para esta busca"}
          </h3>
          <p className="services-empty__desc">
            {items.length === 0
              ? "Cadastre tipos de atendimento com valor, descrição e validade — depois vincule ao portfólio do profissional."
              : "Tente outro termo ou limpe os filtros para ver o catálogo completo."}
          </p>
          <div className="services-empty__actions">
            {items.length > 0 ? (
              <Button
                type="button"
                variant="contorno"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
            <Button type="button" variant="gold" onClick={() => setDraft(emptyDraft())}>
              <Plus className="h-4 w-4" aria-hidden />
              Cadastrar serviço
            </Button>
          </div>
        </div>
      ) : (
        <div className="services-grid">
          {filtered.map((s) => (
            <article
              key={s.id}
              className={cn("service-card", !s.active && "service-card--inactive")}
            >
              <div className="service-card__media">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.name} />
                ) : (
                  <div className="service-card__media-placeholder" aria-hidden>
                    <ImagePlus />
                  </div>
                )}
              </div>

              <div className="service-card__header">
                <div className="service-card__icon" aria-hidden>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="service-card__title">{s.name}</h3>
                  <p className="service-card__code">{s.code}</p>
                  <div className="service-card__badges">
                    <Badge tone={s.active ? "success" : "muted"}>
                      {s.active ? "Ativo" : "Inativo"}
                    </Badge>
                    {s.eligible ? <Badge tone="gold">Benefício</Badge> : null}
                  </div>
                </div>
              </div>

              <div className="service-card__hero">
                {hasPromo(s) ? (
                  <>
                    <p className="service-card__price-de">
                      de {formatBRL(s.compareAtPrice!)}
                    </p>
                    <p className="service-card__price">
                      <span className="service-card__price-por">por</span>{" "}
                      {formatBRL(s.basePrice)}
                    </p>
                    <p className="service-card__price-label">oferta</p>
                  </>
                ) : (
                  <>
                    <p className="service-card__price">{formatBRL(s.basePrice)}</p>
                    <p className="service-card__price-label">valor base</p>
                  </>
                )}
              </div>

              <p className="service-card__desc">
                {s.description?.trim()
                  ? s.description
                  : "Sem descrição cadastrada — adicione detalhes do procedimento para a equipe e a recepção."}
              </p>

              <div className="service-card__meta">
                <span className="service-chip">
                  <Timer aria-hidden />
                  {s.durationMinutes != null
                    ? `${s.durationMinutes} min`
                    : "Duração —"}
                </span>
                <span className="service-chip">
                  <Clock aria-hidden />
                  {s.validityDays != null
                    ? `${s.validityDays} dias`
                    : "Validade —"}
                </span>
                {s.cashbackPercent != null ? (
                  <span className="service-chip">
                    <Gift aria-hidden />
                    {Number(s.cashbackPercent)}% cashback
                  </span>
                ) : null}
              </div>

              <p className="service-card__pros">
                {s.professionalCount > 0 ? (
                  <>
                    <strong>Portfólio:</strong>{" "}
                    {s.professionalNames.slice(0, 3).join(", ")}
                    {s.professionalNames.length > 3 ? "…" : ""}
                  </>
                ) : (
                  "Ainda sem profissional vinculado"
                )}
              </p>

              <div className="service-card__footer">
                <Button
                  type="button"
                  size="sm"
                  variant="contorno"
                  onClick={() => setViewing(s)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  Visualizar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDraft(fromService(s))}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={s.active ? "danger" : "secondary"}
                  onClick={() => void onToggle(s.id, !s.active)}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {s.active ? "Inativar" : "Ativar"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {viewing ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => setViewing(null)}
          />
          <Card className="agenda__modal-card agenda__modal-card--tall max-w-xl">
            <div className="agenda__modal-head">
              <h2>Detalhes do serviço</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setViewing(null)}
              >
                Fechar
              </Button>
            </div>

            <div className="service-view">
              <div className="service-view__media">
                {viewing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewing.imageUrl} alt={viewing.name} />
                ) : (
                  <div className="service-view__media-empty" aria-hidden>
                    <ImagePlus />
                    <span>Sem foto cadastrada</span>
                  </div>
                )}
              </div>

              <div className="service-view__title-row">
                <div className="min-w-0">
                  <h3 className="service-view__name">{viewing.name}</h3>
                  <p className="service-view__code">{viewing.code}</p>
                </div>
                <div className="service-view__badges">
                  <Badge tone={viewing.active ? "success" : "muted"}>
                    {viewing.active ? "Ativo" : "Inativo"}
                  </Badge>
                  {viewing.eligible ? (
                    <Badge tone="gold">Benefício</Badge>
                  ) : null}
                </div>
              </div>

              {hasPromo(viewing) ? (
                <div className="service-view__promo">
                  <p className="service-view__price-de">
                    de {formatBRL(viewing.compareAtPrice!)}
                  </p>
                  <p className="service-view__price">
                    <span className="service-view__price-por">por</span>{" "}
                    {formatBRL(viewing.basePrice)}
                  </p>
                  <p className="service-view__price-label">oferta</p>
                </div>
              ) : (
                <>
                  <p className="service-view__price">
                    {formatBRL(viewing.basePrice)}
                  </p>
                  <p className="service-view__price-label">valor base</p>
                </>
              )}

              <p className="service-view__desc">
                {viewing.description?.trim()
                  ? viewing.description
                  : "Sem descrição cadastrada."}
              </p>

              <dl className="service-view__grid">
                <div>
                  <dt>Duração</dt>
                  <dd>
                    {viewing.durationMinutes != null
                      ? `${viewing.durationMinutes} min`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>
                    {viewing.validityDays != null
                      ? `${viewing.validityDays} dias`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Cashback</dt>
                  <dd>
                    {viewing.cashbackPercent != null
                      ? `${Number(viewing.cashbackPercent)}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Pontos por R$</dt>
                  <dd>
                    {viewing.pointsPerReal != null
                      ? String(viewing.pointsPerReal)
                      : "—"}
                  </dd>
                </div>
              </dl>

              <div className="service-view__pros">
                <p className="service-view__pros-label">Profissionais</p>
                <p>
                  {viewing.professionalCount > 0
                    ? viewing.professionalNames.join(", ")
                    : "Ainda sem profissional vinculado"}
                </p>
              </div>

              <div className="service-view__actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setViewing(null)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    setDraft(fromService(viewing));
                    setViewing(null);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Editar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {draft ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => setDraft(null)}
          />
          <Card className="agenda__modal-card agenda__modal-card--tall max-w-xl">
            <div className="agenda__modal-head">
              <h2>{draft.id ? "Editar serviço" : "Novo serviço"}</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Fechar
              </Button>
            </div>

            <form onSubmit={onSave} className="agenda__form">
              <Campo label="Foto do serviço / produto">
                <div className="service-image-field">
                  {draftPreviewSrc(draft) ? (
                    <div className="service-image-field__preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draftPreviewSrc(draft) ?? undefined}
                        alt="Pré-visualização"
                      />
                    </div>
                  ) : (
                    <div className="service-image-field__empty">
                      <ImagePlus className="h-7 w-7" aria-hidden />
                      <strong>Adicione uma foto</strong>
                      <span>JPG, PNG ou WebP · até 2 MB</span>
                    </div>
                  )}
                  <div className="service-image-field__actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="service-image-field__file"
                      onChange={(e) =>
                        onPickImage(e.target.files?.[0] ?? null)
                      }
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                      {draftPreviewSrc(draft) ? "Trocar foto" : "Escolher foto"}
                    </Button>
                    {draftPreviewSrc(draft) ? (
                      <Button
                        type="button"
                        variant="contorno"
                        size="sm"
                        onClick={onRemoveImage}
                      >
                        <ImageOff className="h-3.5 w-3.5" aria-hidden />
                        Remover
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Campo>

              <Campo label="Nome do serviço" obrigatorio>
                <Input
                  name="name"
                  required
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((p) => (p ? { ...p, name: e.target.value } : p))
                  }
                  placeholder="Ex.: Limpeza de pele profunda"
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Código">
                  <Input
                    name="code"
                    value={draft.code}
                    onChange={(e) =>
                      setDraft((p) => (p ? { ...p, code: e.target.value } : p))
                    }
                    placeholder="Auto se vazio"
                  />
                </Campo>
                <Campo label="De (R$) — tabela">
                  <Input
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.compareAtPrice}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, compareAtPrice: e.target.value } : p,
                      )
                    }
                    placeholder="Ex.: 100,00"
                  />
                </Campo>
              </div>

              <Campo label="Por (R$) — valor de venda" obrigatorio>
                <Input
                  name="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={draft.basePrice}
                  onChange={(e) =>
                    setDraft((p) =>
                      p ? { ...p, basePrice: e.target.value } : p,
                    )
                  }
                  placeholder="Ex.: 98,00"
                />
              </Campo>

              <Campo label="Descrição do procedimento">
                <Textarea
                  name="description"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((p) =>
                      p ? { ...p, description: e.target.value } : p,
                    )
                  }
                  placeholder="O que inclui, indicações, preparo..."
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Validade (dias)">
                  <Input
                    name="validityDays"
                    type="number"
                    min="0"
                    value={draft.validityDays}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, validityDays: e.target.value } : p,
                      )
                    }
                    placeholder="Ex.: 90"
                  />
                </Campo>
                <Campo label="Duração (minutos)">
                  <Input
                    name="durationMinutes"
                    type="number"
                    min="5"
                    value={draft.durationMinutes}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, durationMinutes: e.target.value } : p,
                      )
                    }
                  />
                </Campo>
              </div>

              <div className="agenda__form-grid">
                <Campo label="Cashback % (opcional)">
                  <Input
                    name="cashbackPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.cashbackPercent}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, cashbackPercent: e.target.value } : p,
                      )
                    }
                  />
                </Campo>
                <Campo label="Pontos por R$ (opcional)">
                  <Input
                    name="pointsPerReal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.pointsPerReal}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, pointsPerReal: e.target.value } : p,
                      )
                    }
                  />
                </Campo>
              </div>

              <div className="agenda__form-grid">
                <Campo label="Elegível a benefício">
                  <Select
                    value={draft.eligible ? "true" : "false"}
                    onChange={(e) =>
                      setDraft((p) =>
                        p
                          ? { ...p, eligible: e.target.value === "true" }
                          : p,
                      )
                    }
                  >
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </Select>
                </Campo>
                <Campo label="Status">
                  <Select
                    value={draft.active ? "true" : "false"}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, active: e.target.value === "true" } : p,
                      )
                    }
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </Select>
                </Campo>
              </div>

              <div className="agenda__form-acoes">
                <span />
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDraft(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </>
  );
}
