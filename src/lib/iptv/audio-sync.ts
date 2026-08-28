/**
 * Manual audio/video sync for VOD playback.
 *
 * A media element renders its own audio, so the only relative shift a browser
 * can apply is on the audio path: the element is routed through a Web Audio
 * DelayNode, which holds the sound back until it lines up with the picture.
 * The graph is built lazily on the first adjustment so ordinary playback never
 * depends on Web Audio being available.
 */
import { iptvWarn } from "./log.ts";

export const AUDIO_DELAY_MAX_MS = 3000;
export const AUDIO_DELAY_STEP_MS = 50;
export const AUDIO_DELAY_COARSE_MS = 250;

interface AudioGraph {
  ctx: AudioContext;
  delay: DelayNode;
}

/** A media element can only ever be wired into one Web Audio source node. */
const graphs = new WeakMap<HTMLMediaElement, AudioGraph>();

export function clampAudioDelay(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  const stepped = Math.round(ms / AUDIO_DELAY_STEP_MS) * AUDIO_DELAY_STEP_MS;
  return Math.min(AUDIO_DELAY_MAX_MS, Math.max(0, stepped));
}

export function formatAudioDelay(ms: number): string {
  return ms === 0 ? "0 ms" : `+${ms} ms`;
}

function buildGraph(video: HTMLVideoElement): AudioGraph | null {
  const Ctor: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    const source = ctx.createMediaElementSource(video);
    const delay = ctx.createDelay(AUDIO_DELAY_MAX_MS / 1000 + 0.5);
    delay.delayTime.value = 0;
    source.connect(delay);
    delay.connect(ctx.destination);
    const graph = { ctx, delay };
    graphs.set(video, graph);
    return graph;
  } catch (err) {
    iptvWarn("player", "audio sync unavailable", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Applies an audio delay in milliseconds. Returns false when the browser will
 * not let us route the element through Web Audio, so the caller can tell the
 * user instead of silently doing nothing.
 */
export function applyAudioDelay(video: HTMLVideoElement | null, ms: number): boolean {
  if (!video) return false;
  const delayMs = clampAudioDelay(ms);
  const graph = graphs.get(video) ?? (delayMs === 0 ? null : buildGraph(video));
  if (!graph) return delayMs === 0;
  if (graph.ctx.state === "suspended") void graph.ctx.resume().catch(() => undefined);
  const seconds = delayMs / 1000;
  try {
    graph.delay.delayTime.setTargetAtTime(seconds, graph.ctx.currentTime, 0.02);
  } catch {
    graph.delay.delayTime.value = seconds;
  }
  return true;
}

/** Autoplay policies suspend the context; nudge it back on every play. */
export function resumeAudioGraph(video: HTMLVideoElement | null) {
  if (!video) return;
  const graph = graphs.get(video);
  if (graph && graph.ctx.state === "suspended") void graph.ctx.resume().catch(() => undefined);
}

export function hasAudioGraph(video: HTMLVideoElement | null): boolean {
  return Boolean(video && graphs.has(video));
}
