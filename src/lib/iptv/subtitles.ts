/**
 * Browser side of the OpenSubtitles lookup. Everything network-facing goes
 * through `/api/iptv/subtitles` so the app never talks to opensubtitles.org
 * directly (CORS, gzip and legacy charsets are handled on the server).
 */
import type { Playable } from "./types.ts";
import { SUBTITLE_LANGS, type SubtitleHit, type SubtitleLang } from "./subtitle-types.ts";

export type { SubtitleHit, SubtitleLang };
export { SUBTITLE_LANGS };

export interface SubtitleSearchInput {
  query: string;
  langs: SubtitleLang[];
  season?: number;
  episode?: number;
}

/** Best-effort title / season / episode for the currently playing item. */
export function subtitleQueryFor(
  item: Pick<Playable, "kind" | "title" | "subtitle">,
): SubtitleSearchInput {
  const langs: SubtitleLang[] = ["eng"];
  if (item.kind !== "episode") return { query: item.title, langs };
  const match = /S\s*(\d{1,3})\s*[·x•|-]?\s*E\s*(\d{1,4})/i.exec(item.subtitle ?? "");
  return {
    query: item.title,
    langs,
    season: match ? Number(match[1]) : undefined,
    episode: match ? Number(match[2]) : undefined,
  };
}

function cacheKey(input: SubtitleSearchInput): string {
  return [
    input.query.trim().toLowerCase(),
    [...input.langs].sort().join(","),
    input.season ?? "",
    input.episode ?? "",
  ].join("|");
}

const searchCache = new Map<string, SubtitleHit[]>();
const vttCache = new Map<string, string>();

export async function searchSubtitles(
  input: SubtitleSearchInput,
  signal?: AbortSignal,
): Promise<SubtitleHit[]> {
  const key = cacheKey(input);
  const cached = searchCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({
    action: "search",
    q: input.query,
    lang: input.langs.join(","),
  });
  if (input.season) params.set("season", String(input.season));
  if (input.episode) params.set("episode", String(input.episode));
  const res = await fetch(`/api/iptv/subtitles?${params.toString()}`, { signal });
  const payload = (await res.json().catch(() => null)) as {
    results?: SubtitleHit[];
    error?: string;
  } | null;
  if (!res.ok || !payload || payload.error) {
    throw new Error(payload?.error || "Subtitle search failed.");
  }
  const results = payload.results ?? [];
  searchCache.set(key, results);
  return results;
}

/** Downloads a subtitle as WebVTT and returns an object URL for a <track>. */
export async function loadSubtitleTrackUrl(
  hit: SubtitleHit,
  signal?: AbortSignal,
): Promise<string> {
  const cached = vttCache.get(hit.id);
  if (cached) return cached;
  const params = new URLSearchParams({ action: "download", id: hit.id, lang: hit.lang });
  if (hit.downloadUrl) params.set("u", hit.downloadUrl);
  const res = await fetch(`/api/iptv/subtitles?${params.toString()}`, { signal });
  const text = await res.text();
  if (!res.ok) {
    let message = "Could not download that subtitle.";
    try {
      message = (JSON.parse(text) as { error?: string }).error || message;
    } catch {
      /* plain text error */
    }
    throw new Error(message);
  }
  const url = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
  vttCache.set(hit.id, url);
  return url;
}

export function releaseSubtitleUrls() {
  for (const url of vttCache.values()) URL.revokeObjectURL(url);
  vttCache.clear();
}
