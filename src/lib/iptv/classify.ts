import type { ContentKind } from "./types.ts";

const MOVIE_GROUP =
  /\b(movie|movies|film|films|vod|cinema|cinemax|hbo|xxx|adult|4k movies|request)\b/i;
const SHOW_GROUP =
  /\b(series|tv shows?|shows?|serie|series|seasons?|drama series|netflix series)\b/i;
const LIVE_GROUP = /\b(live|tv|news|sport|sports|24\/7|channel|channels)\b/i;

const SERIES_TITLE =
  /^(.*?)[\s._-]+(?:s(?:eason)?\s*(\d{1,2})[\s._-]*e(?:p(?:isode)?)?\s*(\d{1,3})|(\d{1,2})x(\d{1,3}))\b/i;

export function classifyItem(url: string, group: string, title: string): ContentKind {
  const u = url.toLowerCase();
  const g = group.toLowerCase();

  if (u.includes("/series/")) return "show";
  if (u.includes("/movie/") || u.includes("/vod/") || u.includes("/film/")) return "movie";
  if (u.includes("/live/")) return "live";

  if (SHOW_GROUP.test(g) && !MOVIE_GROUP.test(g)) return "show";
  if (MOVIE_GROUP.test(g) && !SHOW_GROUP.test(g)) return "movie";
  if (parseEpisodeTitle(title)) return "show";
  if (LIVE_GROUP.test(g) && !MOVIE_GROUP.test(g) && !SHOW_GROUP.test(g)) return "live";
  if (MOVIE_GROUP.test(g)) return "movie";
  if (SHOW_GROUP.test(g)) return "show";
  return "live";
}

export function parseEpisodeTitle(title: string): {
  show: string;
  season: number;
  episode: number;
} | null {
  const cleaned = title.replace(/\s+/g, " ").trim();
  const m = cleaned.match(SERIES_TITLE);
  if (!m) return null;
  const show = (m[1] ?? "").replace(/[-._]+$/g, "").trim();
  if (!show) return null;
  const season = Number(m[2] || m[4] || 1);
  const episode = Number(m[3] || m[5] || 0);
  if (!episode) return null;
  return { show, season, episode };
}

export function slugId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${prefix}:${slug || "item"}`;
}

export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/(player_api|get|xmltv)\.php.*$/i, "");
  url = url.replace(/\/c$/i, "");
  return url;
}

export function posterFallback(name: string): string {
  const hue =
    Math.abs(Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360;
  const label = escapeXml(name.slice(0, 28));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="600" fill="hsl(${hue} 18% 14%)"/><text x="50%" y="52%" text-anchor="middle" fill="rgba(255,255,255,.78)" font-family="Outfit,sans-serif" font-size="28" font-weight="600">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}
