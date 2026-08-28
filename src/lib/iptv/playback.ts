import { proxiedStreamUrl } from "./proxy.ts";
import type { PlayableKind } from "./types.ts";
import { looksHls, pickEngine, streamUrlVariants, type Engine } from "./playback-urls.ts";

export type AspectMode = "contain" | "cover" | "fill" | "16:9" | "4:3";
export type { Engine };
export { looksHls, looksNative, looksTs, pickEngine, streamUrlVariants } from "./playback-urls.ts";

export interface PlaybackCandidate {
  url: string;
  engine: Engine;
  source: string;
}

export const ASPECT_MODES: { id: AspectMode; label: string }[] = [
  { id: "contain", label: "Fit" },
  { id: "cover", label: "Fill" },
  { id: "fill", label: "Stretch" },
  { id: "16:9", label: "16:9" },
  { id: "4:3", label: "4:3" },
];

export function playbackCandidates(
  url: string,
  kind: PlayableKind = "live",
  extras: string[] = [],
): PlaybackCandidate[] {
  const raws = [...extras, url].filter(Boolean);
  const variants: string[] = [];
  for (const raw of raws) {
    for (const variant of streamUrlVariants(raw, kind)) {
      if (!variants.includes(variant)) variants.push(variant);
    }
  }

  const candidates: PlaybackCandidate[] = [];
  const seen = new Set<string>();
  const add = (source: string, engine: Engine) => {
    const proxied = proxiedStreamUrl(source);
    const key = `${engine}:${proxied}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ url: proxied, engine, source });
  };

  for (const variant of variants) {
    const engine = pickEngine(variant);
    if (kind === "live" && engine === "hls") {
      add(variant, "mpegts");
      add(variant, "hls");
      continue;
    }
    add(variant, engine);
    if (engine === "hls") add(variant, "mpegts");
    if (engine === "native" && looksHls(variant)) add(variant, "hls");
    if (kind === "live" && engine === "native") add(variant, "mpegts");
    if (kind === "live" && engine === "mpegts") add(variant, "hls");
  }

  return candidates;
}

/**
 * The engine a URL announces by itself. Probing costs an extra connection to
 * the provider before playback can start — and providers commonly cap
 * concurrent connections — so a decisive extension skips it.
 */
export function confidentEngine(url: string): Engine | null {
  const clean = url.split("#")[0] ?? url;
  if (/\.m3u8(\?|$)/i.test(clean)) return "hls";
  if (/\.ts(\?|$)/i.test(clean)) return "mpegts";
  if (/\.(mp4|m4v|mkv|mov|webm)(\?|$)/i.test(clean)) return "native";
  return null;
}

export function objectFitFor(mode: AspectMode): "contain" | "cover" | "fill" {
  if (mode === "cover") return "cover";
  if (mode === "fill") return "fill";
  return "contain";
}

export function aspectRatioFor(mode: AspectMode): number | undefined {
  if (mode === "16:9") return 16 / 9;
  if (mode === "4:3") return 4 / 3;
  return undefined;
}

export interface VideoBox {
  width: number;
  height: number;
  objectFit: "contain" | "cover" | "fill";
}

/**
 * Resolve the exact pixel box the <video> should occupy for an aspect mode.
 *
 * The video element fills its container, so a CSS `aspect-ratio` alone is
 * ignored (both dimensions are already definite). Forced ratios therefore need
 * a measured box: letterbox the container to the target ratio and stretch the
 * picture into it.
 */
export function videoBoxFor(mode: AspectMode, containerW: number, containerH: number): VideoBox {
  const width = Math.max(0, Math.round(containerW));
  const height = Math.max(0, Math.round(containerH));
  const ratio = aspectRatioFor(mode);
  if (!ratio || width === 0 || height === 0) {
    return { width, height, objectFit: objectFitFor(mode) };
  }
  const boxed =
    width / height > ratio
      ? { width: Math.round(height * ratio), height }
      : { width, height: Math.round(width / ratio) };
  return { ...boxed, objectFit: "fill" };
}

const ASPECT_LS = "vox-iptv-aspect";
const VOLUME_LS = "vox-iptv-volume";

export function loadAspect(): AspectMode {
  if (typeof localStorage === "undefined") return "contain";
  const v = localStorage.getItem(ASPECT_LS);
  if (ASPECT_MODES.some((m) => m.id === v)) return v as AspectMode;
  return "contain";
}

export function saveAspect(mode: AspectMode) {
  localStorage.setItem(ASPECT_LS, mode);
}

export function loadVolume(): number {
  if (typeof localStorage === "undefined") return 1;
  const raw = localStorage.getItem(VOLUME_LS);
  // `Number(null)` is 0, which used to start every stream silent.
  if (raw === null || raw === "") return 1;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export function saveVolume(volume: number) {
  localStorage.setItem(VOLUME_LS, String(volume));
}
