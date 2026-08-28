import { normalizeBaseUrl, posterFallback, slugId } from "./classify.ts";
import { fetchRemoteJson } from "./proxy.ts";
import { iptvLog, iptvWarn, redactUrl } from "./log.ts";
import { liveStreamUrlVariants, vodStreamUrlVariants } from "./playback-urls.ts";
import { ensureOrphanCategories } from "./catalog-view.ts";
import {
  asList,
  expandCategoryIds,
  firstBackdrop,
  normalizeEpisodeGroups,
  normalizeId,
  parentCategoryId,
  pickDirectSource,
  pickExt,
  pickStreamId,
  pickString,
  resolveCategoryIds,
  resolveStreamBase,
  unix,
  decodeMaybeBase64,
  summarizePayload,
} from "./xtream-parse.ts";
import type {
  Category,
  Channel,
  ContentKind,
  Episode,
  Movie,
  PlaylistConfig,
  Show,
  XtreamCredentials,
} from "./types.ts";

interface XtreamAuth {
  user_info?: {
    auth?: number | string;
    status?: string;
    message?: string;
    username?: string;
    token?: string;
    allowed_output_formats?: string[] | string;
  };
  server_info?: {
    url?: string;
    port?: string | number;
    https_port?: string | number;
    server_protocol?: string;
  };
}

function apiUrl(creds: XtreamCredentials, extra: Record<string, string | number> = {}): string {
  const base = `${creds.baseUrl.replace(/\/+$/, "")}/player_api.php`;
  const params = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
  return `${base}?${params.toString()}`;
}

export function liveStreamUrl(creds: XtreamCredentials, id: string | number): string {
  return liveStreamUrlVariants(creds, id)[0] ?? "";
}

export function liveStreamTsUrl(creds: XtreamCredentials, id: string | number): string {
  return liveStreamUrlVariants(creds, id).find((url) => url.endsWith(".ts") || url.includes(".ts?")) ?? liveStreamUrl(creds, id);
}

export function movieStreamUrl(creds: XtreamCredentials, id: string | number, ext = "mp4"): string {
  return vodStreamUrlVariants(creds, "movie", id, ext)[0] ?? "";
}

export function seriesStreamUrl(creds: XtreamCredentials, id: string | number, ext = "mp4"): string {
  return vodStreamUrlVariants(creds, "series", id, ext)[0] ?? "";
}

export function xmltvUrl(creds: XtreamCredentials): string {
  return `${creds.baseUrl.replace(/\/+$/, "")}/xmltv.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
}

export function shortEpgUrl(creds: XtreamCredentials, streamId: string, limit = 4): string {
  return apiUrl(creds, { action: "get_short_epg", stream_id: streamId, limit });
}

async function fetchAction(
  creds: XtreamCredentials,
  extra: Record<string, string | number>,
  label: string,
  timeoutMs = 90000,
): Promise<unknown> {
  const url = apiUrl(creds, extra);
  iptvLog("xtream:fetch", label, redactUrl(url));
  try {
    const data = await fetchRemoteJson<unknown>(url, timeoutMs);
    const list = asList(data);
    iptvLog("xtream:parse", label, summarizePayload(data), `normalized=${list.length}`);
    return data;
  } catch (err) {
    iptvWarn("xtream:fetch", label, "failed", err instanceof Error ? err.message : err);
    throw err;
  }
}

async function fetchList(
  creds: XtreamCredentials,
  extra: Record<string, string | number>,
  label: string,
  timeoutMs = 90000,
): Promise<Record<string, unknown>[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await fetchAction(creds, extra, label, timeoutMs);
      const list = asList<Record<string, unknown>>(data);
      if (!list.length) {
        iptvWarn("xtream:parse", label, "empty list after normalize", summarizePayload(data));
      }
      return list;
    } catch (err) {
      lastError = err;
      iptvWarn("xtream:fetch", label, `attempt ${attempt + 1} failed`, err instanceof Error ? err.message : err);
    }
  }
  iptvWarn("xtream:fetch", label, "giving up", lastError instanceof Error ? lastError.message : lastError);
  return [];
}

async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) break;
      results[index] = await worker(item, index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => run()));
  return results;
}

function mapCategories(rows: Record<string, unknown>[], kind: ContentKind): Category[] {
  const categories: Category[] = [];
  const seen = new Set<string>();
  const prefix = kind === "show" ? "show" : kind;
  for (const row of rows) {
    const rawId = pickStreamId(row, "category_id", "id", "categoryId", "cat_id");
    if (rawId === undefined) {
      iptvWarn("xtream:map", kind, "category row missing id", Object.keys(row).slice(0, 8));
      continue;
    }
    const id = `${prefix}:${rawId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const name =
      pickString(row, "category_name", "name", "title") ||
      (kind === "live" ? "Live" : kind === "movie" ? "Movies" : "TV Shows");
    const parentRaw = row.parent_id ?? row.parentId ?? row.parentid ?? row.parent;
    let parentId = parentCategoryId(kind, parentRaw);
    if (parentId === id) parentId = undefined;
    categories.push({ id, kind, name, parentId, sortOrder: categories.length });
  }
  iptvLog("xtream:map", kind, `categories=${categories.length}`);
  return categories;
}

function mapLive(
  row: Record<string, unknown>,
  creds: XtreamCredentials,
  categories: Category[],
  forcedCat?: string,
  index = 0,
): Channel | null {
  const streamId = pickStreamId(row, "stream_id", "id", "live_id", "channel_id");
  if (!streamId) {
    iptvWarn("xtream:map", "live", "stream missing id", Object.keys(row).slice(0, 8));
    return null;
  }
  const name = pickString(row, "name", "title", "stream_display_name") || `Channel ${streamId}`;
  const categoryIds = resolveCategoryIds("live", row, categories, forcedCat);
  const categoryId = categoryIds[0] || "live:uncat";
  const ext = pickExt(row, "m3u8");
  const direct = pickDirectSource(row);
  const num = Number(row.num);
  const sortOrder = Number.isFinite(num) && num > 0 ? num : index + 1;
  return {
    id: `live:${streamId}`,
    name,
    nameLower: name.toLowerCase(),
    logo: pickString(row, "stream_icon", "icon", "cover") || posterFallback(name),
    categoryId,
    categoryIds,
    url: ext === "ts" ? liveStreamTsUrl(creds, streamId) : liveStreamUrl(creds, streamId),
    tvgId: pickString(row, "epg_channel_id", "epg_id", "tvg_id") || streamId,
    number: Number.isFinite(num) && num > 0 ? num : undefined,
    sortOrder,
    added: unix(row.added ?? row.added_at),
    directSource: direct,
    containerExtension: ext,
  };
}

function mapMovie(
  row: Record<string, unknown>,
  creds: XtreamCredentials,
  categories: Category[],
  forcedCat?: string,
  index = 0,
): Movie | null {
  const streamId = pickStreamId(row, "stream_id", "id", "vod_id", "movie_id");
  if (!streamId) {
    iptvWarn("xtream:map", "movie", "stream missing id", Object.keys(row).slice(0, 8));
    return null;
  }
  const name = pickString(row, "name", "title") || `Movie ${streamId}`;
  const categoryIds = resolveCategoryIds("movie", row, categories, forcedCat);
  const categoryId = categoryIds[0] || "movie:uncat";
  const ext = pickExt(row, "mp4");
  const num = Number(row.num);
  return {
    id: `movie:${streamId}`,
    name,
    nameLower: name.toLowerCase(),
    poster: pickString(row, "stream_icon", "cover", "movie_image", "icon") || posterFallback(name),
    backdrop: firstBackdrop(row.backdrop_path ?? row.backdrop),
    plot: pickString(row, "plot", "description", "overview"),
    year: pickString(row, "year", "releaseDate", "releasedate")?.slice(0, 4),
    rating: pickString(row, "rating", "rating_5based"),
    categoryId,
    categoryIds,
    url: movieStreamUrl(creds, streamId, ext),
    added: unix(row.added ?? row.added_at),
    sortOrder: Number.isFinite(num) && num > 0 ? num : index + 1,
    containerExtension: ext,
    duration: row.duration_secs ? Number(row.duration_secs) : undefined,
    directSource: pickDirectSource(row),
  };
}

function mapShow(row: Record<string, unknown>, categories: Category[], forcedCat?: string, index = 0): Show | null {
  const seriesId = pickStreamId(row, "series_id", "id", "stream_id", "show_id");
  if (!seriesId) {
    iptvWarn("xtream:map", "show", "series missing id", Object.keys(row).slice(0, 8));
    return null;
  }
  const name = pickString(row, "name", "title") || `Show ${seriesId}`;
  const categoryIds = resolveCategoryIds("show", row, categories, forcedCat);
  const categoryId = categoryIds[0] || "show:uncat";
  const num = Number(row.num);
  return {
    id: `show:${seriesId}`,
    name,
    nameLower: name.toLowerCase(),
    poster: pickString(row, "cover", "stream_icon", "poster") || posterFallback(name),
    backdrop: firstBackdrop(row.backdrop_path ?? row.backdrop),
    plot: pickString(row, "plot", "description", "overview"),
    year: pickString(row, "year", "releaseDate", "releasedate")?.slice(0, 4),
    rating: pickString(row, "rating"),
    categoryId,
    categoryIds,
    added: unix(row.last_modified ?? row.added),
    sortOrder: Number.isFinite(num) && num > 0 ? num : index + 1,
    xtreamSeriesId: seriesId,
  };
}

function isUncategorized(id: string | undefined): boolean {
  return Boolean(id && /:(uncat)$/.test(id));
}

function mergeById<T extends { id: string; categoryId: string; categoryIds?: string[] }>(
  existing: T[],
  incoming: T[],
): T[] {
  const map = new Map<string, T>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    const ids = new Set<string>();
    for (const id of [prev.categoryId, item.categoryId, ...(prev.categoryIds ?? []), ...(item.categoryIds ?? [])]) {
      if (id) ids.add(id);
    }
    const real = [...ids].filter((id) => !isUncategorized(id));
    const categoryIds = real.length ? real : [...ids];
    const categoryId =
      categoryIds.find((id) => id === prev.categoryId && !isUncategorized(id)) ||
      categoryIds.find((id) => id === item.categoryId && !isUncategorized(id)) ||
      categoryIds[0] ||
      prev.categoryId ||
      item.categoryId;
    map.set(item.id, {
      ...prev,
      ...item,
      categoryIds,
      categoryId,
      sortOrder: (prev as { sortOrder?: number }).sortOrder ?? (item as { sortOrder?: number }).sortOrder,
    });
  }
  return [...map.values()];
}

function emptyCategoryIds(
  categories: Category[],
  items: Array<{ categoryId: string; categoryIds?: string[] }>,
): string[] {
  const filled = new Set<string>();
  for (const item of items) {
    filled.add(item.categoryId);
    for (const id of item.categoryIds ?? []) filled.add(id);
  }
  return categories
    .filter((category) => {
      const tree = expandCategoryIds(categories, category.id);
      return tree.every((id) => !filled.has(id));
    })
    .map((category) => category.id);
}

async function hydrateCategoryContents<T extends { id: string; categoryId: string; categoryIds?: string[] }>(opts: {
  creds: XtreamCredentials;
  kind: "live" | "movie" | "show";
  action: string;
  categories: Category[];
  items: T[];
  mapRow: (row: Record<string, unknown>, forcedCat: string, index: number) => T | null;
  onProgress?: (ratio: number, label: string) => void;
  progressFrom: number;
  progressTo: number;
}): Promise<T[]> {
  const targets = opts.categories.map((category) => category.id);
  if (!targets.length) {
    iptvLog("xtream:map", opts.kind, "no categories to hydrate", opts.items.length);
    return opts.items;
  }
  iptvLog("xtream:map", opts.kind, `hydrating ${targets.length} categories (bulk items=${opts.items.length})`);
  let merged = opts.items;
  const total = targets.length;
  const additions = await mapPool(targets, 6, async (categoryId, index) => {
    const rawId = categoryId.replace(/^(live|movie|show):/, "");
    opts.onProgress?.(
      opts.progressFrom + ((index + 1) / Math.max(total, 1)) * (opts.progressTo - opts.progressFrom),
      `Loading ${opts.kind} category ${index + 1}/${total}`,
    );
    const rows = await fetchList(
      opts.creds,
      { action: opts.action, category_id: rawId },
      `${opts.action} category_id=${rawId}`,
      45000,
    );
    const mapped = rows
      .map((row, rowIndex) => opts.mapRow(row, rawId, rowIndex))
      .filter((row): row is T => Boolean(row));
    iptvLog("xtream:map", opts.kind, `category ${rawId} → ${mapped.length} items`);
    return mapped;
  });
  for (const mapped of additions) {
    if (mapped?.length) merged = mergeById(merged, mapped);
  }
  const stillEmpty = emptyCategoryIds(opts.categories, merged);
  iptvLog(
    "xtream:map",
    opts.kind,
    `after hydrate: items=${merged.length}, remaining empty=${stillEmpty.length}`,
    stillEmpty.slice(0, 12),
  );
  if (stillEmpty.length) {
    iptvWarn("xtream:map", opts.kind, "categories still empty after per-category fetch", stillEmpty);
  }
  return merged;
}

function parseAllowedFormats(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map((entry) => String(entry).toLowerCase());
  if (typeof value === "string") return value.split(/[,|]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return undefined;
}

export async function xtreamLogin(
  creds: XtreamCredentials,
): Promise<{ name: string; streamBaseUrl: string; token?: string; allowedFormats?: string[] }> {
  const data = await fetchRemoteJson<XtreamAuth>(apiUrl(creds), 25000);
  const auth = data.user_info?.auth;
  const status = data.user_info?.status;
  const ok = auth === 1 || auth === "1" || status === "Active" || status === "active";
  if (!ok) {
    throw new Error(data.user_info?.message || "Xtream login failed. Check server, username, and password.");
  }
  const streamBaseUrl = resolveStreamBase(creds.baseUrl, data.server_info);
  const token = pickString((data.user_info ?? {}) as Record<string, unknown>, "token");
  const allowedFormats = parseAllowedFormats(data.user_info?.allowed_output_formats);
  iptvLog("xtream:fetch", "login ok", redactUrl(streamBaseUrl), allowedFormats?.join(",") || "formats=default");
  return {
    name: data.server_info?.url || data.user_info?.username || "Xtream playlist",
    streamBaseUrl,
    token,
    allowedFormats,
  };
}

export function parseXtreamInput(server: string, username: string, password: string): XtreamCredentials {
  return {
    baseUrl: normalizeBaseUrl(server),
    username: username.trim(),
    password: password.trim(),
  };
}

export async function fetchXtreamCatalog(
  creds: XtreamCredentials,
  onProgress?: (ratio: number, label: string) => void,
): Promise<{
  categories: Category[];
  channels: Channel[];
  movies: Movie[];
  shows: Show[];
  name: string;
  streamBaseUrl: string;
  token?: string;
  allowedFormats?: string[];
}> {
  onProgress?.(0.04, "Signing in");
  const login = await xtreamLogin(creds);
  const resolved: XtreamCredentials = {
    ...creds,
    streamBaseUrl: login.streamBaseUrl,
    token: login.token,
    allowedFormats: login.allowedFormats,
  };

  onProgress?.(0.1, "Fetching live categories");
  const liveCats = mapCategories(await fetchList(creds, { action: "get_live_categories" }, "get_live_categories"), "live");

  onProgress?.(0.16, "Fetching live channels");
  const liveRows = await fetchList(creds, { action: "get_live_streams" }, "get_live_streams");
  let channels = liveRows
    .map((row, index) => mapLive(row, resolved, liveCats, undefined, index))
    .filter((row): row is Channel => Boolean(row));
  iptvLog("xtream:map", "live bulk", `rows=${liveRows.length} mapped=${channels.length} cats=${liveCats.length}`);

  onProgress?.(0.22, "Matching live categories");
  channels = await hydrateCategoryContents({
    creds,
    kind: "live",
    action: "get_live_streams",
    categories: liveCats,
    items: channels,
    mapRow: (row, forced, index) => mapLive(row, resolved, liveCats, forced, index),
    onProgress,
    progressFrom: 0.22,
    progressTo: 0.36,
  });

  onProgress?.(0.38, "Fetching movie categories");
  const vodCats = mapCategories(await fetchList(creds, { action: "get_vod_categories" }, "get_vod_categories"), "movie");

  onProgress?.(0.44, "Fetching movies");
  const vodRows = await fetchList(creds, { action: "get_vod_streams" }, "get_vod_streams");
  let movies = vodRows
    .map((row, index) => mapMovie(row, resolved, vodCats, undefined, index))
    .filter((row): row is Movie => Boolean(row));
  iptvLog("xtream:map", "movie bulk", `rows=${vodRows.length} mapped=${movies.length} cats=${vodCats.length}`);

  onProgress?.(0.5, "Matching movie categories");
  movies = await hydrateCategoryContents({
    creds,
    kind: "movie",
    action: "get_vod_streams",
    categories: vodCats,
    items: movies,
    mapRow: (row, forced, index) => mapMovie(row, resolved, vodCats, forced, index),
    onProgress,
    progressFrom: 0.5,
    progressTo: 0.64,
  });

  onProgress?.(0.66, "Fetching TV show categories");
  const seriesCats = mapCategories(
    await fetchList(creds, { action: "get_series_categories" }, "get_series_categories"),
    "show",
  );

  onProgress?.(0.72, "Fetching TV shows");
  const seriesRows = await fetchList(creds, { action: "get_series" }, "get_series");
  let shows = seriesRows
    .map((row, index) => mapShow(row, seriesCats, undefined, index))
    .filter((row): row is Show => Boolean(row));
  iptvLog("xtream:map", "show bulk", `rows=${seriesRows.length} mapped=${shows.length} cats=${seriesCats.length}`);

  onProgress?.(0.78, "Matching TV show categories");
  shows = await hydrateCategoryContents({
    creds,
    kind: "show",
    action: "get_series",
    categories: seriesCats,
    items: shows,
    mapRow: (row, forced, index) => mapShow(row, seriesCats, forced, index),
    onProgress,
    progressFrom: 0.78,
    progressTo: 0.88,
  });

  const liveWithOrphans = ensureOrphanCategories("live", liveCats, channels);
  const movieWithOrphans = ensureOrphanCategories("movie", vodCats, movies);
  const showWithOrphans = ensureOrphanCategories("show", seriesCats, shows);
  const categories = [...liveWithOrphans, ...movieWithOrphans, ...showWithOrphans];

  iptvLog(
    "xtream:map",
    `catalog liveCats=${liveWithOrphans.length} channels=${channels.length} movieCats=${movieWithOrphans.length} movies=${movies.length} showCats=${showWithOrphans.length} shows=${shows.length}`,
  );

  onProgress?.(0.9, "Saving library");
  return {
    categories,
    channels,
    movies,
    shows,
    name: login.name,
    streamBaseUrl: login.streamBaseUrl,
    token: login.token,
    allowedFormats: login.allowedFormats,
  };
}

export async function fetchSeriesEpisodes(config: PlaylistConfig, show: Show): Promise<Episode[]> {
  if (config.type !== "xtream" || !config.xtream || !show.xtreamSeriesId) return [];
  const creds = config.xtream;
  iptvLog("xtream:fetch", "get_series_info", show.xtreamSeriesId);
  let data: Record<string, unknown> = {};
  try {
    data = await fetchRemoteJson<Record<string, unknown>>(
      apiUrl(creds, { action: "get_series_info", series_id: show.xtreamSeriesId }),
    );
  } catch (err) {
    iptvWarn("xtream:fetch", "get_series_info failed", err instanceof Error ? err.message : err);
    return [];
  }
  const episodes: Episode[] = [];
  const rawEpisodes = data.episodes ?? data.episodes_info ?? data.data;
  const groups = normalizeEpisodeGroups(rawEpisodes);
  iptvLog("xtream:parse", "series episodes groups", groups.length, summarizePayload(rawEpisodes));
  for (const group of groups) {
    for (const ep of group.episodes) {
      const episodeId = pickStreamId(ep, "id", "stream_id", "episode_id");
      if (!episodeId) continue;
      const episodeNum = Number(ep.episode_num ?? ep.episode ?? ep.num) || 0;
      const ext = pickExt(ep, "mp4");
      const info = ep.info && typeof ep.info === "object" ? (ep.info as Record<string, unknown>) : {};
      episodes.push({
        id: `episode:${episodeId}`,
        showId: show.id,
        season: Number(ep.season || group.season) || group.season || 1,
        episode: episodeNum,
        name: pickString(ep, "title", "name") || pickString(info, "name", "title") || `Episode ${episodeNum}`,
        plot: pickString(info, "plot", "description") || pickString(ep, "plot"),
        url: seriesStreamUrl(creds, episodeId, ext),
        duration: Number(info.duration_secs ?? ep.duration_secs) || undefined,
        containerExtension: ext,
        thumbnail: pickString(info, "movie_image", "cover") || show.poster,
        added: unix(ep.added),
        directSource: pickDirectSource(ep),
      });
    }
  }
  iptvLog("xtream:map", "series", show.xtreamSeriesId, `episodes=${episodes.length}`);
  return episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
}

export async function fetchShortEpg(
  creds: XtreamCredentials,
  liveId: string,
): Promise<{ title: string; start: number; end: number; description?: string }[]> {
  const streamId = liveId.replace(/^live:/, "");
  const data = await fetchRemoteJson<Record<string, unknown>>(shortEpgUrl(creds, streamId, 4), 20000);
  const listings = asList<Record<string, unknown>>(data.epg_listings ?? data);
  return listings.map((row) => {
    const start = Number(row.start_timestamp) || Date.parse(String(row.start || "")) / 1000;
    const end = Number(row.stop_timestamp) || Date.parse(String(row.end || "")) / 1000;
    return {
      title: decodeMaybeBase64(pickString(row, "title")) || "Program",
      start: start || 0,
      end: end || 0,
      description: decodeMaybeBase64(pickString(row, "description")),
    };
  });
}

export { slugId, normalizeId };
