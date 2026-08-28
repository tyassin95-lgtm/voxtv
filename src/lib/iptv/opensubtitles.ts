/**
 * OpenSubtitles.org lookup used when a stream carries no usable subtitle
 * track. Runs on the server (the API blocks browser origins and ships
 * gzipped SRT files), and only ever deals with English and Arabic.
 */
import { iptvLog, iptvWarn } from "./log.ts";
import {
  isSubtitleLang,
  langLabel,
  type SubtitleHit,
  type SubtitleLang,
} from "./subtitle-types.ts";

export type { SubtitleHit, SubtitleLang };

const SEARCH_HOST = "https://rest.opensubtitles.org/search";
/** The legacy REST endpoint rejects requests without this header. */
const OS_USER_AGENT = "TemporaryUserAgent";
const MAX_RESULTS = 12;
const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

/** Strip release noise so "Movie.Name.2019.1080p.WEB" still matches. */
export function normalizeQuery(raw: string): string {
  return raw
    .replace(/\.(mkv|mp4|avi|ts|m3u8)$/i, "")
    .replace(
      /\b(1080p|720p|480p|2160p|4k|uhd|hdr|web-?dl|webrip|bluray|brrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|aac|ac3|dts|hdtv|multi|dual|sub|vo?stfr)\b/gi,
      " ",
    )
    .replace(/[[\]()_.\-–—:|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Legacy REST paths are made of alphabetically ordered `key-value` segments.
 */
export function buildSearchPath(opts: {
  query: string;
  langs: SubtitleLang[];
  season?: number;
  episode?: number;
}): string {
  const segments: string[] = [];
  if (opts.episode && opts.episode > 0) segments.push(`episode-${opts.episode}`);
  segments.push(`query-${encodeURIComponent(opts.query)}`);
  if (opts.season && opts.season > 0) segments.push(`season-${opts.season}`);
  const langs = opts.langs.length ? opts.langs : ["eng" as SubtitleLang];
  segments.push(`sublanguageid-${[...new Set(langs)].join(",")}`);
  return `${SEARCH_HOST}/${segments.join("/")}`;
}

interface RawHit {
  IDSubtitleFile?: string;
  SubFileName?: string;
  SubLanguageID?: string;
  LanguageName?: string;
  SubFormat?: string;
  SubDownloadsCnt?: string | number;
  SubRating?: string | number;
  SubDownloadLink?: string;
  MovieReleaseName?: string;
  MovieName?: string;
}

export function parseSearchResults(payload: unknown, langs: SubtitleLang[]): SubtitleHit[] {
  if (!Array.isArray(payload)) return [];
  const wanted = new Set(langs);
  const hits: SubtitleHit[] = [];
  for (const row of payload as RawHit[]) {
    const lang = String(row?.SubLanguageID ?? "").toLowerCase();
    const id = String(row?.IDSubtitleFile ?? "");
    if (!id || !isSubtitleLang(lang) || !wanted.has(lang)) continue;
    const format = String(row?.SubFormat ?? "srt").toLowerCase();
    if (format !== "srt" && format !== "vtt") continue;
    hits.push({
      id,
      name: String(row?.SubFileName || row?.MovieReleaseName || row?.MovieName || `Subtitle ${id}`),
      lang,
      langLabel: langLabel(lang),
      format,
      downloads: Number(row?.SubDownloadsCnt ?? 0) || 0,
      rating: Number(row?.SubRating ?? 0) || 0,
      downloadUrl: String(row?.SubDownloadLink ?? ""),
      release: row?.MovieReleaseName ? String(row.MovieReleaseName) : undefined,
    });
  }
  const byLang = new Map<SubtitleLang, SubtitleHit[]>();
  for (const hit of hits) {
    const bucket = byLang.get(hit.lang) ?? [];
    bucket.push(hit);
    byLang.set(hit.lang, bucket);
  }
  // Interleave languages so a mixed search never buries one of them.
  const ordered: SubtitleHit[] = [];
  const buckets = [...byLang.values()].map((bucket) =>
    bucket.sort((a, b) => b.downloads - a.downloads || b.rating - a.rating),
  );
  for (let i = 0; ordered.length < MAX_RESULTS; i++) {
    let added = false;
    for (const bucket of buckets) {
      const hit = bucket[i];
      if (!hit) continue;
      ordered.push(hit);
      added = true;
      if (ordered.length >= MAX_RESULTS) break;
    }
    if (!added) break;
  }
  return ordered;
}

async function osFetch(url: string, accept: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchOrThrow(url, accept, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOrThrow(url: string, accept: string, signal: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        "X-User-Agent": OS_USER_AGENT,
        "User-Agent": OS_USER_AGENT,
        Accept: accept,
        "Accept-Encoding": "gzip, identity",
      },
      redirect: "follow",
      signal,
    });
  } catch (err) {
    iptvWarn("subs", "network", err instanceof Error ? err.message : err);
    throw new Error("Could not reach OpenSubtitles. Check your connection and try again.");
  }
}

export async function searchSubtitles(opts: {
  query: string;
  langs: SubtitleLang[];
  season?: number;
  episode?: number;
}): Promise<SubtitleHit[]> {
  const query = normalizeQuery(opts.query);
  if (!query) return [];
  const url = buildSearchPath({ ...opts, query });
  iptvLog("subs", "search", query, opts.langs.join(","));
  const res = await osFetch(url, "application/json", 15000);
  if (!res.ok) {
    iptvWarn("subs", "search failed", res.status);
    throw new Error(
      res.status === 429
        ? "OpenSubtitles is rate limiting requests. Try again in a minute."
        : `OpenSubtitles search failed (${res.status}).`,
    );
  }
  const payload = (await res.json().catch(() => null)) as unknown;
  const hits = parseSearchResults(payload, opts.langs);
  iptvLog("subs", "search results", hits.length);
  return hits;
}

function isOpenSubtitlesUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "opensubtitles.org" || host.endsWith(".opensubtitles.org");
  } catch {
    return false;
  }
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export function looksGzipped(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** UTF-8 when it decodes cleanly, otherwise the usual Latin/Arabic codepages. */
export function decodeSubtitleBytes(bytes: Uint8Array, lang: SubtitleLang): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    const fallback = lang === "ara" ? "windows-1256" : "windows-1252";
    try {
      return new TextDecoder(fallback).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

function vttTimestamp(raw: string): string {
  const value = raw.trim().replace(",", ".");
  // WebVTT needs at least mm:ss.mmm; SRT always ships hh:mm:ss,mmm.
  return value;
}

/**
 * SRT files in the wild carry SSA/ASS override blocks and <font> tags that
 * WebVTT does not understand and would render as literal text.
 */
export function cleanCueText(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/<\/?font[^>]*>/gi, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** Convert SubRip (or pass through WebVTT) into a cue list the browser accepts. */
export function srtToVtt(input: string): string {
  const text = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!text) return "WEBVTT\n\n";
  const body = text.startsWith("WEBVTT") ? text.slice(6).trimStart() : text;
  const blocks = body.split(/\n{2,}/);
  const cues: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (!lines.length) continue;
    let index = 0;
    if (/^\d+$/.test(lines[0]!.trim()) && lines[1]?.includes("-->")) index = 1;
    const timing = lines[index];
    if (!timing || !timing.includes("-->")) continue;
    const [start, rest] = timing.split("-->");
    if (!start || !rest) continue;
    const end = rest.trim().split(/\s+/)[0] ?? "";
    const payload = cleanCueText(lines.slice(index + 1).join("\n"));
    if (!payload) continue;
    cues.push(`${vttTimestamp(start)} --> ${vttTimestamp(end)}\n${payload}`);
  }
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export async function downloadSubtitle(opts: {
  id: string;
  lang: SubtitleLang;
  url?: string;
}): Promise<string> {
  const candidates = [
    opts.url && isOpenSubtitlesUrl(opts.url) ? opts.url : "",
    `https://dl.opensubtitles.org/en/download/subencoding-utf8/file/${encodeURIComponent(opts.id)}`,
  ].filter(Boolean);

  let lastError = "Could not download that subtitle.";
  for (const url of candidates) {
    try {
      const res = await osFetch(url, "*/*", 20000);
      if (!res.ok) {
        lastError = `OpenSubtitles download failed (${res.status}).`;
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_SUBTITLE_BYTES) {
        lastError = "That subtitle file is too large.";
        continue;
      }
      const raw = looksGzipped(buf) ? await gunzip(buf) : buf;
      const text = decodeSubtitleBytes(raw, opts.lang);
      const vtt = srtToVtt(text);
      if (!/-->/.test(vtt)) {
        lastError = "That subtitle file could not be read.";
        continue;
      }
      iptvLog("subs", "download ok", opts.id, vtt.length);
      return vtt;
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
      iptvWarn("subs", "download failed", lastError);
    }
  }
  throw new Error(lastError);
}
