import Link from "next/link";
import { CreditCard, Gift, Stethoscope, Sparkles } from "lucide-react";
import { classesBotao } from "@/components/ui";

const PILARES = [
  {
    icone: Sparkles,
    titulo: "Cashback e pontos",
    desc: "Cada atendimento vira saldo e pontos no clube.",
  },
  {
    icone: CreditCard,
    titulo: "Cartão digital",
    desc: "QR Code na hora, sem depender de cartão físico.",
  },
  {
    icone: Gift,
    titulo: "Prêmios e campanhas",
    desc: "Resgates, indicações e benefícios por categoria.",
  },
] as const;

export function PublicLanding({
  titulo,
  descricao,
  eyebrow,
  ctaPrimario,
  ctaSecundario,
  refCode,
}: {
  titulo: string;
  descricao: string;
  eyebrow?: string;
  ctaPrimario: { href: string; label: string };
  ctaSecundario?: { href: string; label: string };
  refCode?: string | null;
}) {
  return (
    <div className="landing-page">
      <header className="landing-page__brand">
        <span className="landing-page__mark">
          <Stethoscope aria-hidden />
        </span>
        <div>
          <p className="landing-page__name">Fidelize</p>
          {eyebrow ? <p className="landing-page__eyebrow">{eyebrow}</p> : null}
        </div>
      </header>
      <main className="landing-page__main">
        <h1 className="landing-page__title">{titulo}</h1>
        <p className="landing-page__desc">{descricao}</p>
        {refCode ? (
          <p className="landing-page__ref">
            Indicação: <strong>{refCode}</strong>
          </p>
        ) : null}
        <div className="landing-page__actions">
          <Link href={ctaPrimario.href} className={classesBotao({ variante: "gold" })}>
            {ctaPrimario.label}
          </Link>
          {ctaSecundario ? (
            <Link
              href={ctaSecundario.href}
              className={classesBotao({ variante: "contorno" })}
            >
              {ctaSecundario.label}
            </Link>
          ) : null}
        </div>
        <ul className="landing-page__pills">
          {PILARES.map((item) => {
            const Icone = item.icone;
            return (
              <li key={item.titulo} className="landing-page__pill">
                <span className="landing-page__pill-icon">
                  <Icone className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="landing-page__pill-title">{item.titulo}</p>
                  <p className="landing-page__pill-desc">{item.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
