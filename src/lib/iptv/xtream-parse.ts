import type { Category, ContentKind } from "./types.ts";

const WRAPPER_KEYS = [
  "js",
  "streams",
  "vods",
  "movies",
  "series",
  "categories",
  "episodes",
  "data",
  "items",
  "results",
  "available_channels",
  "response",
  "output",
  "list",
  "channels",
  "lives",
  "live",
  "vod",
  "rows",
];

const META_KEYS = new Set([
  "user_info",
  "server_info",
  "info",
  "seasons",
  "status",
  "message",
  "auth",
  "server",
  "pagination",
  "meta",
]);

export function asList<T = Record<string, unknown>>(data: unknown): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data.filter((row) => row != null) as T[];
  if (typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const key of WRAPPER_KEYS) {
    const nested = obj[key];
    if (Array.isArray(nested)) return asList<T>(nested);
    if (nested && typeof nested === "object") {
      const unwrapped = asList<T>(nested);
      if (unwrapped.length) return unwrapped;
    }
  }
  const values = Object.entries(obj)
    .filter(([key, value]) => !META_KEYS.has(key) && value != null && typeof value === "object")
    .map(([, value]) => value);
  if (values.length === 0) return [];
  if (values.every((value) => value && typeof value === "object" && !Array.isArray(value))) {
    return values as T[];
  }
  return [];
}

export function normalizeId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return undefined;
  if (Array.isArray(value)) return undefined;
  if (typeof value === "object") return undefined;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return undefined;
  if (/^0+$/.test(text)) return "0";
  if (/^\d+$/.test(text)) return text.replace(/^0+/, "");
  return text;
}

export function collectCategoryIds(item: Record<string, unknown> | null | undefined): string[] {
  if (!item) return [];
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      for (const entry of value) add(entry);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      add(record.category_id ?? record.categoryId ?? record.cat_id ?? record.id);
      return;
    }
    const text = String(value).trim();
    if (!text) return;
    for (const part of text.split(/[,|;]/)) {
      const id = normalizeId(part);
      if (id !== undefined) ids.add(id);
    }
  };
  add(item.category_id);
  add(item.category_ids);
  add(item.categoryId);
  add(item.categoryIds);
  add(item.cat_id);
  add(item.catid);
  add(item.categories);
  add(item.category);
  add(item.group_id);
  add(item.category_id_list);
  return [...ids];
}

export function prefixedCategoryIds(kind: ContentKind, rawIds: string[]): string[] {
  const prefix = kind === "live" ? "live" : kind === "movie" ? "movie" : "show";
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of rawIds) {
    const normalized = normalizeId(id);
    if (normalized === undefined) continue;
    const prefixed = `${prefix}:${normalized}`;
    if (seen.has(prefixed)) continue;
    seen.add(prefixed);
    out.push(prefixed);
  }
  return out;
}

function looksLikeNumericCategoryId(value: string): boolean {
  return /^\d+$/.test(value);
}

export function resolveCategoryIds(
  kind: ContentKind,
  row: Record<string, unknown>,
  categories: Category[],
  forcedCat?: string,
): string[] {
  const prefix = kind === "live" ? "live" : kind === "movie" ? "movie" : "show";
  const known = new Set(categories.map((category) => category.id));
  const raw = collectCategoryIds(row);
  if (forcedCat && !raw.includes(forcedCat)) raw.push(forcedCat);
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  const matchName = (hint: string | undefined) => {
    if (!hint) return;
    for (const part of hint.split(/[,|;/]/)) {
      const lower = part.toLowerCase().trim();
      if (!lower) continue;
      for (const category of categories) {
        if (category.name.toLowerCase() === lower) add(category.id);
      }
    }
  };
  for (const entry of raw) {
    const prefixed = `${prefix}:${entry}`;
    if (known.has(prefixed) || looksLikeNumericCategoryId(entry) || entry === "uncat" || forcedCat === entry) {
      add(prefixed);
    } else {
      matchName(entry);
    }
  }
  const categoryObj =
    row.category && typeof row.category === "object" && !Array.isArray(row.category)
      ? (row.category as Record<string, unknown>)
      : null;
  matchName(pickString(row, "category_name", "genre", "group_title", "group"));
  matchName(typeof row.category === "string" ? row.category : undefined);
  matchName(categoryObj ? pickString(categoryObj, "name", "title", "category_name") : undefined);
  if (!ids.length) add(fallbackCategoryId(kind));
  return ids;
}

export function fallbackCategoryId(kind: ContentKind): string {
  if (kind === "live") return "live:uncat";
  if (kind === "movie") return "movie:uncat";
  return "show:uncat";
}

export function pickStreamId(item: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const id = normalizeId(item[key]);
    if (id !== undefined) return id;
  }
  return undefined;
}

export function pickString(item: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function pickExt(item: Record<string, unknown>, fallback = "mp4"): string {
  const info = item.info && typeof item.info === "object" ? (item.info as Record<string, unknown>) : {};
  const raw =
    pickString(item, "container_extension", "containerExtension", "extension", "ext", "container") ||
    pickString(info, "container_extension", "containerExtension", "extension", "ext", "container") ||
    fallback;
  return raw.replace(/^\./, "").toLowerCase() || fallback;
}

export function pickDirectSource(item: Record<string, unknown>): string | undefined {
  const raw = pickString(item, "direct_source", "directSource", "source", "stream_url", "url");
  if (!raw) return undefined;
  if (!/^https?:\/\//i.test(raw)) return undefined;
  if (/player_api\.php/i.test(raw)) return undefined;
  return raw;
}

export function parentCategoryId(kind: ContentKind, parentRaw: unknown): string | undefined {
  const id = normalizeId(parentRaw);
  if (id === undefined || id === "0") return undefined;
  const prefix = kind === "live" ? "live" : kind === "movie" ? "movie" : "show";
  return `${prefix}:${id}`;
}

export function expandCategoryIds(categories: Category[], selectedId: string): string[] {
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = children.get(category.parentId) ?? [];
    list.push(category.id);
    children.set(category.parentId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    for (const child of children.get(id) ?? []) walk(child);
  };
  walk(selectedId);
  return out;
}

export function leafCategoryIds(categories: Array<{ id: string; parentId?: string }>): Set<string> {
  const parents = new Set(categories.map((c) => c.parentId).filter(Boolean) as string[]);
  const leaves = categories.filter((c) => !parents.has(c.id));
  if (!leaves.length) return new Set(categories.map((c) => c.id));
  return new Set(leaves.map((c) => c.id));
}

export function firstBackdrop(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof first === "string" ? first : undefined;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

export function unix(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? n : Math.floor(n / 1000);
}

export function decodeMaybeBase64(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0 && value.length > 8) {
      const decoded = atob(value);
      if (/^[\x20-\x7E\s]+$/.test(decoded)) return decoded;
    }
  } catch {
    /* keep original */
  }
  return value;
}

export function parseJsonPayload(text: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const start = trimmed.search(/[\[{]/);
  const payload = start >= 0 ? trimmed.slice(start) : trimmed;
  return JSON.parse(payload);
}

export function resolveStreamBase(
  portalBase: string,
  serverInfo?: {
    url?: string;
    port?: string | number;
    https_port?: string | number;
    server_protocol?: string;
  },
): string {
  if (!serverInfo?.url) return portalBase;
  const hostRaw = String(serverInfo.url).trim();
  if (!hostRaw) return portalBase;
  const protoFromHost = hostRaw.match(/^https?:\/\//i)?.[0]?.replace("://", "").toLowerCase();
  const proto = (serverInfo.server_protocol || protoFromHost || "http").replace("://", "").toLowerCase();
  const host = hostRaw.replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/:\d+$/, "");
  if (!host) return portalBase;
  const portValue = proto === "https" ? serverInfo.https_port : serverInfo.port;
  const port =
    portValue !== undefined && portValue !== null && String(portValue).trim() !== ""
      ? String(portValue).trim()
      : "";
  const skipPort = !port || (proto === "http" && port === "80") || (proto === "https" && port === "443");
  return `${proto}://${host}${skipPort ? "" : `:${port}`}`;
}

export interface NormalizedEpisodeGroup {
  season: number;
  episodes: Record<string, unknown>[];
}

export function normalizeEpisodeGroups(raw: unknown): NormalizedEpisodeGroup[] {
  if (!raw) return [];
  const groups: NormalizedEpisodeGroup[] = [];

  const asEpisodeList = (value: unknown): Record<string, unknown>[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    }
    if (typeof value === "object") return asList<Record<string, unknown>>(value);
    return [];
  };

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (
      Array.isArray(raw[0]) ||
      (raw[0] &&
        typeof raw[0] === "object" &&
        !("id" in (raw[0] as object) ||
          "episode_num" in (raw[0] as object) ||
          "stream_id" in (raw[0] as object)))
    ) {
      raw.forEach((entry, index) => {
        const list = asEpisodeList(entry);
        if (list.length) groups.push({ season: index + 1, episodes: list });
      });
      if (groups.length) return groups;
    }
    const bySeason = new Map<number, Record<string, unknown>[]>();
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const season = Number(row.season ?? row.season_number ?? row.season_num ?? 1) || 1;
      const list = bySeason.get(season) ?? [];
      list.push(row);
      bySeason.set(season, list);
    }
    return [...bySeason.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([season, episodes]) => ({ season, episodes }));
  }

  if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const list = asEpisodeList(value);
      if (!list.length) continue;
      const season = Number(key) || Number(list[0]?.season) || 1;
      groups.push({ season, episodes: list });
    }
    groups.sort((a, b) => a.season - b.season);
  }
  return groups;
}

export function summarizePayload(data: unknown): string {
  if (data == null) return "null";
  if (Array.isArray(data)) return `array(${data.length})`;
  if (typeof data !== "object") return typeof data;
  const keys = Object.keys(data as object).slice(0, 12);
  return `object{${keys.join(",")}}`;
}
