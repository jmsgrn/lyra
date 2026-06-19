/**
 * Spike A — prove the native audio layer works under Node.
 *
 * 1. Offline render of a 440 Hz sine, then assert the produced PCM is
 *    non-silent. This is hard, hearing-independent proof that the DSP graph
 *    actually generates samples.
 * 2. Realtime playback of the same tone to the default output device (audible
 *    on a machine with speakers).
 */
import { AudioContext, OfflineAudioContext } from '../audio/webaudio-shim.js';

function peakAmplitude(channel: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < channel.length; i++) {
    const v = Math.abs(channel[i]!);
    if (v > peak) peak = v;
  }
  return peak;
}

async function offlineProof(): Promise<void> {
  const sampleRate = 44100;
  const seconds = 0.25;
  const ctx = new OfflineAudioContext(1, sampleRate * seconds, sampleRate);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 440;

  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  osc.connect(gain).connect(ctx.destination);
  osc.start(0);
  osc.stop(seconds);

  const rendered = await ctx.startRendering();
  const peak = peakAmplitude(rendered.getChannelData(0));
  const ok = peak > 0.1;
  console.log(
    `[offline] rendered ${rendered.length} frames @ ${rendered.sampleRate}Hz, peak amplitude = ${peak.toFixed(3)} -> ${ok ? 'PASS' : 'FAIL'}`,
  );
  if (!ok) throw new Error('offline render produced silence');
}

async function realtimePlayback(): Promise<void> {
  const ctx = new AudioContext();
  console.log(`[realtime] AudioContext state=${ctx.state} sampleRate=${ctx.sampleRate}`);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 440;

  const gain = ctx.createGain();
  // short attack/release so it doesn't click
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
  gain.gain.setValueAtTime(0.4, t + 0.4);
  gain.gain.linearRampToValueAtTime(0, t + 0.5);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);

  await new Promise((r) => setTimeout(r, 800));
  await ctx.close();
  console.log('[realtime] played 440Hz tone (audible if speakers are connected)');
}

await offlineProof();
await realtimePlayback();
console.log('Spike A complete: native node-web-audio-api audio path works.');
process.exit(0); // node-web-audio-api keeps the audio thread alive; force exit
