/**
 * Cache maintenance used by the settings screen: everything the app persists
 * lives in the `vox-iptv` IndexedDB database, `vox-iptv-*` storage keys and the
 * PWA cache storage, so each level of reset is a well-defined subset of those.
 */
import {
  clearStores,
  computeStats,
  deleteDatabase,
  emitDb,
  readPlaylistFromStorage,
  writePlaylistToStorage,
} from "./db";
import { iptvLog } from "./log";
import type { LibraryStats } from "./types";

const STORAGE_PREFIX = "vox-iptv";
/** Kept when clearing settings: it is credentials, not cache. */
const PLAYLIST_KEY = "vox-iptv-playlist";

export interface CacheReport {
  stats: LibraryStats;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function readCacheReport(): Promise<CacheReport> {
  const stats = await computeStats().catch(() => null);
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate().catch(() => null);
    usageBytes = estimate?.usage ?? null;
    quotaBytes = estimate?.quota ?? null;
  }
  return {
    stats: stats ?? {
      channels: 0,
      movies: 0,
      shows: 0,
      episodes: 0,
      categories: 0,
      hasMovieDates: false,
      hasShowDates: false,
    },
    usageBytes,
    quotaBytes,
  };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function clearPrefixedStorage(store: Storage | undefined, keepPlaylist: boolean) {
  if (!store) return;
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    if (keepPlaylist && key === PLAYLIST_KEY) continue;
    doomed.push(key);
  }
  for (const key of doomed) store.removeItem(key);
}

async function clearCacheStorage() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys().catch(() => [] as string[]);
  await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
}

/** Drops the cached catalog but keeps the playlist, favorites and history. */
export async function clearLibraryCache(): Promise<void> {
  iptvLog("cache", "clear library");
  await clearStores(["channels", "movies", "shows", "episodes", "categories", "epg"]);
  clearPrefixedStorage(typeof sessionStorage === "undefined" ? undefined : sessionStorage, false);
  emitDb("playlist");
}

/** Drops favorites and continue-watching, keeping the catalog itself. */
export async function clearWatchData(): Promise<void> {
  iptvLog("cache", "clear watch data");
  await clearStores(["favorites", "progress"]);
  emitDb("favorites");
  emitDb("progress");
}

/** Clears player preferences (aspect, volume, sort, keyboard language). */
export async function clearPreferences(): Promise<void> {
  iptvLog("cache", "clear preferences");
  clearPrefixedStorage(typeof localStorage === "undefined" ? undefined : localStorage, true);
  clearPrefixedStorage(typeof sessionStorage === "undefined" ? undefined : sessionStorage, false);
}

/**
 * Full reset: deletes the database, every app storage key and the PWA caches,
 * leaving the app exactly as it was on first launch (onboarding screen).
 */
export async function resetApp(): Promise<void> {
  iptvLog("cache", "full reset");
  const playlist = readPlaylistFromStorage();
  await deleteDatabase();
  clearPrefixedStorage(typeof localStorage === "undefined" ? undefined : localStorage, false);
  clearPrefixedStorage(typeof sessionStorage === "undefined" ? undefined : sessionStorage, false);
  await clearCacheStorage();
  if (playlist) writePlaylistToStorage(null);
  emitDb("playlist");
  emitDb("favorites");
  emitDb("progress");
}
