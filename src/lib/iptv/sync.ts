import { parseM3u } from "./m3u";
import { fetchXtreamCatalog, xmltvUrl } from "./xtream";
import { importXmltv } from "./epg";
import {
  computeStats,
  emitDb,
  replaceCatalog,
  setMeta,
  writePlaylistToStorage,
} from "./db";
import { fetchRemoteText } from "./proxy";
import { yieldToMain } from "@/lib/utils";
import type { LibraryStats, PlaylistConfig, SyncProgress } from "./types";
import { EMPTY_STATS, EMPTY_SYNC } from "./types";
import { iptvLog, iptvWarn } from "./log";

export type SyncListener = (state: SyncProgress) => void;

const listeners = new Set<SyncListener>();
let current: SyncProgress = { ...EMPTY_SYNC };
let running: Promise<LibraryStats> | null = null;

export function subscribeSync(fn: SyncListener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function getSyncState(): SyncProgress {
  return current;
}

function emit(patch: Partial<SyncProgress>) {
  current = { ...current, ...patch };
  for (const fn of listeners) fn(current);
}

export async function syncPlaylist(config: PlaylistConfig, isFirst = false): Promise<LibraryStats> {
  if (running) return running;
  running = (async () => {
    emit({ active: true, progress: 0.02, phase: "Connecting to playlist", error: null, stats: null });
    try {
      if (config.type === "m3u") {
        if (!config.m3uUrl) throw new Error("Playlist URL is missing.");
        emit({ progress: 0.08, phase: "Downloading playlist" });
        const text = await fetchRemoteText(config.m3uUrl, 120000);
        if (!text.includes("#EXT")) {
          throw new Error("That URL does not look like a valid M3U playlist.");
        }
        const parsed = await parseM3u(text, (ratio, label) => {
          emit({ progress: 0.1 + ratio * 0.55, phase: label });
        });
        emit({ progress: 0.72, phase: "Caching your library" });
        await yieldToMain();
        await replaceCatalog({
          categories: parsed.categories,
          channels: parsed.channels,
          movies: parsed.movies,
          shows: parsed.shows,
          episodes: parsed.episodes,
        });
        const nextConfig = { ...config, epgUrl: parsed.epgUrl || config.epgUrl };
        writePlaylistToStorage(nextConfig);
        await setMeta("playlist", nextConfig);
        emitDb("playlist");

        if (parsed.epgUrl && parsed.channels.length) {
          emit({ progress: 0.88, phase: "Loading TV guide" });
          try {
            await importXmltv(parsed.epgUrl, parsed.channels);
          } catch {
            /* EPG is optional */
          }
        }
      } else {
        if (!config.xtream) throw new Error("Xtream login details are missing.");
        const catalog = await fetchXtreamCatalog(config.xtream, (ratio, label) => {
          emit({ progress: Math.min(0.82, ratio * 0.82), phase: label });
        });
        emit({ progress: 0.86, phase: "Caching your library" });
        await replaceCatalog({
          categories: catalog.categories,
          channels: catalog.channels,
          movies: catalog.movies,
          shows: catalog.shows,
          episodes: [],
        });
        const nextConfig = {
          ...config,
          name: catalog.name || config.name,
          xtream: {
            ...config.xtream,
            streamBaseUrl: catalog.streamBaseUrl || config.xtream.streamBaseUrl,
            token: catalog.token || config.xtream.token,
            allowedFormats: catalog.allowedFormats || config.xtream.allowedFormats,
          },
        };
        writePlaylistToStorage(nextConfig);
        await setMeta("playlist", nextConfig);
        emitDb("playlist");
        iptvLog(
          "store",
          "xtream catalog stored",
          `channels=${catalog.channels.length} movies=${catalog.movies.length} shows=${catalog.shows.length} categories=${catalog.categories.length}`,
        );

        if (catalog.channels.length) {
          emit({ progress: 0.92, phase: "Loading TV guide" });
          try {
            await importXmltv(xmltvUrl(config.xtream), catalog.channels);
          } catch (err) {
            iptvWarn("store", "xmltv optional failed", err instanceof Error ? err.message : err);
          }
        }
      }

      const stats = await computeStats();
      if (stats.channels + stats.movies + stats.shows === 0) {
        throw new Error("The playlist connected, but it contains no channels, movies, or shows.");
      }
      await setMeta("stats", stats);
      await setMeta("lastSync", Date.now());
      emit({ active: false, progress: 1, phase: "Ready", stats, error: null });
      emitDb("playlist");
      return stats;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Playlist sync failed.";
      iptvWarn("store", "sync failed", message);
      emit({ active: false, error: message, phase: "Sync failed" });
      if (isFirst) {
        const stats = await computeStats().catch(() => EMPTY_STATS);
        if (stats.channels + stats.movies + stats.shows === 0) {
          writePlaylistToStorage(null);
          emitDb("playlist");
        }
      }
      throw err;
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function addPlaylist(config: PlaylistConfig): Promise<LibraryStats> {
  writePlaylistToStorage(config);
  emitDb("playlist");
  return syncPlaylist(config, true);
}
