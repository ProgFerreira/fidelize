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
    <aside className="login-visual login-visual--image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-hero.jpg"
        alt="Fidelize — Clube de Benefícios: fidelize clientes, aumente resultados"
        className="login-visual__hero-image"
      />
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
