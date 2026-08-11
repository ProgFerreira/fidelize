import QRCode from "qrcode";

export type LoyaltyCardImageInput = {
  clinicName: string;
  patientName?: string | null;
  categoryName?: string | null;
  cardNumber: string;
  publicToken: string;
  kind?: "PHYSICAL" | "VIRTUAL" | string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, max: number) {
  const v = value.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

/** Arte do cartão em SVG (1080×680) pronta para preview, download e WhatsApp. */
export async function generateLoyaltyCardSvg(
  input: LoyaltyCardImageInput,
): Promise<string> {
  const qr = await QRCode.toDataURL(input.publicToken, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 420,
    color: { dark: "#0B1F33", light: "#FFFFFF" },
  });

  const clinic = escapeXml(truncate(input.clinicName || "Clube de Benefícios", 42));
  const patient = escapeXml(
    truncate(input.patientName || "Membro do clube", 36),
  );
  const category = escapeXml(
    truncate(input.categoryName || "Fidelidade", 28),
  );
  const number = escapeXml(input.cardNumber);
  const kindLabel =
    input.kind === "VIRTUAL" ? "CARTÃO VIRTUAL" : "CARTÃO FIDELIDADE";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="680" viewBox="0 0 1080 680" role="img" aria-label="Cartão ${number}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0b1f33"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c2a46b"/>
      <stop offset="100%" stop-color="#e8d5a3"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="15%" r="45%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1080" height="680" rx="36" fill="url(#bg)"/>
  <rect width="1080" height="680" rx="36" fill="url(#glow)"/>
  <rect x="28" y="28" width="1024" height="624" rx="28" fill="none" stroke="url(#gold)" stroke-opacity="0.55" stroke-width="2"/>

  <text x="64" y="92" fill="#e8d5a3" font-family="Segoe UI, Arial, sans-serif" font-size="22" letter-spacing="6">${escapeXml(kindLabel)}</text>
  <text x="64" y="148" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700">${clinic}</text>

  <text x="64" y="250" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="20" letter-spacing="2">TITULAR</text>
  <text x="64" y="300" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700">${patient}</text>

  <text x="64" y="380" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="20" letter-spacing="2">CATEGORIA</text>
  <text x="64" y="426" fill="#93c5fd" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="600">${category}</text>

  <text x="64" y="520" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="20" letter-spacing="2">NÚMERO</text>
  <text x="64" y="572" fill="#f8fafc" font-family="Consolas, ui-monospace, monospace" font-size="36" letter-spacing="4">${number}</text>

  <rect x="720" y="170" width="280" height="280" rx="24" fill="#ffffff"/>
  <image href="${qr}" x="745" y="195" width="230" height="230"/>
  <text x="860" y="490" text-anchor="middle" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-size="18">Apresente o QR</text>
  <text x="860" y="518" text-anchor="middle" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="16">na recepção</text>
</svg>`;
}

export function loyaltyCardWhatsAppText(input: {
  clinicName: string;
  patientName?: string | null;
  cardNumber: string;
  imageUrl?: string | null;
}) {
  const lines = [
    `Olá${input.patientName ? `, ${input.patientName.split(" ")[0]}` : ""}!`,
    `Segue seu cartão fidelidade da ${input.clinicName}.`,
    `Número: ${input.cardNumber}`,
  ];
  if (input.imageUrl) {
    lines.push("", `Imagem do cartão: ${input.imageUrl}`);
  }
  lines.push("", "Apresente o QR na recepção para usar seus benefícios.");
  return lines.join("\n");
}

export function whatsappShareUrl(phone: string | null | undefined, text: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const withCountry =
    digits.length >= 10 && !digits.startsWith("55") ? `55${digits}` : digits;
  const base = withCountry ? `https://wa.me/${withCountry}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
