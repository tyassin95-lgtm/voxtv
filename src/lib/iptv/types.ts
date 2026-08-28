export type ContentKind = "live" | "movie" | "show";
export type PlayableKind = "live" | "movie" | "episode";
export type PlaylistType = "m3u" | "xtream";
export type CatalogSort = "provider" | "az" | "za" | "added" | "year";

export interface XtreamCredentials {
  baseUrl: string;
  username: string;
  password: string;
  streamBaseUrl?: string;
  token?: string;
  allowedFormats?: string[];
}

export interface PlaylistConfig {
  type: PlaylistType;
  name: string;
  m3uUrl?: string;
  xtream?: XtreamCredentials;
  epgUrl?: string;
  addedAt: number;
}

export interface Category {
  id: string;
  kind: ContentKind;
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface Channel {
  id: string;
  name: string;
  nameLower: string;
  logo: string;
  categoryId: string;
  categoryIds?: string[];
  url: string;
  tvgId: string;
  number?: number;
  sortOrder?: number;
  added?: number;
  directSource?: string;
  containerExtension?: string;
}

export interface Movie {
  id: string;
  name: string;
  nameLower: string;
  poster: string;
  backdrop?: string;
  plot?: string;
  year?: string;
  rating?: string;
  categoryId: string;
  categoryIds?: string[];
  url: string;
  added?: number;
  sortOrder?: number;
  containerExtension?: string;
  duration?: number;
  directSource?: string;
}

export interface Show {
  id: string;
  name: string;
  nameLower: string;
  poster: string;
  backdrop?: string;
  plot?: string;
  year?: string;
  rating?: string;
  categoryId: string;
  categoryIds?: string[];
  added?: number;
  sortOrder?: number;
  xtreamSeriesId?: string;
}

export interface Episode {
  id: string;
  showId: string;
  season: number;
  episode: number;
  name: string;
  plot?: string;
  url: string;
  duration?: number;
  containerExtension?: string;
  thumbnail?: string;
  added?: number;
  directSource?: string;
}

export interface EpgProgram {
  title: string;
  start: number;
  end: number;
  description?: string;
}

export interface EpgEntry {
  channelId: string;
  now?: EpgProgram;
  next?: EpgProgram;
  updatedAt: number;
}

export interface Favorite {
  key: string;
  kind: ContentKind;
  itemId: string;
  addedAt: number;
}

export interface WatchProgress {
  key: string;
  kind: PlayableKind;
  itemId: string;
  showId?: string;
  title: string;
  subtitle?: string;
  poster: string;
  position: number;
  duration: number;
  url: string;
  updatedAt: number;
}

export interface LibraryStats {
  channels: number;
  movies: number;
  shows: number;
  episodes: number;
  categories: number;
  hasMovieDates: boolean;
  hasShowDates: boolean;
}

export interface SyncProgress {
  active: boolean;
  phase: string;
  progress: number;
  error: string | null;
  stats: LibraryStats | null;
}

export interface Playable {
  kind: PlayableKind;
  id: string;
  title: string;
  subtitle?: string;
  poster: string;
  url: string;
  urls?: string[];
  isLive: boolean;
  showId?: string;
  duration?: number;
}

export const EMPTY_STATS: LibraryStats = {
  channels: 0,
  movies: 0,
  shows: 0,
  episodes: 0,
  categories: 0,
  hasMovieDates: false,
  hasShowDates: false,
};

export const EMPTY_SYNC: SyncProgress = {
  active: false,
  phase: "",
  progress: 0,
  error: null,
  stats: null,
};
