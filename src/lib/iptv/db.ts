import type {
  Category,
  Channel,
  Episode,
  EpgEntry,
  Favorite,
  LibraryStats,
  Movie,
  PlaylistConfig,
  Show,
  WatchProgress,
} from "./types";
import { EMPTY_STATS } from "./types";
import { iptvLog } from "./log";

const DB_NAME = "vox-iptv";
const DB_VERSION = 3;
const PLAYLIST_LS = "vox-iptv-playlist";
const PUT_CHUNK = 400;

type StoreName =
  | "channels"
  | "movies"
  | "shows"
  | "episodes"
  | "categories"
  | "epg"
  | "favorites"
  | "progress"
  | "meta";

const bus = new EventTarget();

export function onDbEvent(type: string, fn: () => void): () => void {
  bus.addEventListener(type, fn);
  return () => bus.removeEventListener(type, fn);
}

export function emitDb(type: string) {
  bus.dispatchEvent(new Event(type));
}

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureIndexes(store: IDBObjectStore, kind: "channels" | "movies" | "shows") {
  if (!store.indexNames.contains("categoryId")) {
    store.createIndex("categoryId", "categoryId", { unique: false });
  }
  if (!store.indexNames.contains("categoryIds")) {
    store.createIndex("categoryIds", "categoryIds", { unique: false, multiEntry: true });
  }
  if (!store.indexNames.contains("nameLower")) {
    store.createIndex("nameLower", "nameLower", { unique: false });
  }
  if (kind !== "channels" && !store.indexNames.contains("added")) {
    store.createIndex("added", "added", { unique: false });
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const trans = req.transaction;
        if (!db.objectStoreNames.contains("channels")) {
          const s = db.createObjectStore("channels", { keyPath: "id" });
          s.createIndex("categoryId", "categoryId", { unique: false });
          s.createIndex("categoryIds", "categoryIds", { unique: false, multiEntry: true });
          s.createIndex("nameLower", "nameLower", { unique: false });
        } else if (trans) {
          ensureIndexes(trans.objectStore("channels"), "channels");
        }
        if (!db.objectStoreNames.contains("movies")) {
          const s = db.createObjectStore("movies", { keyPath: "id" });
          s.createIndex("categoryId", "categoryId", { unique: false });
          s.createIndex("categoryIds", "categoryIds", { unique: false, multiEntry: true });
          s.createIndex("nameLower", "nameLower", { unique: false });
          s.createIndex("added", "added", { unique: false });
        } else if (trans) {
          ensureIndexes(trans.objectStore("movies"), "movies");
        }
        if (!db.objectStoreNames.contains("shows")) {
          const s = db.createObjectStore("shows", { keyPath: "id" });
          s.createIndex("categoryId", "categoryId", { unique: false });
          s.createIndex("categoryIds", "categoryIds", { unique: false, multiEntry: true });
          s.createIndex("nameLower", "nameLower", { unique: false });
          s.createIndex("added", "added", { unique: false });
        } else if (trans) {
          ensureIndexes(trans.objectStore("shows"), "shows");
        }
        if (!db.objectStoreNames.contains("episodes")) {
          const s = db.createObjectStore("episodes", { keyPath: "id" });
          s.createIndex("showId", "showId", { unique: false });
        }
        if (!db.objectStoreNames.contains("categories")) {
          const s = db.createObjectStore("categories", { keyPath: "id" });
          s.createIndex("kind", "kind", { unique: false });
        }
        if (!db.objectStoreNames.contains("epg")) {
          db.createObjectStore("epg", { keyPath: "channelId" });
        }
        if (!db.objectStoreNames.contains("favorites")) {
          db.createObjectStore("favorites", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("progress")) {
          const s = db.createObjectStore("progress", { keyPath: "key" });
          s.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("Failed to open library cache"));
      };
    });
  }
  return dbPromise;
}

/** Drops the cached handle so the next call reopens (or recreates) the DB. */
export async function closeDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  const db = await pending.catch(() => null);
  db?.close();
}

/** Removes the whole IndexedDB database — used by the settings reset. */
export async function deleteDatabase(): Promise<void> {
  await closeDb();
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function tx(db: IDBDatabase, stores: StoreName | StoreName[], mode: IDBTransactionMode) {
  return db.transaction(stores, mode);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAllChunk<T>(store: StoreName, items: T[]): Promise<void> {
  const db = await openDb();
  const t = tx(db, store, "readwrite");
  const s = t.objectStore(store);
  for (const item of items) s.put(item);
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function putAll<T>(store: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += PUT_CHUNK) {
    await putAllChunk(store, items.slice(i, i + PUT_CHUNK));
  }
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return reqToPromise(tx(db, store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}

export async function getById<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  return reqToPromise(tx(db, store, "readonly").objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function getByIndex<T>(
  store: StoreName,
  index: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await openDb();
  const objectStore = tx(db, store, "readonly").objectStore(store);
  if (!objectStore.indexNames.contains(index)) {
    const all = (await reqToPromise(objectStore.getAll())) as T[];
    return all.filter((row) => {
      const record = row as Record<string, unknown>;
      if (record[index] === value) return true;
      if (Array.isArray(record[index]) && record[index].includes(value)) return true;
      if (index === "categoryIds" && record.categoryId === value) return true;
      return false;
    });
  }
  return reqToPromise(objectStore.index(index).getAll(value)) as Promise<T[]>;
}

function itemMatchesCategories<T extends { id: string; categoryId: string; categoryIds?: string[] }>(
  row: T,
  categoryIds: string[],
): boolean {
  const ids = new Set<string>([row.categoryId, ...(row.categoryIds ?? [])]);
  return categoryIds.some((id) => ids.has(id));
}

export async function getItemsForCategories<T extends { id: string; categoryId: string; categoryIds?: string[] }>(
  store: "channels" | "movies" | "shows",
  categoryIds: string[],
): Promise<T[]> {
  if (!categoryIds.length) return [];
  const all = await getAll<T>(store);
  return all.filter((row) => itemMatchesCategories(row, categoryIds));
}

export async function countStore(store: StoreName): Promise<number> {
  const db = await openDb();
  return reqToPromise(tx(db, store, "readonly").objectStore(store).count());
}

export async function clearStores(stores: StoreName[]): Promise<void> {
  const db = await openDb();
  const t = tx(db, stores, "readwrite");
  for (const name of stores) t.objectStore(name).clear();
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  const t = tx(db, "meta", "readwrite");
  t.objectStore("meta").put({ key, value });
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const row = (await reqToPromise(tx(db, "meta", "readonly").objectStore("meta").get(key))) as
    | { key: string; value: T }
    | undefined;
  return row?.value;
}

export function readPlaylistFromStorage(): PlaylistConfig | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAYLIST_LS);
    if (!raw) return null;
    return JSON.parse(raw) as PlaylistConfig;
  } catch {
    return null;
  }
}

export function writePlaylistToStorage(config: PlaylistConfig | null) {
  if (typeof localStorage === "undefined") return;
  if (!config) localStorage.removeItem(PLAYLIST_LS);
  else localStorage.setItem(PLAYLIST_LS, JSON.stringify(config));
}

export async function searchByName<T extends { nameLower: string }>(
  store: "channels" | "movies" | "shows",
  query: string,
  limit = 80,
): Promise<T[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const db = await openDb();
  const s = tx(db, store, "readonly").objectStore(store);
  const results: T[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorReq = s.openCursor();
    cursorReq.onerror = () => reject(cursorReq.error);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || results.length >= limit) {
        resolve();
        return;
      }
      const value = cursor.value as T;
      if (value.nameLower.includes(q)) results.push(value);
      cursor.continue();
    };
  });
  return results;
}

export async function listRecent<T extends { added?: number }>(
  store: "movies" | "shows",
  limit = 24,
): Promise<T[]> {
  const db = await openDb();
  const idx = tx(db, store, "readonly").objectStore(store).index("added");
  const results: T[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = idx.openCursor(null, "prev");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || results.length >= limit) {
        resolve();
        return;
      }
      const value = cursor.value as T;
      if (value.added && value.added > 0) results.push(value);
      cursor.continue();
    };
  });
  return results;
}

export async function computeStats(): Promise<LibraryStats> {
  const [channels, movies, shows, episodes, categories] = await Promise.all([
    countStore("channels"),
    countStore("movies"),
    countStore("shows"),
    countStore("episodes"),
    countStore("categories"),
  ]);
  const [sampleMovies, sampleShows] = await Promise.all([
    listRecent<Movie>("movies", 1),
    listRecent<Show>("shows", 1),
  ]);
  return {
    channels,
    movies,
    shows,
    episodes,
    categories,
    hasMovieDates: sampleMovies.length > 0,
    hasShowDates: sampleShows.length > 0,
  };
}

export async function replaceCatalog(opts: {
  categories: Category[];
  channels: Channel[];
  movies: Movie[];
  shows: Show[];
  episodes: Episode[];
}): Promise<void> {
  iptvLog(
    "store",
    "replaceCatalog",
    `cats=${opts.categories.length} channels=${opts.channels.length} movies=${opts.movies.length} shows=${opts.shows.length} episodes=${opts.episodes.length}`,
  );
  await clearStores(["channels", "movies", "shows", "episodes", "categories", "epg"]);
  await putAll("categories", opts.categories);
  await putAll("channels", opts.channels);
  await putAll("movies", opts.movies);
  await putAll("shows", opts.shows);
  await putAll("episodes", opts.episodes);
  iptvLog("store", "replaceCatalog complete");
}

export async function getFavorites(): Promise<Favorite[]> {
  const rows = await getAll<Favorite>("favorites");
  return rows.sort((a, b) => b.addedAt - a.addedAt);
}

export async function toggleFavorite(
  kind: Favorite["kind"],
  itemId: string,
): Promise<boolean> {
  const key = `${kind}:${itemId}`;
  const existing = await getById<Favorite>("favorites", key);
  if (existing) {
    const db = await openDb();
    const t = tx(db, "favorites", "readwrite");
    t.objectStore("favorites").delete(key);
    await new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    emitDb("favorites");
    return false;
  }
  await putAll("favorites", [{ key, kind, itemId, addedAt: Date.now() }]);
  emitDb("favorites");
  return true;
}

export async function isFavorite(kind: Favorite["kind"], itemId: string): Promise<boolean> {
  const row = await getById<Favorite>("favorites", `${kind}:${itemId}`);
  return Boolean(row);
}

export async function getContinueWatching(): Promise<WatchProgress[]> {
  const rows = await getAll<WatchProgress>("progress");
  return rows
    .filter((p) => p.duration > 0 && p.position / p.duration >= 0.04 && p.position / p.duration <= 0.95)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 24);
}

export async function saveProgress(progress: WatchProgress): Promise<void> {
  await putAll("progress", [progress]);
  emitDb("progress");
}

export async function clearProgress(key: string): Promise<void> {
  const db = await openDb();
  const t = tx(db, "progress", "readwrite");
  t.objectStore("progress").delete(key);
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  emitDb("progress");
}

export async function putEpg(entries: EpgEntry[]): Promise<void> {
  await putAll("epg", entries);
  emitDb("epg");
}

export async function wipeLibrary(): Promise<void> {
  writePlaylistToStorage(null);
  await clearStores([
    "channels",
    "movies",
    "shows",
    "episodes",
    "categories",
    "epg",
    "favorites",
    "progress",
    "meta",
  ]);
  emitDb("playlist");
  emitDb("favorites");
  emitDb("progress");
}

export { EMPTY_STATS };
