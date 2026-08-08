"use client";

import { useTransition, type CSSProperties } from "react";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { saveCategoryAction } from "@/app/actions";
import { Gem, Shield } from "lucide-react";

type CategoryPlan = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  cashbackPercent: string | number;
  discountPercent: string | number;
  minAnnualSpend: string | number;
  minPoints: number;
  minAppointments: number;
  progressionMode: string;
  sortOrder: number;
  benefits: string | null;
  active: boolean;
};

function PlanIcon({ slug, color }: { slug: string; color: string }) {
  const Icon = slug === "diamante" ? Gem : Shield;
  return (
    <div
      className="plan-card__icon"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon className="h-6 w-6" aria-hidden />
    </div>
  );
}

export function CategoryPlanCard({ category }: { category: CategoryPlan }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await saveCategoryAction(formData);
        });
      }}
      className="plan-card"
      style={
        {
          "--plan-color": category.color,
        } as CSSProperties
      }
    >
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="icon" value={category.icon ?? "sparkles"} />
      <input
        type="hidden"
        name="discountPercent"
        value={String(category.discountPercent)}
      />
      <input
        type="hidden"
        name="minAppointments"
        value={category.minAppointments}
      />

      <div className="plan-card__header">
        <PlanIcon slug={category.slug} color={category.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="plan-card__title">{category.name}</h3>
            {category.active ? (
              <Badge tone="success">Ativo</Badge>
            ) : (
              <Badge tone="muted">Inativo</Badge>
            )}
          </div>
          <p className="plan-card__slug">{category.slug}</p>
        </div>
      </div>

      <div className="plan-card__hero">
        <p className="plan-card__hero-value">
          {Number(category.cashbackPercent)}%
        </p>
        <p className="plan-card__hero-label">cashback</p>
      </div>

      <div className="plan-card__fields">
        <div>
          <Label>Nome</Label>
          <Input name="name" defaultValue={category.name} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Slug</Label>
            <Input name="slug" defaultValue={category.slug} required />
          </div>
          <div>
            <Label>Cor</Label>
            <Input name="color" type="color" defaultValue={category.color} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cashback %</Label>
            <Input
              name="cashbackPercent"
              type="number"
              step="0.01"
              defaultValue={String(category.cashbackPercent)}
            />
          </div>
          <div>
            <Label>Ordem</Label>
            <Input
              name="sortOrder"
              type="number"
              defaultValue={category.sortOrder}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Gasto mínimo</Label>
            <Input
              name="minAnnualSpend"
              type="number"
              step="0.01"
              defaultValue={String(category.minAnnualSpend)}
            />
          </div>
          <div>
            <Label>Pontos mínimos</Label>
            <Input
              name="minPoints"
              type="number"
              defaultValue={category.minPoints}
            />
          </div>
        </div>
        <div>
          <Label>Progressão</Label>
          <Select
            name="progressionMode"
            defaultValue={category.progressionMode}
          >
            <option value="SPEND">Valor gasto</option>
            <option value="POINTS">Pontos</option>
            <option value="APPOINTMENTS">Atendimentos</option>
            <option value="COMBINED">Combinada</option>
          </Select>
        </div>
        <div>
          <Label>Benefícios</Label>
          <Textarea
            name="benefits"
            defaultValue={category.benefits ?? ""}
            rows={3}
          />
        </div>
      </div>

      <div className="plan-card__footer">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={category.active}
            className="h-4 w-4 rounded border-slate-300"
          />
          Plano ativo
        </label>
        <Button type="submit" variant="gold" disabled={pending}>
          {pending ? "Salvando..." : "Salvar plano"}
        </Button>
      </div>
    </form>
  );
}
