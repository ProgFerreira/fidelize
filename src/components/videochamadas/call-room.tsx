"use client";

import * as React from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Circle,
  Square,
  Send,
  FileText,
  Captions,
  MessageCircle,
} from "lucide-react";
import { Button, Card, Badge, Input, Textarea, toast } from "@/components/ui";
import { transcreverAudioLocal } from "@/lib/videocalls/local-transcription";
import { whatsappDeepLink } from "@/lib/whatsapp/deep-link";

type Role = "PROFISSIONAL" | "PACIENTE";

type RoomDTO = {
  id: string;
  status: "CRIADA" | "AGUARDANDO" | "EM_ANDAMENTO" | "ENCERRADA" | "CANCELADA";
  patientConsentAt: string | null;
  staffConsentAt: string | null;
};

type SignalDTO = {
  id: string;
  type: "offer" | "answer" | "ice-candidate" | "leave" | "chat";
  fromRole: Role;
  payload: unknown;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  at: string;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const SIGNAL_POLL_MS = 1500;
const ROOM_POLL_MS = 2000;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Falha na requisição");
  return body.data as T;
}

type RecordingKind = "video" | "audio";

/** Dispara o download do blob direto no computador — nada sobe ao servidor. */
function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Grava vídeo (composição via canvas dos dois lados + áudio misturado) ou
 * só o áudio misturado (local+remoto), dependendo de `kind`. As duas
 * gravações são independentes. Nada é enviado ao servidor — o arquivo é
 * baixado direto na máquina de quem grava, pra não ocupar espaço no
 * storage da clínica.
 */
function useCallRecorder(
  kind: RecordingKind,
  ctx: {
    roomId: string;
    role: Role;
    localStreamRef: React.RefObject<MediaStream | null>;
    remoteStreamRef: React.RefObject<MediaStream | null>;
    localVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  },
) {
  const [recording, setRecording] = React.useState(false);
  const [lastBlob, setLastBlob] = React.useState<Blob | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const stop = React.useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;

    const mimeType = kind === "video" ? "video/webm" : "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    setRecording(false);

    if (blob.size === 0) {
      setLastBlob(null);
      return;
    }

    setLastBlob(blob);
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    baixarBlob(blob, `${kind === "video" ? "gravacao-video" : "gravacao-audio"}-${ctx.roomId}-${carimbo}.webm`);
    toast.success(
      kind === "video" ? "Gravação de vídeo baixada." : "Gravação de áudio baixada.",
    );
  }, [kind, ctx.roomId]);

  const start = React.useCallback(() => {
    if (ctx.role !== "PROFISSIONAL") return;

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    let temAudio = false;
    for (const stream of [ctx.localStreamRef.current, ctx.remoteStreamRef.current]) {
      if (!stream) continue;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) continue;
      temAudio = true;
      const source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
      source.connect(destination);
    }
    if (!temAudio) {
      audioCtx.close().catch(() => undefined);
      toast.error("Nenhum áudio disponível para gravar ainda.");
      return;
    }
    audioCtxRef.current = audioCtx;

    let combined: MediaStream;
    let mimeType: string;

    if (kind === "video") {
      const localVideo = ctx.localVideoRef.current;
      const remoteVideo = ctx.remoteVideoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 360;
      const cvsCtx = canvas.getContext("2d");
      if (!localVideo || !remoteVideo || !cvsCtx) {
        audioCtx.close().catch(() => undefined);
        audioCtxRef.current = null;
        return;
      }

      const draw = () => {
        cvsCtx.fillStyle = "#0f172a";
        cvsCtx.fillRect(0, 0, canvas.width, canvas.height);
        if (localVideo.readyState >= 2) cvsCtx.drawImage(localVideo, 0, 0, 480, 360);
        if (remoteVideo.readyState >= 2) cvsCtx.drawImage(remoteVideo, 480, 0, 480, 360);
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();

      const canvasStream = canvas.captureStream(25);
      combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      mimeType = "video/webm;codecs=vp8,opus";
    } else {
      combined = destination.stream;
      mimeType = "audio/webm;codecs=opus";
    }

    const recorder = new MediaRecorder(combined, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
  }, [kind, ctx.role, ctx.localStreamRef, ctx.remoteStreamRef, ctx.localVideoRef, ctx.remoteVideoRef]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  return { recording, lastBlob, start, stop };
}

export function CallRoom({ roomId, role }: { roomId: string; role: Role }) {
  const [room, setRoom] = React.useState<RoomDTO | null>(null);
  const [phase, setPhase] = React.useState<"consent" | "connecting" | "in-call" | "ended">(
    "consent",
  );
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [savingTranscript, setSavingTranscript] = React.useState(false);
  const [transcrevendoAudio, setTranscrevendoAudio] = React.useState(false);
  const [progressoAudio, setProgressoAudio] = React.useState<string | null>(null);
  const [audioTranscrito, setAudioTranscrito] = React.useState<string | null>(null);
  const [enviandoCodigo, setEnviandoCodigo] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);

  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);
  const lastSignalIdRef = React.useRef<string | null>(null);
  const negotiationStartedRef = React.useRef(false);

  const recorderCtx = {
    roomId,
    role,
    localStreamRef,
    remoteStreamRef,
    localVideoRef,
    remoteVideoRef,
  };
  const videoRecorder = useCallRecorder("video", recorderCtx);
  const audioRecorder = useCallRecorder("audio", recorderCtx);

  const otherConsentGiven = (r: RoomDTO | null) =>
    role === "PACIENTE" ? Boolean(r?.staffConsentAt) : Boolean(r?.patientConsentAt);
  const ownConsentGiven = (r: RoomDTO | null) =>
    role === "PACIENTE" ? Boolean(r?.patientConsentAt) : Boolean(r?.staffConsentAt);

  // Poll do status/consentimento da sala.
  React.useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const data = await getJson<RoomDTO>(`/api/videochamadas/${roomId}`);
        if (cancelled) return;
        setRoom(data);
        if (
          phase === "consent" &&
          ownConsentGiven(data) &&
          otherConsentGiven(data)
        ) {
          setPhase("connecting");
        }
        if (data.status === "ENCERRADA" || data.status === "CANCELADA") {
          setPhase((p) => (p === "ended" ? p : "ended"));
        }
      } catch {
        // erro pontual de rede — próxima rodada tenta de novo
      }
    }
    tick();
    const timer = setInterval(tick, ROOM_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, phase]);

  const acceptConsent = React.useCallback(async () => {
    try {
      await getJson(`/api/videochamadas/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "consent" }),
      });
      toast.success("Consentimento registrado. Aguardando o outro lado...");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar consentimento");
    }
  }, [roomId]);

  const enviarCodigoPorWhatsapp = React.useCallback(async () => {
    setEnviandoCodigo(true);
    try {
      const result = await getJson<{ code: string; patient: { fullName: string; phone: string } }>(
        `/api/videochamadas/${roomId}/access-code`,
        { method: "POST" },
      );
      const primeiroNome = result.patient.fullName.split(" ")[0];
      const link = `${window.location.origin}/p/videochamadas/${roomId}`;
      const mensagem =
        `Olá ${primeiroNome}! Aqui está seu código de acesso para a sua consulta por vídeo: ` +
        `*${result.code}*\n\nAcesse por este link: ${link}\n\nVálido por 10 minutos.`;
      window.open(whatsappDeepLink(result.patient.phone, mensagem), "_blank");
      toast.success("Código gerado. Confirme o envio na aba do WhatsApp que abriu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar código de acesso");
    } finally {
      setEnviandoCodigo(false);
    }
  }, [roomId]);

  const sendSignal = React.useCallback(
    async (type: SignalDTO["type"], payload: unknown) => {
      await getJson(`/api/videochamadas/${roomId}/signal`, {
        method: "POST",
        body: JSON.stringify({ type, payload }),
      });
    },
    [roomId],
  );

  /** Idempotente por id — evita duplicar mensagem que já veio pelo histórico ou por outro poll. */
  const adicionarMensagemChat = React.useCallback((msg: ChatMessage) => {
    setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  // Busca o histórico completo do chat (dos dois lados) ao abrir a sala —
  // sem isso, quem reabre a chamada perde as próprias mensagens antigas,
  // já que o poll de sinais só traz mensagens do OUTRO participante.
  React.useEffect(() => {
    let cancelled = false;
    getJson<Array<{ id: string; fromRole: Role; payload: unknown; createdAt: string }>>(
      `/api/videochamadas/${roomId}/chat-messages`,
    )
      .then((historico) => {
        if (cancelled) return;
        for (const msg of historico) {
          const payload = msg.payload as { text?: unknown } | null;
          const text = payload && typeof payload.text === "string" ? payload.text : "";
          if (text) {
            adicionarMensagemChat({ id: msg.id, role: msg.fromRole, text, at: msg.createdAt });
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [roomId, adicionarMensagemChat]);

  const sendChatMessage = React.useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    adicionarMensagemChat({ id: `local-${Date.now()}`, role, text, at: new Date().toISOString() });
    try {
      await sendSignal("chat", { text });
    } catch {
      toast.error("Falha ao enviar mensagem.");
    }
  }, [chatInput, role, sendSignal, adicionarMensagemChat]);

  const saveTranscript = React.useCallback(async () => {
    setSavingTranscript(true);
    try {
      const transcript = await getJson<{ id: string }>(
        `/api/videochamadas/${roomId}/chat-transcript`,
        { method: "POST" },
      );
      window.open(`/api/videochamadas/${roomId}/chat-transcript/${transcript.id}`, "_blank");
      toast.success("Transcrição gravada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar transcrição");
    } finally {
      setSavingTranscript(false);
    }
  }, [roomId]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const transcreverUltimoAudio = React.useCallback(async () => {
    const blob = audioRecorder.lastBlob;
    if (!blob) return;
    setTranscrevendoAudio(true);
    setAudioTranscrito(null);
    setProgressoAudio("Carregando modelo local (só na primeira vez, pode demorar)...");
    try {
      const { text, durationSeconds } = await transcreverAudioLocal(blob, (info) => {
        if (info.status === "progress" && typeof info.progress === "number") {
          setProgressoAudio(`Baixando modelo... ${Math.round(info.progress)}%`);
        } else if (info.status === "ready" || info.status === "done") {
          setProgressoAudio("Transcrevendo áudio no seu navegador...");
        }
      });
      setAudioTranscrito(text || "Nenhuma fala reconhecida no áudio.");
      toast.success("Transcrição concluída (processada localmente).");

      if (text) {
        try {
          await getJson(`/api/videochamadas/${roomId}/audio-transcript`, {
            method: "POST",
            body: JSON.stringify({ text, durationSeconds }),
          });
          toast.success("Transcrição salva no histórico do paciente.");
        } catch {
          toast.error("A transcrição ficou só nesta tela — falha ao salvar no histórico.");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao transcrever o áudio");
    } finally {
      setTranscrevendoAudio(false);
      setProgressoAudio(null);
    }
  }, [audioRecorder.lastBlob, roomId]);

  const baixarTranscricaoAudio = React.useCallback(() => {
    if (!audioTranscrito) return;
    const blob = new Blob([audioTranscrito], { type: "text/plain;charset=utf-8" });
    baixarBlob(blob, `transcricao-audio-${roomId}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  }, [audioTranscrito, roomId]);

  // Evita sair da página por engano durante a chamada (ex.: clicar no menu) e
  // perder a chamada/gravação em andamento. Cobre navegação interna (cliques
  // em <Link>, como os itens do menu) e fechar/recarregar a aba.
  React.useEffect(() => {
    if (phase !== "connecting" && phase !== "in-call") return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function onClickCapture(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;

      const destino = new URL(anchor.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname === window.location.pathname) return;

      const confirmou = window.confirm(
        "Você está em uma chamada ativa. Sair agora encerra a chamada (e qualquer gravação em andamento). Deseja continuar?",
      );
      if (!confirmou) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [phase]);

  // Setup de mídia + WebRTC assim que os dois lados consentirem.
  React.useEffect(() => {
    if (phase !== "connecting") return;
    let cancelled = false;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;

        pc.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) void sendSignal("ice-candidate", event.candidate.toJSON());
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setPhase("in-call");
            void getJson(`/api/videochamadas/${roomId}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "status", status: "EM_ANDAMENTO" }),
            }).catch(() => undefined);
          }
        };

        if (role === "PROFISSIONAL" && !negotiationStartedRef.current) {
          negotiationStartedRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal("offer", offer);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível acessar câmera/microfone");
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Poll de sinais (offer/answer/ICE) do outro lado.
  React.useEffect(() => {
    if (phase !== "connecting" && phase !== "in-call") return;
    let cancelled = false;

    async function tick() {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const url = new URL(`/api/videochamadas/${roomId}/signal`, window.location.origin);
        if (lastSignalIdRef.current) url.searchParams.set("since", lastSignalIdRef.current);
        const signals = await getJson<SignalDTO[]>(url.toString());
        if (cancelled) return;

        for (const signal of signals) {
          lastSignalIdRef.current = signal.id;
          if (signal.type === "offer" && role === "PACIENTE") {
            await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal("answer", answer);
          } else if (signal.type === "answer" && role === "PROFISSIONAL") {
            await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          } else if (signal.type === "ice-candidate") {
            await pc.addIceCandidate(signal.payload as RTCIceCandidateInit).catch(() => undefined);
          } else if (signal.type === "chat") {
            const payload = signal.payload as { text?: unknown } | null;
            const text = payload && typeof payload.text === "string" ? payload.text : "";
            if (text) {
              adicionarMensagemChat({
                id: signal.id,
                role: signal.fromRole,
                text,
                at: signal.createdAt,
              });
            }
          }
        }
      } catch {
        // próxima rodada tenta de novo
      }
    }

    tick();
    const timer = setInterval(tick, SIGNAL_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roomId]);

  const endCall = React.useCallback(async () => {
    if (videoRecorder.recording) await videoRecorder.stop();
    if (audioRecorder.recording) await audioRecorder.stop();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    setPhase("ended");
    try {
      await getJson(`/api/videochamadas/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status: "ENCERRADA" }),
      });
    } catch {
      // sala pode já estar encerrada pelo outro lado
    }
  }, [roomId, videoRecorder, audioRecorder]);

  React.useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, []);

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  if (phase === "ended") {
    return (
      <Card>
        <p className="text-lg font-semibold">Chamada encerrada</p>
        <p className="text-sm text-slate-500">Você já pode fechar esta janela.</p>
      </Card>
    );
  }

  if (phase === "consent") {
    const given = ownConsentGiven(room);
    return (
      <Card className="max-w-lg">
        <p className="text-lg font-semibold">Consentimento para videochamada</p>
        <p className="mt-2 text-sm text-slate-600">
          Esta consulta pode ser gravada em vídeo ou áudio para fins de registro clínico. Ao
          continuar, você concorda em liberar câmera e microfone e, se aplicável, em ser
          gravado(a).
        </p>
        {given ? (
          <p className="mt-4 text-sm text-emerald-600">
            Consentimento registrado. Aguardando o outro participante...
          </p>
        ) : (
          <Button className="mt-4" onClick={acceptConsent}>
            Aceito e quero entrar na chamada
          </Button>
        )}
        {role === "PROFISSIONAL" && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs text-slate-500">
              Se o paciente ainda não tem o código de acesso, gere e envie por WhatsApp.
            </p>
            <Button
              variante="secundario"
              onClick={enviarCodigoPorWhatsapp}
              carregando={enviandoCodigo}
            >
              <MessageCircle className="h-4 w-4" /> Enviar código por WhatsApp
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Card className="border-red-200 bg-red-50 text-red-700">
          {error}
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-0 overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full bg-slate-900 object-cover"
          />
          <div className="p-2 text-xs text-slate-500">Você</div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="aspect-video w-full bg-slate-900 object-cover"
          />
          <div className="p-2 text-xs text-slate-500">
            {phase === "in-call" ? "Outro participante" : "Conectando..."}
          </div>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center gap-2">
        <Button variante="secundario" tamanho="icone" onClick={toggleMic} aria-label="Microfone">
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button variante="secundario" tamanho="icone" onClick={toggleCam} aria-label="Câmera">
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        {role === "PROFISSIONAL" && (
          <>
            <Button
              variante={videoRecorder.recording ? "perigo" : "secundario"}
              onClick={videoRecorder.recording ? videoRecorder.stop : videoRecorder.start}
              disabled={phase !== "in-call"}
            >
              {videoRecorder.recording ? (
                <>
                  <Square className="h-4 w-4" /> Parar vídeo
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4" /> Gravar vídeo
                </>
              )}
            </Button>
            <Button
              variante={audioRecorder.recording ? "perigo" : "secundario"}
              onClick={audioRecorder.recording ? audioRecorder.stop : audioRecorder.start}
              disabled={phase !== "in-call"}
            >
              {audioRecorder.recording ? (
                <>
                  <Square className="h-4 w-4" /> Parar áudio
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4" /> Gravar áudio
                </>
              )}
            </Button>
          </>
        )}
        {videoRecorder.recording && <Badge tone="warning">Gravando vídeo</Badge>}
        {audioRecorder.recording && <Badge tone="warning">Gravando áudio</Badge>}
        {role === "PROFISSIONAL" && (
          <Button
            variante="secundario"
            onClick={saveTranscript}
            disabled={chatMessages.length === 0}
            carregando={savingTranscript}
          >
            <FileText className="h-4 w-4" /> Transcrição do chat
          </Button>
        )}
        {role === "PROFISSIONAL" && (
          <Button
            variante="secundario"
            onClick={transcreverUltimoAudio}
            disabled={!audioRecorder.lastBlob || audioRecorder.recording}
            carregando={transcrevendoAudio}
          >
            <Captions className="h-4 w-4" /> Transcrever áudio gravado
          </Button>
        )}
        <Button variante="perigo" onClick={endCall} className="ml-auto">
          <PhoneOff className="h-4 w-4" /> Encerrar chamada
        </Button>
      </Card>

      {(progressoAudio || audioTranscrito) && (
        <Card className="flex flex-col gap-2 p-3">
          <p className="text-sm font-semibold text-slate-700">Transcrição do áudio (local)</p>
          {progressoAudio && <p className="text-sm text-slate-500">{progressoAudio}</p>}
          {audioTranscrito && (
            <>
              <Textarea readOnly value={audioTranscrito} className="min-h-32" />
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={baixarTranscricaoAudio}
                className="self-start"
              >
                Baixar transcrição (.txt)
              </Button>
            </>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-2 p-3">
        <p className="text-sm font-semibold text-slate-700">Chat</p>
        <div className="flex h-48 flex-col gap-1.5 overflow-y-auto rounded-md bg-slate-50 p-2">
          {chatMessages.length === 0 ? (
            <p className="m-auto text-sm text-slate-400">Nenhuma mensagem ainda.</p>
          ) : (
            chatMessages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-md px-3 py-1.5 text-sm ${
                  m.role === role
                    ? "ml-auto bg-brand-blue text-white"
                    : "bg-white text-slate-800 border border-slate-200"
                }`}
              >
                {m.text}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendChatMessage();
          }}
        >
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            aria-label="Mensagem de chat"
          />
          <Button type="submit" tamanho="icone" aria-label="Enviar mensagem">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
