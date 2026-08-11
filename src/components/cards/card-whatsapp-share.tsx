"use client";

import * as React from "react";
import { Download, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast-provider";
import { whatsappShareUrl } from "@/lib/cards/image";

type Props = {
  cardNumber: string;
  imageUrl: string;
  clinicName: string;
  patientName?: string | null;
  phone?: string | null;
  /** Texto já montado no servidor (opcional). */
  whatsappText?: string;
};

async function svgUrlToPngBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível carregar a arte do cartão");
  const svgText = await res.text();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao renderizar o cartão"));
      el.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 680;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG"))),
        "image/png",
        0.95,
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function defaultText(props: Props) {
  if (props.whatsappText) return props.whatsappText;
  const first = props.patientName?.split(" ")[0];
  return [
    `Olá${first ? `, ${first}` : ""}!`,
    `Segue seu cartão fidelidade da ${props.clinicName}.`,
    `Número: ${props.cardNumber}`,
    "",
    `Imagem do cartão: ${props.imageUrl}`,
    "",
    "Apresente o QR na recepção para usar seus benefícios.",
  ].join("\n");
}

export function CardWhatsAppShare(props: Props) {
  const [busy, setBusy] = React.useState<"png" | "share" | null>(null);
  const absoluteImageUrl = React.useMemo(() => {
    if (props.imageUrl.startsWith("http")) return props.imageUrl;
    if (typeof window === "undefined") return props.imageUrl;
    return new URL(props.imageUrl, window.location.origin).toString();
  }, [props.imageUrl]);

  async function downloadPng() {
    setBusy("png");
    try {
      const blob = await svgUrlToPngBlob(absoluteImageUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartao-${props.cardNumber}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PNG baixado", "Envie a imagem no WhatsApp");
    } catch (error) {
      toast.error(
        "Download",
        error instanceof Error ? error.message : "Falha ao gerar PNG",
      );
    } finally {
      setBusy(null);
    }
  }

  async function shareNative() {
    setBusy("share");
    try {
      const blob = await svgUrlToPngBlob(absoluteImageUrl);
      const file = new File([blob], `cartao-${props.cardNumber}.png`, {
        type: "image/png",
      });
      const text = defaultText({ ...props, imageUrl: absoluteImageUrl });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Cartão ${props.cardNumber}`,
          text,
        });
        toast.success("Pronto", "Escolha o WhatsApp na lista de compartilhamento");
        return;
      }

      await downloadPng();
      window.open(
        whatsappShareUrl(props.phone, text),
        "_blank",
        "noopener,noreferrer",
      );
      toast.info(
        "WhatsApp aberto",
        "Anexe o PNG baixado na conversa",
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(
        "Compartilhar",
        error instanceof Error ? error.message : "Não foi possível compartilhar",
      );
    } finally {
      setBusy(null);
    }
  }

  function openWhatsApp() {
    const text = defaultText({ ...props, imageUrl: absoluteImageUrl });
    window.open(
      whatsappShareUrl(props.phone, text),
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="cartao-wa">
      <div className="cartao-wa__preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.imageUrl}
          alt={`Cartão ${props.cardNumber}`}
          className="cartao-wa__img"
        />
      </div>
      <div className="cartao-wa__actions">
        <Button
          type="button"
          variant="gold"
          onClick={() => void shareNative()}
          disabled={busy !== null}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          {busy === "share" ? "Gerando…" : "Enviar no WhatsApp"}
        </Button>
        <Button
          type="button"
          variant="contorno"
          onClick={() => void downloadPng()}
          disabled={busy !== null}
        >
          <Download className="h-4 w-4" aria-hidden />
          {busy === "png" ? "Gerando…" : "Baixar PNG"}
        </Button>
        <Button type="button" variant="secundario" onClick={openWhatsApp}>
          <MessageCircle className="h-4 w-4" aria-hidden />
          Abrir conversa
        </Button>
      </div>
      <p className="cartao-wa__hint">
        No celular, “Enviar no WhatsApp” compartilha a imagem direto. No
        computador, baixe o PNG e anexe na conversa.
      </p>
    </div>
  );
}
