import { Gift, Star, TrendingUp } from "lucide-react";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8.5 12.5c0-5.2 6.4-7.8 12-4.4 5.6-3.4 12-0.8 12 4.4 0 7.6-12 15.5-12 15.5S8.5 20.1 8.5 12.5Z"
        fill="#3b82f6"
      />
      <path
        d="M14 13.2c0-3.4 4.1-5.1 7.5-2.7 3.4-2.4 7.5-0.7 7.5 2.7 0 4.8-7.5 10-7.5 10S14 18 14 13.2Z"
        fill="#93c5fd"
      />
    </svg>
  );
}

export function LoginVisual() {
  return (
    <aside className="login-visual">
      <div className="login-visual__glow" aria-hidden />
      <div className="login-visual__grid" aria-hidden />
      <div className="login-visual__chart" aria-hidden />

      <header className="login-visual__brand">
        <span className="login-visual__mark">
          <LogoMark />
        </span>
        <div className="login-visual__brand-text">
          <strong>Fidelize</strong>
          <span>Plataforma de Fidelização</span>
        </div>
      </header>

      <div className="login-visual__copy">
        <h1 className="login-visual__title">
          Fidelize clientes.
          <span>Aumente resultados.</span>
        </h1>
        <p className="login-visual__desc">
          Programa de benefícios completo para transformar relacionamento em
          crescimento real.
        </p>
        <ul className="login-visual__features">
          <li>
            <span className="login-visual__feature-icon">
              <Gift aria-hidden />
            </span>
            Benefícios Personalizados
          </li>
          <li>
            <span className="login-visual__feature-icon">
              <Star aria-hidden />
            </span>
            Clientes Mais fiéis
          </li>
          <li>
            <span className="login-visual__feature-icon">
              <TrendingUp aria-hidden />
            </span>
            Resultados Que crescem
          </li>
        </ul>
      </div>

      <div className="login-visual__stage" aria-hidden>
        <article className="login-card-mock">
          <span className="login-card-mock__chip" />
          <div className="login-card-mock__brand">
            <LogoMark />
            Fidelize
          </div>
          <p>Clube de benefícios</p>
        </article>

        <article className="login-phone-mock">
          <div className="login-phone-mock__notch" />
          <div className="login-phone-mock__screen">
            <header className="login-phone-mock__bar">
              <LogoMark />
              Fidelize
            </header>
            <p className="login-phone-mock__hello">Olá, Maria!</p>
            <div className="login-phone-mock__stats">
              <div>
                <strong>2.450</strong>
                <span>pontos</span>
              </div>
              <div>
                <strong>R$ 128,50</strong>
                <span>cashback</span>
              </div>
            </div>
            <div className="login-phone-mock__progress">
              <span>Próximo benefício</span>
              <b />
            </div>
            <div className="login-phone-mock__rewards">
              <div>
                <em>☕</em>
                Vale Café
              </div>
              <div>
                <em>🎁</em>
                Combo Especial
              </div>
            </div>
          </div>
        </article>

        <div className="login-gift-mock">
          <span className="login-gift-mock__lid" />
          <span className="login-gift-mock__box" />
          <span className="login-gift-mock__ribbon" />
          <span className="login-gift-mock__bow" />
        </div>
      </div>
    </aside>
  );
}

export function LoginMobileBanner({ contexto }: { contexto: string }) {
  return (
    <div className="login-mobile-banner">
      <div className="login-mobile-banner__glow" aria-hidden />
      <div className="login-mobile-banner__content">
        <div className="login-visual__brand login-visual__brand--compact">
          <span className="login-visual__mark">
            <LogoMark />
          </span>
          <div className="login-visual__brand-text">
            <strong>Fidelize</strong>
            <span>{contexto}</span>
          </div>
        </div>
        <p className="login-mobile-banner__tagline">
          Fidelize clientes. Aumente resultados.
        </p>
      </div>
    </div>
  );
}
