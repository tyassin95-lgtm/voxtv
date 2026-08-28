import { classifyItem, parseEpisodeTitle, posterFallback, slugId } from "./classify";
import type { Category, Channel, ContentKind, Episode, Movie, Show } from "./types";
import { yieldToMain } from "@/lib/utils";

export interface ParsedCatalog {
  categories: Category[];
  channels: Channel[];
  movies: Movie[];
  shows: Show[];
  episodes: Episode[];
  epgUrl?: string;
}

interface ExtInf {
  duration: number;
  attrs: Record<string, string>;
  title: string;
}

function parseExtinf(line: string): ExtInf | null {
  if (!line.startsWith("#EXTINF:")) return null;
  const body = line.slice(8);
  const space = body.search(/[\s,]/);
  const duration = parseFloat(space === -1 ? body : body.slice(0, space));
  const rest = space === -1 ? "" : body.slice(space).trim();
  const attrs: Record<string, string> = {};
  const attrRe = /([A-Za-z0-9_-]+)="([^"]*)"/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(rest))) {
    attrs[m[1].toLowerCase()] = m[2];
    lastEnd = attrRe.lastIndex;
  }
  let title = rest.slice(lastEnd).replace(/^,/, "").trim();
  if (!title && lastEnd === 0) title = rest.replace(/^,/, "").trim();
  return { duration: Number.isFinite(duration) ? duration : -1, attrs, title };
}

function attr(attrs: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = attrs[key];
    if (v) return v;
  }
  return "";
}

function extDuration(info: ExtInf): number | undefined {
  return info.duration > 0 ? info.duration : undefined;
}

export async function parseM3u(
  text: string,
  onProgress?: (ratio: number, label: string) => void,
): Promise<ParsedCatalog> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const categories = new Map<string, Category>();
  const channels: Channel[] = [];
  const movies: Movie[] = [];
  const shows = new Map<string, Show>();
  const episodeCount = new Map<string, number>();
  const episodes: Episode[] = [];
  let epgUrl: string | undefined;
  let pending: ExtInf | null = null;
  let pendingGroup = "";
  let liveN = 0;
  let movieN = 0;

  const ensureCategory = (kind: ContentKind, name: string): string => {
    const trimmed = name.trim() || "Uncategorized";
    const id = slugId(kind, trimmed);
    if (!categories.has(id)) categories.set(id, { id, kind, name: trimmed, sortOrder: categories.size });
    return id;
  };

  const total = Math.max(lines.length, 1);
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line) continue;

    if (line.startsWith("#EXTM3U")) {
      const urlMatch = line.match(/url-tvg="([^"]+)"/i) || line.match(/x-tvg-url="([^"]+)"/i);
      if (urlMatch?.[1]) epgUrl = urlMatch[1];
      continue;
    }
    if (line.startsWith("#EXTGRP:")) {
      pendingGroup = line.slice(8).trim();
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      pending = parseExtinf(line);
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!pending) continue;

    const info = pending;
    const url = line;
    pending = null;
    const groupSnap = pendingGroup;
    pendingGroup = "";

    const title = info.title || attr(info.attrs, "tvg-name") || "Untitled";
    const group = attr(info.attrs, "group-title") || groupSnap || "Uncategorized";
    const logo = attr(info.attrs, "tvg-logo", "logo");
    const tvgId = attr(info.attrs, "tvg-id");
    const chno = Number(attr(info.attrs, "tvg-chno"));
    const kind = classifyItem(url, group, title);

    if (kind === "show") {
      const parsed = parseEpisodeTitle(title);
      const showName = parsed?.show ?? title;
      const showId = slugId("show", `${group}:${showName}`);
      const categoryId = ensureCategory("show", group);
      if (!shows.has(showId)) {
        shows.set(showId, {
          id: showId,
          name: showName,
          nameLower: showName.toLowerCase(),
          poster: logo || posterFallback(showName),
          categoryId,
          categoryIds: [categoryId],
          sortOrder: shows.size + 1,
        });
      }
      const season = parsed?.season ?? 1;
      const n = (episodeCount.get(showId) ?? 0) + 1;
      episodeCount.set(showId, n);
      const epNum = parsed?.episode ?? n;
      episodes.push({
        id: `${showId}:s${season}e${epNum}:${n}`,
        showId,
        season,
        episode: epNum,
        name: parsed
          ? `S${String(season).padStart(2, "0")}E${String(epNum).padStart(2, "0")}`
          : title,
        url,
        duration: extDuration(info),
        thumbnail: logo,
      });
    } else if (kind === "movie") {
      movieN += 1;
      movies.push({
        id: slugId("movie", `${group}:${title}:${movieN}`),
        name: title,
        nameLower: title.toLowerCase(),
        poster: logo || posterFallback(title),
        categoryId: ensureCategory("movie", group),
        categoryIds: [ensureCategory("movie", group)],
        url,
        duration: extDuration(info),
        sortOrder: movieN,
      });
    } else {
      liveN += 1;
      channels.push({
        id: slugId("live", `${group}:${title}:${liveN}`),
        name: title,
        nameLower: title.toLowerCase(),
        logo: logo || posterFallback(title),
        categoryId: ensureCategory("live", group),
        categoryIds: [ensureCategory("live", group)],
        url,
        tvgId,
        number: Number.isFinite(chno) && chno > 0 ? chno : undefined,
        sortOrder: Number.isFinite(chno) && chno > 0 ? chno : liveN,
      });
    }

    if (i % 400 === 0) {
      onProgress?.(Math.min(0.99, i / total), "Parsing playlist");
      await yieldToMain();
    }
  }

  onProgress?.(1, "Playlist parsed");
  return {
    categories: [...categories.values()],
    channels,
    movies,
    shows: [...shows.values()],
    episodes,
    epgUrl,
  };
}
