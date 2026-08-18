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
        // Força fp32: o decodificador quantizado (q8, padrão da lib) tem um bug
        // conhecido no runtime ONNX atual ("Missing required scale" no
        // MatMulNBits) que impede a sessão de ser criada. fp32 é mais pesado
        // pra baixar, mas é a variante garantida de funcionar.
        dtype: "fp32",
      });
      return transcriber as unknown as TranscriberFn;
    })();
  }
  return transcriberPromise;
}

/** Decodifica o Blob gravado (webm) e reamostra para mono 16kHz — formato que o Whisper espera. */
async function blobParaFloat32Mono16k(
  blob: Blob,
): Promise<{ audio: Float32Array; durationSeconds: number }> {
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
    return { audio: rendered.getChannelData(0), durationSeconds: decodedBuffer.duration };
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

const TAXA_AMOSTRAGEM = 16000;
// Whisper só processa ~30s por passagem. A opção de chunking embutida da lib
// (chunk_length_s/stride_length_s) tem bugs conhecidos que retornam texto
// vazio em algumas versões — em vez disso, fatiamos o áudio nós mesmos e
// chamamos o modelo uma vez por trecho, sem esse parâmetro.
const JANELA_SEGUNDOS = 30;

export async function transcreverAudioLocal(
  blob: Blob,
  onProgress?: (info: ProgressoTranscricao) => void,
): Promise<{ text: string; durationSeconds: number }> {
  const [transcriber, { audio, durationSeconds }] = await Promise.all([
    getTranscriber(onProgress),
    blobParaFloat32Mono16k(blob),
  ]);

  const tamanhoJanela = JANELA_SEGUNDOS * TAXA_AMOSTRAGEM;
  const partes: string[] = [];

  for (let inicio = 0; inicio < audio.length; inicio += tamanhoJanela) {
    onProgress?.({
      status: "transcribing",
      progress: Math.min(99, Math.round((inicio / audio.length) * 100)),
    });
    const trecho = audio.subarray(inicio, inicio + tamanhoJanela);
    const resultado = await transcriber(trecho, {
      language: "portuguese",
      task: "transcribe",
    });
    const texto = Array.isArray(resultado)
      ? resultado.map((r) => r.text).join(" ")
      : resultado.text;
    if (texto.trim()) partes.push(texto.trim());
  }

  return { text: partes.join(" ").trim(), durationSeconds: Math.round(durationSeconds) };
}
