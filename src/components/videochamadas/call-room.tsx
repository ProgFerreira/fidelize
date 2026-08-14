"use client";

import * as React from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Circle, Square } from "lucide-react";
import { Button, Card, Badge, toast } from "@/components/ui";

type Role = "PROFISSIONAL" | "PACIENTE";

type RoomDTO = {
  id: string;
  status: "CRIADA" | "AGUARDANDO" | "EM_ANDAMENTO" | "ENCERRADA" | "CANCELADA";
  patientConsentAt: string | null;
  staffConsentAt: string | null;
};

type SignalDTO = {
  id: string;
  type: "offer" | "answer" | "ice-candidate" | "leave";
  payload: unknown;
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

export function CallRoom({ roomId, role }: { roomId: string; role: Role }) {
  const [room, setRoom] = React.useState<RoomDTO | null>(null);
  const [phase, setPhase] = React.useState<"consent" | "connecting" | "in-call" | "ended">(
    "consent",
  );
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [recording, setRecording] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);
  const lastSignalIdRef = React.useRef<string | null>(null);
  const negotiationStartedRef = React.useRef(false);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number | null>(null);

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

  const sendSignal = React.useCallback(
    async (type: SignalDTO["type"], payload: unknown) => {
      await getJson(`/api/videochamadas/${roomId}/signal`, {
        method: "POST",
        body: JSON.stringify({ type, payload }),
      });
    },
    [roomId],
  );

  const stopRecordingAndUpload = React.useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => undefined);

    const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
    recordedChunksRef.current = [];
    setRecording(false);

    if (blob.size === 0) return;

    try {
      await fetch(`/api/videochamadas/${roomId}/recording`, {
        method: "POST",
        headers: { "Content-Type": "video/webm" },
        body: blob,
      });
      toast.success("Gravação enviada.");
    } catch {
      toast.error("Falha ao enviar a gravação.");
    }
  }, [roomId]);

  const startRecording = React.useCallback(() => {
    if (role !== "PROFISSIONAL") return;
    const canvas = canvasRef.current;
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;
    if (!canvas || !localVideo || !remoteVideo) return;

    canvas.width = 960;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (localVideo.readyState >= 2) ctx.drawImage(localVideo, 0, 0, 480, 360);
      if (remoteVideo.readyState >= 2) ctx.drawImage(remoteVideo, 480, 0, 480, 360);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(25);

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const destination = audioCtx.createMediaStreamDestination();
    for (const stream of [localStreamRef.current, remoteStreamRef.current]) {
      if (!stream) continue;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) continue;
      const source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
      source.connect(destination);
    }

    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const recorder = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp8,opus" });
    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
  }, [role]);

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
    if (recording) await stopRecordingAndUpload();
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
  }, [roomId, recording, stopRecordingAndUpload]);

  React.useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Esta consulta pode ser gravada em vídeo para fins de registro clínico. Ao continuar,
          você concorda em liberar câmera e microfone e, se aplicável, em ser gravado(a).
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
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950">
          {error}
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-0 overflow-hidden">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full bg-slate-900" />
          <div className="p-2 text-xs text-slate-500">Você</div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full bg-slate-900" />
          <div className="p-2 text-xs text-slate-500">
            {phase === "in-call" ? "Outro participante" : "Conectando..."}
          </div>
        </Card>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <Card className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="icone" onClick={toggleMic} aria-label="Microfone">
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="icone" onClick={toggleCam} aria-label="Câmera">
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        {role === "PROFISSIONAL" && (
          <Button
            variant={recording ? "danger" : "secondary"}
            onClick={recording ? stopRecordingAndUpload : startRecording}
            disabled={phase !== "in-call"}
          >
            {recording ? (
              <>
                <Square className="h-4 w-4" /> Parar gravação
              </>
            ) : (
              <>
                <Circle className="h-4 w-4" /> Iniciar gravação
              </>
            )}
          </Button>
        )}
        {recording && <Badge tone="warning">Gravando</Badge>}
        <Button variant="danger" onClick={endCall} className="ml-auto">
          <PhoneOff className="h-4 w-4" /> Encerrar chamada
        </Button>
      </Card>
    </div>
  );
}
