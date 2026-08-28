import { proxiedStreamUrl } from "./proxy.ts";
import type { PlayableKind } from "./types.ts";
import {
  looksHls,
  pickEngine,
  streamUrlVariants,
  type Engine,
} from "./playback-urls.ts";

export type AspectMode = "contain" | "cover" | "fill" | "16:9" | "4:3";
export type { Engine };
export {
  looksHls,
  looksNative,
  looksTs,
  pickEngine,
  streamUrlVariants,
} from "./playback-urls.ts";

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

export function playbackCandidates(url: string, kind: PlayableKind = "live", extras: string[] = []): PlaybackCandidate[] {
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

export function objectFitFor(mode: AspectMode): "contain" | "cover" | "fill" {
  if (mode === "cover") return "cover";
  if (mode === "fill") return "fill";
  return "contain";
}

export function aspectRatioFor(mode: AspectMode): string | undefined {
  if (mode === "16:9") return "16 / 9";
  if (mode === "4:3") return "4 / 3";
  return undefined;
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
  const v = Number(localStorage.getItem(VOLUME_LS));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export function saveVolume(volume: number) {
  localStorage.setItem(VOLUME_LS, String(volume));
}
