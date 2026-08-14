"use client";

import { Button, Card, Label, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

function npsCor(n: number) {
  if (n <= 6) return "nps-score__btn--detrator";
  if (n <= 8) return "nps-score__btn--neutro";
  return "nps-score__btn--promotor";
}

export function NpsForm({
  token,
  clinicName,
  patientName,
  surveyName,
  action,
}: {
  token: string;
  clinicName: string;
  patientName: string;
  surveyName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [score, setScore] = useState<number | null>(null);

  return (
    <div className="nps-page">
      <p className="nps-page__eyebrow">{clinicName}</p>
      <h1 className="nps-page__title">{surveyName}</h1>
      <p className="nps-page__lede">
        Olá {patientName}, de 0 a 10, qual a probabilidade de você recomendar a
        clínica?
      </p>
      <Card>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="score" value={score ?? ""} required />
          <fieldset>
            <legend className="nps-score__legend">Nota (0–10)</legend>
            <div className="nps-score" role="radiogroup" aria-label="Nota de 0 a 10">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={score === n}
                  className={cn(
                    "nps-score__btn",
                    npsCor(n),
                    score === n && "nps-score__btn--ativo",
                  )}
                  onClick={() => setScore(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="nps-score__hints">
              <span>Pouco provável</span>
              <span>Muito provável</span>
            </div>
          </fieldset>
          <div>
            <Label htmlFor="nps-comment">Comentário (opcional)</Label>
            <Textarea id="nps-comment" name="comment" rows={3} />
          </div>
          <Button type="submit" variante="gold" disabled={score === null}>
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}
