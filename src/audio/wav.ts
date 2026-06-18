/**
 * Minimal 16-bit PCM WAV encoder. Takes per-channel Float32 sample data (as
 * from an AudioBuffer's getChannelData) and returns a complete WAV file buffer.
 * Used for generated test samples and for saving recordings.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Buffer {
  const numChannels = Math.max(1, channels.length);
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM fmt chunk size
  buf.writeUInt16LE(1, 20); // audio format = PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch]?.[frame] ?? 0));
      buf.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, offset);
      offset += 2;
    }
  }
  return buf;
}

/** Generate a mono sine tone as Float32 channel data (handy for test samples). */
export function sineChannel(freq: number, seconds: number, sampleRate: number): Float32Array {
  const n = Math.floor(seconds * sampleRate);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // gentle fade out so it doesn't click
    const env = 1 - i / n;
    data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.8 * env;
  }
  return data;
}
