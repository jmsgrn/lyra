/**
 * Microphone recording. Captures mic input as Float32 channel data via a
 * ScriptProcessor (run through a silent gain so it doesn't monitor to the
 * speakers), ready to be WAV-encoded and registered as a sample.
 *
 * node-web-audio-api's types for these realtime/MediaStream bits are partial,
 * so we talk to them through minimal local interfaces (like the superdough
 * wrapper does) to keep our own code fully typed.
 */
import * as nwa from 'node-web-audio-api';
import { getNodeContext } from '../platform/node.js';

interface MicTrack {
  stop?(): void;
}
interface MicStream {
  getTracks?(): MicTrack[];
}
interface MediaDevicesLike {
  getUserMedia(constraints: { audio: boolean }): Promise<MicStream>;
}
interface ProcessEvent {
  inputBuffer: { getChannelData(channel: number): Float32Array };
}
interface ProcessorNode {
  onaudioprocess: ((event: ProcessEvent) => void) | null;
  connect(node: unknown): unknown;
  disconnect(): void;
}
interface GainLike {
  gain: { value: number };
  connect(node: unknown): unknown;
  disconnect(): void;
}
interface SourceLike {
  connect(node: unknown): unknown;
  disconnect(): void;
}
interface RecordingContext {
  sampleRate: number;
  destination: unknown;
  createMediaStreamSource(stream: unknown): SourceLike;
  createScriptProcessor(bufferSize: number, inputChannels: number, outputChannels: number): ProcessorNode;
  createGain(): GainLike;
}

const mediaDevices = (nwa as unknown as { mediaDevices: MediaDevicesLike }).mediaDevices;

interface Session {
  stream: MicStream;
  source: SourceLike;
  processor: ProcessorNode;
  sink: GainLike;
  chunks: Float32Array[];
  sampleRate: number;
}

let session: Session | null = null;

export interface Recording {
  channels: Float32Array[];
  sampleRate: number;
  durationSeconds: number;
}

export function isRecording(): boolean {
  return session !== null;
}

/** Begin capturing mono mic input. Throws if mic access is unavailable. */
export async function startRecording(): Promise<void> {
  if (session) return;
  const ctx = getNodeContext() as unknown as RecordingContext;
  const stream = await mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(Float32Array.from(event.inputBuffer.getChannelData(0)));
  };
  const sink = ctx.createGain();
  sink.gain.value = 0; // keep the processor running without echoing the mic
  source.connect(processor);
  processor.connect(sink);
  sink.connect(ctx.destination);
  session = { stream, source, processor, sink, chunks, sampleRate: ctx.sampleRate };
}

/** Stop capturing and return the recorded audio (or null if nothing/empty). */
export function stopRecording(): Recording | null {
  if (!session) return null;
  const { stream, source, processor, sink, chunks, sampleRate } = session;
  session = null;

  processor.onaudioprocess = null;
  try {
    source.disconnect();
    processor.disconnect();
    sink.disconnect();
  } catch {
    /* nodes may already be detached */
  }
  for (const track of stream.getTracks?.() ?? []) track.stop?.();

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (total === 0) return null;
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return { channels: [merged], sampleRate, durationSeconds: total / sampleRate };
}
