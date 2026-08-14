"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";

type Props = {
  onDetected: (value: string) => void;
  onClose: () => void;
};

export function CardQrScanner({ onDetected, onClose }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let raf = 0;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Câmera não disponível neste navegador.");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const Detector =
          typeof window !== "undefined"
            ? (
                window as unknown as {
                  BarcodeDetector?: new (opts?: {
                    formats?: string[];
                  }) => {
                    detect: (
                      source: ImageBitmapSource,
                    ) => Promise<Array<{ rawValue: string }>>;
                  };
                }
              ).BarcodeDetector
            : undefined;

        if (!Detector) {
          setError(
            "Leitura automática indisponível. Digite o token manualmente ou use Chrome/Edge.",
          );
          return;
        }

        const detector = new Detector({ formats: ["qr_code"] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              onDetected(value);
              return;
            }
          } catch {
            // ignore frame errors
          }
          raf = window.requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch {
        setError("Não foi possível acessar a câmera. Verifique a permissão.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="cartoes-scanner" role="dialog" aria-modal="true" aria-label="Leitor de QR">
      <div className="cartoes-scanner__card">
        <div className="cartoes-scanner__head">
          <h3>Ler QR do cartão</h3>
          <Button type="button" variante="fantasma" tamanho="icone" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <video ref={videoRef} className="cartoes-scanner__video" playsInline muted />
        {error ? <p className="cartoes-scanner__error">{error}</p> : null}
        <form
          className="cartoes-scanner__manual"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onDetected(manual.trim());
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Ou cole o token aqui"
            aria-label="Token manual"
          />
          <Button type="submit" tamanho="sm">
            Usar
          </Button>
        </form>
      </div>
    </div>
  );
}
