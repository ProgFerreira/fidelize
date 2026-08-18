import { Badge, EmptyState } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  CRIADA: "Criada",
  AGUARDANDO: "Aguardando",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
};

const STATUS_TONE: Record<string, string> = {
  CRIADA: "muted",
  AGUARDANDO: "warning",
  EM_ANDAMENTO: "success",
  ENCERRADA: "muted",
};

export type VideoCallHistoryItem = {
  id: string;
  status: string;
  createdAt: string | Date;
  chatTranscripts: Array<{ id: string; content: string; messageCount: number; createdAt: string | Date }>;
  audioTranscripts: Array<{ id: string; text: string; durationSeconds: number | null; createdAt: string | Date }>;
};

function formatarDuracao(segundos: number | null) {
  if (!segundos) return null;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}min${seg > 0 ? ` ${seg}s` : ""}`;
}

export function VideoCallHistoryCard({ items }: { items: VideoCallHistoryItem[] }) {
  return (
    <section className="patient-detail__panel">
      <div className="patient-detail__panel-head">
        <div>
          <h3 className="patient-detail__panel-title">Consultas em vídeo</h3>
          <p className="patient-detail__panel-desc">
            Transcrições das videochamadas — o vídeo/áudio gravado fica só no
            computador de quem atendeu.
          </p>
        </div>
        {items.length > 0 ? (
          <span className="patient-detail__panel-count">
            {items.length} chamada{items.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          titulo="Sem videochamadas"
          descricao="Este paciente ainda não teve nenhuma consulta em vídeo registrada."
        />
      ) : (
        <div className="patient-detail__list">
          {items.map((room) => (
            <div key={room.id} className="patient-detail__row" style={{ display: "block" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="patient-detail__row-title">
                  {new Date(room.createdAt).toLocaleString("pt-BR")}
                </p>
                <Badge tone={STATUS_TONE[room.status]}>
                  {STATUS_LABEL[room.status] ?? room.status}
                </Badge>
              </div>

              {room.chatTranscripts.length === 0 && room.audioTranscripts.length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">Nenhuma transcrição salva.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {room.chatTranscripts.map((t) => (
                    <details key={t.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        Chat da consulta · {t.messageCount} mensagem
                        {t.messageCount === 1 ? "" : "ns"} ·{" "}
                        {new Date(t.createdAt).toLocaleString("pt-BR")}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                        {t.content}
                      </pre>
                    </details>
                  ))}
                  {room.audioTranscripts.map((t) => (
                    <details key={t.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        Transcrição do áudio
                        {formatarDuracao(t.durationSeconds)
                          ? ` · ${formatarDuracao(t.durationSeconds)}`
                          : ""}{" "}
                        · {new Date(t.createdAt).toLocaleString("pt-BR")}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                        {t.text}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
