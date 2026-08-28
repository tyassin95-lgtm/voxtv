import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type {
  Category,
  Channel,
  ContentKind,
  Episode,
  EpgEntry,
  Favorite,
  LibraryStats,
  Movie,
  Playable,
  PlaylistConfig,
  Show,
  SyncProgress,
  WatchProgress,
} from "./types";
import { EMPTY_STATS, EMPTY_SYNC } from "./types";
import {
  computeStats,
  getAll,
  getById,
  getByIndex,
  getContinueWatching,
  getFavorites,
  isFavorite,
  onDbEvent,
  putAll,
  readPlaylistFromStorage,
  listRecent,
  toggleFavorite,
  wipeLibrary,
} from "./db";
import { getSyncState, subscribeSync, syncPlaylist } from "./sync";
import { fetchSeriesEpisodes } from "./xtream";
import { hydrateEpgForChannels } from "./epg";
import { liveStreamUrlVariants, retargetStreamHost, streamHostBases, streamUrlVariants, vodStreamUrlVariants } from "./playback-urls";
import { iptvLog } from "./log";

export function useSyncProgress(): SyncProgress {
  return useSyncExternalStore(subscribeSync, getSyncState, () => EMPTY_SYNC);
}

export function usePlaylist(): PlaylistConfig | null {
  const [playlist, setPlaylist] = useState<PlaylistConfig | null>(null);

  useEffect(() => {
    setPlaylist(readPlaylistFromStorage());
    return onDbEvent("playlist", () => setPlaylist(readPlaylistFromStorage()));
  }, []);

  return playlist;
}

export function useStats(): LibraryStats {
  const [stats, setStats] = useState<LibraryStats>(EMPTY_STATS);
  const refresh = useCallback(() => {
    computeStats().then(setStats).catch(() => setStats(EMPTY_STATS));
  }, []);
  useEffect(() => {
    refresh();
    return onDbEvent("playlist", refresh);
  }, [refresh]);
  const sync = useSyncProgress();
  useEffect(() => {
    if (sync.stats) setStats(sync.stats);
  }, [sync.stats]);
  return stats;
}

export function useCategories(kind: ContentKind): Category[] {
  const [rows, setRows] = useState<Category[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => {
      getByIndex<Category>("categories", "kind", kind).then((list) => {
        if (live) {
          setRows(
            list.sort((a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name)),
          );
        }
      });
    };
    load();
    const off = onDbEvent("playlist", load);
    return () => {
      live = false;
      off();
    };
  }, [kind]);
  return rows;
}

export function useKindLibrary(kind: ContentKind): {
  categories: Category[];
  items: Array<Channel | Movie | Show>;
  loading: boolean;
} {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Array<Channel | Movie | Show>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const store = kind === "live" ? "channels" : kind === "movie" ? "movies" : "shows";
    const load = async () => {
      setLoading(true);
      try {
        const [cats, rows] = await Promise.all([
          getByIndex<Category>("categories", "kind", kind),
          getAll<Channel | Movie | Show>(store),
        ]);
        if (!live) return;
        const orderedCats = cats.sort(
          (a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name),
        );
        setCategories(orderedCats);
        setItems(rows);
        iptvLog("ui", `library ${kind} cats=${orderedCats.length} items=${rows.length}`);
      } catch (err) {
        iptvLog("ui", "library load failed", err);
        if (live) {
          setCategories([]);
          setItems([]);
        }
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    const off = onDbEvent("playlist", () => {
      void load();
    });
    return () => {
      live = false;
      off();
    };
  }, [kind]);

  return { categories, items, loading };
}

export function useContinueWatching(): WatchProgress[] {
  const [rows, setRows] = useState<WatchProgress[]>([]);
  const refresh = useCallback(() => {
    getContinueWatching().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    refresh();
    return onDbEvent("progress", refresh);
  }, [refresh]);
  return rows;
}

export function useFavoriteList(): Favorite[] {
  const [rows, setRows] = useState<Favorite[]>([]);
  const refresh = useCallback(() => {
    getFavorites().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    refresh();
    return onDbEvent("favorites", refresh);
  }, [refresh]);
  return rows;
}

export function useIsFavorite(kind: ContentKind, id: string): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    isFavorite(kind, id).then((v) => live && setOn(v));
    const off = onDbEvent("favorites", () => {
      isFavorite(kind, id).then((v) => live && setOn(v));
    });
    return () => {
      live = false;
      off();
    };
  }, [kind, id]);
  const toggle = useCallback(() => {
    toggleFavorite(kind, id).then(setOn);
  }, [kind, id]);
  return [on, toggle];
}

export function useRecent(kind: "movie" | "show") {
  const [rows, setRows] = useState<Array<Movie | Show>>([]);
  useEffect(() => {
    const store = kind === "movie" ? "movies" : "shows";
    listRecent<Movie | Show>(store, 24).then(setRows).catch(() => setRows([]));
  }, [kind]);
  return rows;
}

export function useEpg(channelId: string | undefined): EpgEntry | undefined {
  const [entry, setEntry] = useState<EpgEntry | undefined>();
  useEffect(() => {
    if (!channelId) return;
    let live = true;
    getById<EpgEntry>("epg", channelId).then((row) => live && setEntry(row));
    return onDbEvent("epg", () => {
      getById<EpgEntry>("epg", channelId).then((row) => live && setEntry(row));
    });
  }, [channelId]);
  return entry;
}

export function useEpgMap(channelIds: string[]): Map<string, EpgEntry> {
  const [map, setMap] = useState<Map<string, EpgEntry>>(new Map());
  const key = channelIds.join("|");
  useEffect(() => {
    let live = true;
    (async () => {
      const next = new Map<string, EpgEntry>();
      for (const id of channelIds) {
        const row = await getById<EpgEntry>("epg", id);
        if (row) next.set(id, row);
      }
      if (live) setMap(next);
    })();
    return () => {
      live = false;
    };
  }, [key]);
  return map;
}

function playbackUrls(primary: string, extra?: string, more: string[] = []): string[] {
  const extras = [extra, primary, ...more].filter((value): value is string => Boolean(value));
  const out: string[] = [];
  for (const url of extras) {
    for (const variant of streamUrlVariants(url)) {
      if (!out.includes(variant)) out.push(variant);
    }
  }
  return out;
}

function xtreamUrlBag(kind: Playable["kind"], id: string, ext: string | undefined, extra: string[] = []): string[] {
  const playlist = readPlaylistFromStorage();
  const creds = playlist?.xtream;
  if (!creds) return extra;
  const streamId = id.replace(/^(live|movie|episode|show):/, "");
  const generated =
    kind === "live"
      ? liveStreamUrlVariants(creds, streamId)
      : vodStreamUrlVariants(creds, kind === "episode" ? "series" : "movie", streamId, ext || "mp4");
  const bases = streamHostBases(creds);
  const out = [...extra];
  for (const url of generated) {
    for (const variant of retargetStreamHost(url, bases)) {
      if (!out.includes(variant)) out.push(variant);
    }
  }
  return out;
}

export async function resolvePlayable(
  kind: Playable["kind"] | "show",
  id: string,
): Promise<Playable | null> {
  if (kind === "live") {
    const ch = await getById<Channel>("channels", id);
    if (!ch) return null;
    const extras = xtreamUrlBag("live", ch.id, ch.containerExtension, [ch.url, ch.directSource ?? ""]);
    return {
      kind: "live",
      id: ch.id,
      title: ch.name,
      poster: ch.logo,
      url: ch.url,
      urls: playbackUrls(ch.url, ch.directSource, extras),
      isLive: true,
    };
  }
  if (kind === "movie") {
    const movie = await getById<Movie>("movies", id);
    if (!movie) return null;
    const extras = xtreamUrlBag("movie", movie.id, movie.containerExtension, [movie.url, movie.directSource ?? ""]);
    return {
      kind: "movie",
      id: movie.id,
      title: movie.name,
      subtitle: movie.year,
      poster: movie.poster,
      url: movie.url,
      urls: playbackUrls(movie.url, movie.directSource, extras),
      isLive: false,
      duration: movie.duration,
    };
  }
  if (kind === "episode") {
    const episode = await getById<Episode>("episodes", id);
    if (!episode) return null;
    const show = await getById<Show>("shows", episode.showId);
    const extras = xtreamUrlBag("episode", episode.id, episode.containerExtension, [episode.url, episode.directSource ?? ""]);
    return {
      kind: "episode",
      id: episode.id,
      title: show?.name || episode.name,
      subtitle: `S${episode.season} · E${episode.episode}  ${episode.name}`,
      poster: episode.thumbnail || show?.poster || "",
      url: episode.url,
      urls: playbackUrls(episode.url, episode.directSource, extras),
      isLive: false,
      showId: episode.showId,
      duration: episode.duration,
    };
  }
  return null;
}

export async function loadShowEpisodes(show: Show): Promise<Episode[]> {
  const existing = await getByIndex<Episode>("episodes", "showId", show.id);
  if (existing.length) return existing.sort((a, b) => a.season - b.season || a.episode - b.episode);
  const playlist = readPlaylistFromStorage();
  if (!playlist) return [];
  iptvLog("xtream:fetch", "loadShowEpisodes", show.id, show.xtreamSeriesId);
  const fetched = await fetchSeriesEpisodes(playlist, show);
  if (fetched.length) await putAll("episodes", fetched);
  iptvLog("store", "episodes saved", show.id, fetched.length);
  return fetched;
}

export async function refreshLibrary(): Promise<void> {
  const playlist = readPlaylistFromStorage();
  if (!playlist) throw new Error("No playlist to refresh.");
  await syncPlaylist(playlist);
}

export async function removePlaylist(): Promise<void> {
  await wipeLibrary();
}

export async function prefetchVisibleEpg(channels: Channel[]) {
  const playlist = readPlaylistFromStorage();
  if (!playlist) return;
  hydrateEpgForChannels(playlist, channels).catch(() => undefined);
}
