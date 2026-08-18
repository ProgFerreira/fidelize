"use client";

/**
 * Transcrição de áudio 100% local no navegador — o áudio nunca sai da
 * máquina do médico. Usa Whisper via @huggingface/transformers (WASM).
 * O import da lib é dinâmico: só baixa/carrega o modelo quando o médico
 * clicar em "Transcrever", nunca no carregamento da página.
 */

const MODEL_ID = "Xenova/whisper-base";

type TranscriberFn = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string } | Array<{ text: string }>>;

let transcriberPromise: Promise<TranscriberFn> | null = null;

export type ProgressoTranscricao = { status: string; progress?: number; file?: string };

function getTranscriber(onProgress?: (info: ProgressoTranscricao) => void) {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
        progress_callback: onProgress as never,
      });
      return transcriber as unknown as TranscriberFn;
    })();
  }
  return transcriberPromise;
}

/** Decodifica o Blob gravado (webm) e reamostra para mono 16kHz — formato que o Whisper espera. */
async function blobParaFloat32Mono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const taxaAlvo = 16000;
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decodedBuffer.duration * taxaAlvo),
      taxaAlvo,
    );
    const source = offline.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

export async function transcreverAudioLocal(
  blob: Blob,
  onProgress?: (info: ProgressoTranscricao) => void,
): Promise<string> {
  const [transcriber, audio] = await Promise.all([
    getTranscriber(onProgress),
    blobParaFloat32Mono16k(blob),
  ]);

  const resultado = await transcriber(audio, {
    language: "portuguese",
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  if (Array.isArray(resultado)) {
    return resultado.map((r) => r.text).join(" ").trim();
  }
  return resultado.text.trim();
}
