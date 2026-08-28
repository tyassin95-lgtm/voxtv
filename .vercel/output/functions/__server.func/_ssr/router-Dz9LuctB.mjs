import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as createRootRoute, b as useRouter, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as Link2, g as LoaderCircle, i as TriangleAlert, o as Server } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { r as Slot } from "../_libs/@radix-ui/react-primitive+[...].mjs";
import { n as Root, t as Indicator } from "../_libs/radix-ui__react-progress.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-VfAAS--I.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatDuration(seconds) {
	if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "";
	const s = Math.floor(seconds);
	const h = Math.floor(s / 3600);
	const m = Math.floor(s % 3600 / 60);
	const r = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
	return `${m}:${String(r).padStart(2, "0")}`;
}
function yieldToMain() {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
		else setTimeout(resolve, 0);
	});
}
var MOVIE_GROUP = /\b(movie|movies|film|films|vod|cinema|cinemax|hbo|xxx|adult|4k movies|request)\b/i;
var SHOW_GROUP = /\b(series|tv shows?|shows?|serie|series|seasons?|drama series|netflix series)\b/i;
var LIVE_GROUP = /\b(live|tv|news|sport|sports|24\/7|channel|channels)\b/i;
var SERIES_TITLE = /^(.*?)[\s._-]+(?:s(?:eason)?\s*(\d{1,2})[\s._-]*e(?:p(?:isode)?)?\s*(\d{1,3})|(\d{1,2})x(\d{1,3}))\b/i;
function classifyItem(url, group, title) {
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
function parseEpisodeTitle(title) {
	const m = title.replace(/\s+/g, " ").trim().match(SERIES_TITLE);
	if (!m) return null;
	const show = (m[1] ?? "").replace(/[-._]+$/g, "").trim();
	if (!show) return null;
	const season = Number(m[2] || m[4] || 1);
	const episode = Number(m[3] || m[5] || 0);
	if (!episode) return null;
	return {
		show,
		season,
		episode
	};
}
function slugId(prefix, value) {
	return `${prefix}:${value.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item"}`;
}
function normalizeBaseUrl(input) {
	let url = input.trim();
	if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
	url = url.replace(/\/+$/, "");
	url = url.replace(/\/(player_api|get|xmltv)\.php.*$/i, "");
	url = url.replace(/\/c$/i, "");
	return url;
}
function posterFallback(name) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="600" fill="hsl(${Math.abs(Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360} 18% 14%)"/><text x="50%" y="52%" text-anchor="middle" fill="rgba(255,255,255,.78)" font-family="Outfit,sans-serif" font-size="28" font-weight="600">${escapeXml(name.slice(0, 28))}</text></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function escapeXml(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function parseExtinf(line) {
	if (!line.startsWith("#EXTINF:")) return null;
	const body = line.slice(8);
	const space = body.search(/[\s,]/);
	const duration = parseFloat(space === -1 ? body : body.slice(0, space));
	const rest = space === -1 ? "" : body.slice(space).trim();
	const attrs = {};
	const attrRe = /([A-Za-z0-9_-]+)="([^"]*)"/g;
	let lastEnd = 0;
	let m;
	while (m = attrRe.exec(rest)) {
		attrs[m[1].toLowerCase()] = m[2];
		lastEnd = attrRe.lastIndex;
	}
	let title = rest.slice(lastEnd).replace(/^,/, "").trim();
	if (!title && lastEnd === 0) title = rest.replace(/^,/, "").trim();
	return {
		duration: Number.isFinite(duration) ? duration : -1,
		attrs,
		title
	};
}
function attr(attrs, ...keys) {
	for (const key of keys) {
		const v = attrs[key];
		if (v) return v;
	}
	return "";
}
function extDuration(info) {
	return info.duration > 0 ? info.duration : void 0;
}
async function parseM3u(text, onProgress) {
	const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
	const categories = /* @__PURE__ */ new Map();
	const channels = [];
	const movies = [];
	const shows = /* @__PURE__ */ new Map();
	const episodeCount = /* @__PURE__ */ new Map();
	const episodes = [];
	let epgUrl;
	let pending = null;
	let pendingGroup = "";
	let liveN = 0;
	let movieN = 0;
	const ensureCategory = (kind, name) => {
		const trimmed = name.trim() || "Uncategorized";
		const id = slugId(kind, trimmed);
		if (!categories.has(id)) categories.set(id, {
			id,
			kind,
			name: trimmed,
			sortOrder: categories.size
		});
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
			if (!shows.has(showId)) shows.set(showId, {
				id: showId,
				name: showName,
				nameLower: showName.toLowerCase(),
				poster: logo || posterFallback(showName),
				categoryId,
				categoryIds: [categoryId],
				sortOrder: shows.size + 1
			});
			const season = parsed?.season ?? 1;
			const n = (episodeCount.get(showId) ?? 0) + 1;
			episodeCount.set(showId, n);
			const epNum = parsed?.episode ?? n;
			episodes.push({
				id: `${showId}:s${season}e${epNum}:${n}`,
				showId,
				season,
				episode: epNum,
				name: parsed ? `S${String(season).padStart(2, "0")}E${String(epNum).padStart(2, "0")}` : title,
				url,
				duration: extDuration(info),
				thumbnail: logo
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
				sortOrder: movieN
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
				number: Number.isFinite(chno) && chno > 0 ? chno : void 0,
				sortOrder: Number.isFinite(chno) && chno > 0 ? chno : liveN
			});
		}
		if (i % 400 === 0) {
			onProgress?.(Math.min(.99, i / total), "Parsing playlist");
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
		epgUrl
	};
}
var WRAPPER_KEYS = [
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
	"rows"
];
var META_KEYS = /* @__PURE__ */ new Set([
	"user_info",
	"server_info",
	"info",
	"seasons",
	"status",
	"message",
	"auth",
	"server",
	"pagination",
	"meta"
]);
function asList(data) {
	if (data == null) return [];
	if (Array.isArray(data)) return data.filter((row) => row != null);
	if (typeof data !== "object") return [];
	const obj = data;
	for (const key of WRAPPER_KEYS) {
		const nested = obj[key];
		if (Array.isArray(nested)) return asList(nested);
		if (nested && typeof nested === "object") {
			const unwrapped = asList(nested);
			if (unwrapped.length) return unwrapped;
		}
	}
	const values = Object.entries(obj).filter(([key, value]) => !META_KEYS.has(key) && value != null && typeof value === "object").map(([, value]) => value);
	if (values.length === 0) return [];
	if (values.every((value) => value && typeof value === "object" && !Array.isArray(value))) return values;
	return [];
}
function normalizeId(value) {
	if (value === void 0 || value === null) return void 0;
	if (typeof value === "boolean") return void 0;
	if (Array.isArray(value)) return void 0;
	if (typeof value === "object") return void 0;
	const text = String(value).trim();
	if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return void 0;
	if (/^0+$/.test(text)) return "0";
	if (/^\d+$/.test(text)) return text.replace(/^0+/, "");
	return text;
}
function collectCategoryIds(item) {
	if (!item) return [];
	const ids = /* @__PURE__ */ new Set();
	const add = (value) => {
		if (value === void 0 || value === null || value === "") return;
		if (Array.isArray(value)) {
			for (const entry of value) add(entry);
			return;
		}
		if (typeof value === "object") {
			const record = value;
			add(record.category_id ?? record.categoryId ?? record.cat_id ?? record.id);
			return;
		}
		const text = String(value).trim();
		if (!text) return;
		for (const part of text.split(/[,|;]/)) {
			const id = normalizeId(part);
			if (id !== void 0) ids.add(id);
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
function looksLikeNumericCategoryId(value) {
	return /^\d+$/.test(value);
}
function resolveCategoryIds(kind, row, categories, forcedCat) {
	const prefix = kind === "live" ? "live" : kind === "movie" ? "movie" : "show";
	const known = new Set(categories.map((category) => category.id));
	const raw = collectCategoryIds(row);
	if (forcedCat && !raw.includes(forcedCat)) raw.push(forcedCat);
	const ids = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (id) => {
		if (!id || seen.has(id)) return;
		seen.add(id);
		ids.push(id);
	};
	const matchName = (hint) => {
		if (!hint) return;
		for (const part of hint.split(/[,|;/]/)) {
			const lower = part.toLowerCase().trim();
			if (!lower) continue;
			for (const category of categories) if (category.name.toLowerCase() === lower) add(category.id);
		}
	};
	for (const entry of raw) {
		const prefixed = `${prefix}:${entry}`;
		if (known.has(prefixed) || looksLikeNumericCategoryId(entry) || entry === "uncat" || forcedCat === entry) add(prefixed);
		else matchName(entry);
	}
	const categoryObj = row.category && typeof row.category === "object" && !Array.isArray(row.category) ? row.category : null;
	matchName(pickString(row, "category_name", "genre", "group_title", "group"));
	matchName(typeof row.category === "string" ? row.category : void 0);
	matchName(categoryObj ? pickString(categoryObj, "name", "title", "category_name") : void 0);
	if (!ids.length) add(fallbackCategoryId(kind));
	return ids;
}
function fallbackCategoryId(kind) {
	if (kind === "live") return "live:uncat";
	if (kind === "movie") return "movie:uncat";
	return "show:uncat";
}
function pickStreamId(item, ...keys) {
	for (const key of keys) {
		const id = normalizeId(item[key]);
		if (id !== void 0) return id;
	}
}
function pickString(item, ...keys) {
	for (const key of keys) {
		const value = item[key];
		if (typeof value === "string" && value.trim()) return value.trim();
		if (typeof value === "number" && Number.isFinite(value)) return String(value);
	}
}
function pickExt(item, fallback = "mp4") {
	const info = item.info && typeof item.info === "object" ? item.info : {};
	return (pickString(item, "container_extension", "containerExtension", "extension", "ext", "container") || pickString(info, "container_extension", "containerExtension", "extension", "ext", "container") || fallback).replace(/^\./, "").toLowerCase() || fallback;
}
function pickDirectSource(item) {
	const raw = pickString(item, "direct_source", "directSource", "source", "stream_url", "url");
	if (!raw) return void 0;
	if (!/^https?:\/\//i.test(raw)) return void 0;
	if (/player_api\.php/i.test(raw)) return void 0;
	return raw;
}
function parentCategoryId(kind, parentRaw) {
	const id = normalizeId(parentRaw);
	if (id === void 0 || id === "0") return void 0;
	return `${kind === "live" ? "live" : kind === "movie" ? "movie" : "show"}:${id}`;
}
function expandCategoryIds(categories, selectedId) {
	const children = /* @__PURE__ */ new Map();
	for (const category of categories) {
		if (!category.parentId) continue;
		const list = children.get(category.parentId) ?? [];
		list.push(category.id);
		children.set(category.parentId, list);
	}
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const walk = (id) => {
		if (seen.has(id)) return;
		seen.add(id);
		out.push(id);
		for (const child of children.get(id) ?? []) walk(child);
	};
	walk(selectedId);
	return out;
}
function firstBackdrop(value) {
	if (!value) return void 0;
	if (Array.isArray(value)) {
		const first = value.find((entry) => typeof entry === "string" && entry.trim());
		return typeof first === "string" ? first : void 0;
	}
	if (typeof value === "string" && value.trim()) return value.trim();
}
function unix(value) {
	if (value === void 0 || value === null || value === "") return void 0;
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return void 0;
	return n < 0xe8d4a51000 ? n : Math.floor(n / 1e3);
}
function decodeMaybeBase64(value) {
	if (!value) return void 0;
	try {
		if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0 && value.length > 8) {
			const decoded = atob(value);
			if (/^[\x20-\x7E\s]+$/.test(decoded)) return decoded;
		}
	} catch {}
	return value;
}
function parseJsonPayload(text) {
	const trimmed = text.replace(/^\uFEFF/, "").trim();
	const start = trimmed.search(/[\[{]/);
	const payload = start >= 0 ? trimmed.slice(start) : trimmed;
	return JSON.parse(payload);
}
function resolveStreamBase(portalBase, serverInfo) {
	if (!serverInfo?.url) return portalBase;
	const hostRaw = String(serverInfo.url).trim();
	if (!hostRaw) return portalBase;
	const protoFromHost = hostRaw.match(/^https?:\/\//i)?.[0]?.replace("://", "").toLowerCase();
	const proto = (serverInfo.server_protocol || protoFromHost || "http").replace("://", "").toLowerCase();
	const host = hostRaw.replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/:\d+$/, "");
	if (!host) return portalBase;
	const portValue = proto === "https" ? serverInfo.https_port : serverInfo.port;
	const port = portValue !== void 0 && portValue !== null && String(portValue).trim() !== "" ? String(portValue).trim() : "";
	return `${proto}://${host}${!port || proto === "http" && port === "80" || proto === "https" && port === "443" ? "" : `:${port}`}`;
}
function normalizeEpisodeGroups(raw) {
	if (!raw) return [];
	const groups = [];
	const asEpisodeList = (value) => {
		if (!value) return [];
		if (Array.isArray(value)) return value.filter((row) => row && typeof row === "object");
		if (typeof value === "object") return asList(value);
		return [];
	};
	if (Array.isArray(raw)) {
		if (raw.length === 0) return [];
		if (Array.isArray(raw[0]) || raw[0] && typeof raw[0] === "object" && !("id" in raw[0] || "episode_num" in raw[0] || "stream_id" in raw[0])) {
			raw.forEach((entry, index) => {
				const list = asEpisodeList(entry);
				if (list.length) groups.push({
					season: index + 1,
					episodes: list
				});
			});
			if (groups.length) return groups;
		}
		const bySeason = /* @__PURE__ */ new Map();
		for (const entry of raw) {
			if (!entry || typeof entry !== "object") continue;
			const row = entry;
			const season = Number(row.season ?? row.season_number ?? row.season_num ?? 1) || 1;
			const list = bySeason.get(season) ?? [];
			list.push(row);
			bySeason.set(season, list);
		}
		return [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([season, episodes]) => ({
			season,
			episodes
		}));
	}
	if (typeof raw === "object") {
		for (const [key, value] of Object.entries(raw)) {
			const list = asEpisodeList(value);
			if (!list.length) continue;
			const season = Number(key) || Number(list[0]?.season) || 1;
			groups.push({
				season,
				episodes: list
			});
		}
		groups.sort((a, b) => a.season - b.season);
	}
	return groups;
}
function summarizePayload(data) {
	if (data == null) return "null";
	if (Array.isArray(data)) return `array(${data.length})`;
	if (typeof data !== "object") return typeof data;
	return `object{${Object.keys(data).slice(0, 12).join(",")}}`;
}
function proxiedFetchUrl(url) {
	return `/api/iptv/fetch?u=${encodeURIComponent(url)}`;
}
function proxiedStreamUrl(url) {
	return `/api/iptv/stream?u=${encodeURIComponent(url)}`;
}
function proxiedImageUrl(url) {
	if (!url) return "";
	if (url.startsWith("data:") || url.startsWith("blob:")) return url;
	if (url.startsWith("/")) return url;
	return `/api/iptv/image?u=${encodeURIComponent(url)}`;
}
async function fetchRemoteText(url, timeoutMs = 9e4) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(proxiedFetchUrl(url), { signal: ctrl.signal });
		if (!res.ok) {
			const message = await res.text().catch(() => res.statusText);
			throw new Error(message || `Request failed (${res.status})`);
		}
		return await res.text();
	} finally {
		clearTimeout(timer);
	}
}
async function fetchRemoteJson(url, timeoutMs = 9e4) {
	const text = await fetchRemoteText(url, timeoutMs);
	try {
		return parseJsonPayload(text);
	} catch {
		throw new Error("The IPTV server returned an invalid response.");
	}
}
async function probeStream(url) {
	try {
		const res = await fetch(`${proxiedStreamUrl(url)}&probe=1`);
		if (!res.ok) return {
			ok: false,
			status: res.status,
			kind: "unknown"
		};
		const data = await res.json();
		return {
			ok: Boolean(data.ok),
			status: Number(data.status) || res.status,
			kind: data.kind || "unknown",
			finalUrl: data.finalUrl
		};
	} catch {
		return {
			ok: false,
			status: 0,
			kind: "unknown"
		};
	}
}
function iptvLog(scope, ...args) {
	console.info(`[vox:${scope}]`, ...args);
}
function iptvWarn(scope, ...args) {
	console.warn(`[vox:${scope}]`, ...args);
}
function redactUrl(url) {
	return url.replace(/password=[^&]*/gi, "password=***").replace(/([?&]u(?:sername)?=)[^&]*/gi, "$1***").replace(/(\/(?:live|movie|series)\/)[^/]+\/[^/]+/gi, "$1***/***");
}
function looksHls(url) {
	return /\.m3u8(\?|$)/i.test(url) || /[?&]type=m3u8\b/i.test(url) || /format=m3u8/i.test(url);
}
function looksTs(url) {
	return /\.ts(\?|$)/i.test(url) && !/\.m3u8/i.test(url);
}
function looksNative(url) {
	return /\.(mp4|webm|ogg|mov|m4v|mp3|aac|mkv|avi)(\?|$)/i.test(url);
}
function unwrapProxiedUrl(url) {
	try {
		const target = new URL(url, "http://local.invalid").searchParams.get("u");
		if (target && /^https?:\/\//i.test(target)) return target;
	} catch {}
	const match = url.match(/[?&]u=([^&]+)/);
	if (match?.[1]) try {
		const decoded = decodeURIComponent(match[1]);
		if (/^https?:\/\//i.test(decoded)) return decoded;
	} catch {}
	return url;
}
function pickEngine(url) {
	const raw = unwrapProxiedUrl(url);
	if (looksHls(raw)) return "hls";
	if (looksNative(raw)) return "native";
	if (looksTs(raw)) return "mpegts";
	if (/\/live\//i.test(raw) || /\/(?:live|timeshift)\.php/i.test(raw)) return "mpegts";
	return "native";
}
function unique(values) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const value of values) {
		if (!value || seen.has(value)) continue;
		seen.add(value);
		out.push(value);
	}
	return out;
}
function pathSafe(value) {
	return value.length > 0 && !/[/?#]/.test(value);
}
function credentialPathPairs(username, password) {
	const pairs = [];
	const add = (user, pass) => {
		if (!pathSafe(user) || !pathSafe(pass)) return;
		const key = `${user}\0${pass}`;
		if (pairs.some(([u, p]) => `${u}\0${p}` === key)) return;
		pairs.push([user, pass]);
	};
	add(username, password);
	try {
		const decodedUser = decodeURIComponent(username);
		const decodedPass = decodeURIComponent(password);
		add(decodedUser, decodedPass);
		add(encodeURIComponent(decodedUser), encodeURIComponent(decodedPass));
	} catch {
		add(encodeURIComponent(username), encodeURIComponent(password));
	}
	if (!pairs.length) add(encodeURIComponent(username), encodeURIComponent(password));
	return pairs;
}
function withQuery(url, token) {
	if (!token) return url;
	if (/[?&]token=/i.test(url)) return url;
	return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}
function streamHostBases(creds) {
	return unique([creds.baseUrl, creds.streamBaseUrl].filter((value) => Boolean(value)).map((value) => value.replace(/\/+$/, "")));
}
function liveStreamUrlVariants(creds, id) {
	const urls = [];
	const token = creds.token;
	const formats = creds.allowedFormats?.map((f) => f.replace(/^\./, "").toLowerCase()) ?? [];
	const exts = formats.includes("ts") && !formats.includes("m3u8") ? [
		"ts",
		"m3u8",
		""
	] : [
		"m3u8",
		"ts",
		""
	];
	for (const base of streamHostBases(creds)) for (const [user, pass] of credentialPathPairs(creds.username, creds.password)) {
		for (const ext of exts) urls.push(withQuery(`${base}/live/${user}/${pass}/${id}${ext ? `.${ext}` : ""}`, token));
		urls.push(withQuery(`${base}/${user}/${pass}/${id}`, token));
		urls.push(withQuery(`${base}/${user}/${pass}/${id}.ts`, token));
		urls.push(withQuery(`${base}/${user}/${pass}/${id}.m3u8`, token));
	}
	return unique(urls);
}
function vodStreamUrlVariants(creds, kind, id, ext = "mp4") {
	const urls = [];
	const token = creds.token;
	const extras = unique([
		ext.replace(/^\./, "").toLowerCase() || "mp4",
		"mp4",
		"mkv",
		"avi",
		"ts",
		"m3u8",
		"mpg"
	]);
	for (const base of streamHostBases(creds)) for (const [user, pass] of credentialPathPairs(creds.username, creds.password)) for (const nextExt of extras) urls.push(withQuery(`${base}/${kind}/${user}/${pass}/${id}.${nextExt}`, token));
	return unique(urls);
}
function retargetStreamHost(url, bases) {
	const out = [url];
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return out;
	}
	for (const base of bases) try {
		const next = `${new URL(base.includes("://") ? base : `http://${base}`).origin}${parsed.pathname}${parsed.search}`;
		if (!out.includes(next)) out.push(next);
	} catch {}
	return out;
}
function streamUrlVariants(url, kind = "live") {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	const add = (value) => {
		if (!value) return;
		if (seen.has(value)) return;
		seen.add(value);
		out.push(value);
	};
	add(url);
	const live = url.match(/^(https?:\/\/.+\/live\/)([^/]+)\/([^/]+)\/([^/?]+?)(?:\.(m3u8|ts))?(\?.*)?$/i);
	if (live) {
		const prefix = live[1];
		const user = live[2];
		const pass = live[3];
		const id = live[4];
		const query = live[6] || "";
		for (const [nextUser, nextPass] of credentialPathPairs(user || "", pass || "")) {
			add(`${prefix}${nextUser}/${nextPass}/${id}.m3u8${query}`);
			add(`${prefix}${nextUser}/${nextPass}/${id}.ts${query}`);
			add(`${prefix}${nextUser}/${nextPass}/${id}${query}`);
			const origin = prefix.replace(/\/live\/$/, "");
			add(`${origin}/${nextUser}/${nextPass}/${id}${query}`);
			add(`${origin}/${nextUser}/${nextPass}/${id}.ts${query}`);
			add(`${origin}/${nextUser}/${nextPass}/${id}.m3u8${query}`);
		}
	}
	const vod = url.match(/^(https?:\/\/.+\/(movie|series)\/)([^/]+)\/([^/]+)\/([^/?]+)\.([a-z0-9]+)(\?.*)?$/i);
	if (vod) {
		const prefix = vod[1];
		const user = vod[3];
		const pass = vod[4];
		const id = vod[5];
		const originalExt = vod[6];
		const query = vod[7] || "";
		const extras = kind === "live" ? [
			originalExt,
			"m3u8",
			"ts"
		] : [
			originalExt,
			"mp4",
			"mkv",
			"avi",
			"ts",
			"m3u8"
		];
		for (const [nextUser, nextPass] of credentialPathPairs(user || "", pass || "")) for (const ext of extras) add(`${prefix}${nextUser}/${nextPass}/${id}.${ext}${query}`);
	}
	return out;
}
var ALL_CATEGORY = {
	live: "live:all",
	movie: "movie:all",
	show: "show:all"
};
function allCategoryId(kind) {
	return ALL_CATEGORY[kind];
}
function isAllCategory(id) {
	return id === "live:all" || id === "movie:all" || id === "show:all";
}
function itemCategorySet(item) {
	return /* @__PURE__ */ new Set([item.categoryId, ...item.categoryIds ?? []]);
}
function itemBelongsToCategory(item, categoryId, categories) {
	if (isAllCategory(categoryId)) return true;
	const tree = expandCategoryIds(categories, categoryId);
	const owned = itemCategorySet(item);
	return tree.some((id) => owned.has(id));
}
function filterCatalogItems(items, categories, categoryId, query) {
	const q = query.trim().toLowerCase();
	if (q) return items.filter((item) => item.nameLower.includes(q) || item.name.toLowerCase().includes(q));
	if (!categoryId || isAllCategory(categoryId)) return items;
	return items.filter((item) => itemBelongsToCategory(item, categoryId, categories));
}
function yearValue(item) {
	if (!("year" in item) || !item.year) return 0;
	const n = Number(String(item.year).slice(0, 4));
	return Number.isFinite(n) ? n : 0;
}
function addedValue(item) {
	return "added" in item && typeof item.added === "number" ? item.added : 0;
}
function providerValue(item) {
	if ("number" in item && typeof item.number === "number" && item.number > 0) return item.number;
	if (typeof item.sortOrder === "number") return item.sortOrder;
	return Number.MAX_SAFE_INTEGER;
}
function sortCatalogItems(items, sort, kind) {
	const copy = items.slice();
	copy.sort((a, b) => {
		if (sort === "az") return a.name.localeCompare(b.name) || providerValue(a) - providerValue(b);
		if (sort === "za") return b.name.localeCompare(a.name) || providerValue(a) - providerValue(b);
		if (sort === "year") return yearValue(b) - yearValue(a) || a.name.localeCompare(b.name);
		if (sort === "added") return addedValue(b) - addedValue(a) || a.name.localeCompare(b.name);
		if (kind === "live") {
			const an = "number" in a && typeof a.number === "number" ? a.number : 0;
			const bn = "number" in b && typeof b.number === "number" ? b.number : 0;
			if (an && bn && an !== bn) return an - bn;
		}
		const order = providerValue(a) - providerValue(b);
		if (order !== 0) return order;
		return a.name.localeCompare(b.name);
	});
	return copy;
}
function availableSorts(items, kind) {
	const options = [
		{
			id: "provider",
			label: kind === "live" ? "Channel order" : "Provider order"
		},
		{
			id: "added",
			label: kind === "show" ? "Recently updated" : "Recently added"
		},
		{
			id: "az",
			label: "A–Z"
		},
		{
			id: "za",
			label: "Z–A"
		}
	];
	if (kind !== "live" && items.some((item) => yearValue(item) > 0)) options.push({
		id: "year",
		label: "Release year"
	});
	return options;
}
function compareOrder(a, b) {
	const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
	const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
	if (ao !== bo) return ao - bo;
	return a.name.localeCompare(b.name);
}
function buildCategoryTree(categories) {
	const byParent = /* @__PURE__ */ new Map();
	const ids = new Set(categories.map((c) => c.id));
	for (const category of categories) {
		const parent = category.parentId && ids.has(category.parentId) ? category.parentId : void 0;
		const list = byParent.get(parent) ?? [];
		list.push(category);
		byParent.set(parent, list);
	}
	for (const list of byParent.values()) list.sort(compareOrder);
	const walk = (parentId, depth) => {
		return (byParent.get(parentId) ?? []).map((category) => ({
			category,
			depth,
			children: walk(category.id, depth + 1)
		}));
	};
	return walk(void 0, 0);
}
function flattenCategoryTree(nodes) {
	const out = [];
	const walk = (list) => {
		for (const node of list) {
			out.push(node);
			walk(node.children);
		}
	};
	walk(nodes);
	return out;
}
function categoryItemCounts(items, categories) {
	const parent = /* @__PURE__ */ new Map();
	for (const category of categories) parent.set(category.id, category.parentId);
	const counts = /* @__PURE__ */ new Map();
	const bump = (id, seen) => {
		if (!id || seen.has(id)) return;
		seen.add(id);
		counts.set(id, (counts.get(id) ?? 0) + 1);
		bump(parent.get(id), seen);
	};
	for (const item of items) {
		const seen = /* @__PURE__ */ new Set();
		for (const id of itemCategorySet(item)) bump(id, seen);
	}
	return counts;
}
function ensureOrphanCategories(kind, categories, items) {
	const known = new Set(categories.map((c) => c.id));
	const extras = [];
	const fallback = fallbackCategoryId(kind);
	for (const item of items) for (const id of itemCategorySet(item)) {
		if (known.has(id) || isAllCategory(id)) continue;
		known.add(id);
		const raw = id.replace(/^(live|movie|show):/, "");
		extras.push({
			id,
			kind,
			name: raw === "uncat" ? "Uncategorized" : `Category ${raw}`,
			sortOrder: 1e4 + extras.length
		});
	}
	if (items.some((item) => itemCategorySet(item).has(fallback)) && !known.has(fallback)) extras.push({
		id: fallback,
		kind,
		name: "Uncategorized",
		sortOrder: 2e4
	});
	return extras.length ? [...categories, ...extras] : categories;
}
var SORT_LS = "vox-iptv-sort";
function loadSort(kind) {
	if (typeof localStorage === "undefined") return "provider";
	const raw = localStorage.getItem(`${SORT_LS}-${kind}`);
	if (raw === "provider" || raw === "az" || raw === "za" || raw === "added" || raw === "year") return raw;
	return "provider";
}
function saveSort(kind, sort) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(`${SORT_LS}-${kind}`, sort);
}
function apiUrl(creds, extra = {}) {
	return `${`${creds.baseUrl.replace(/\/+$/, "")}/player_api.php`}?${new URLSearchParams({
		username: creds.username,
		password: creds.password,
		...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)]))
	}).toString()}`;
}
function liveStreamUrl(creds, id) {
	return liveStreamUrlVariants(creds, id)[0] ?? "";
}
function liveStreamTsUrl(creds, id) {
	return liveStreamUrlVariants(creds, id).find((url) => url.endsWith(".ts") || url.includes(".ts?")) ?? liveStreamUrl(creds, id);
}
function movieStreamUrl(creds, id, ext = "mp4") {
	return vodStreamUrlVariants(creds, "movie", id, ext)[0] ?? "";
}
function seriesStreamUrl(creds, id, ext = "mp4") {
	return vodStreamUrlVariants(creds, "series", id, ext)[0] ?? "";
}
function xmltvUrl(creds) {
	return `${creds.baseUrl.replace(/\/+$/, "")}/xmltv.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
}
function shortEpgUrl(creds, streamId, limit = 4) {
	return apiUrl(creds, {
		action: "get_short_epg",
		stream_id: streamId,
		limit
	});
}
async function fetchAction(creds, extra, label, timeoutMs = 9e4) {
	const url = apiUrl(creds, extra);
	iptvLog("xtream:fetch", label, redactUrl(url));
	try {
		const data = await fetchRemoteJson(url, timeoutMs);
		const list = asList(data);
		iptvLog("xtream:parse", label, summarizePayload(data), `normalized=${list.length}`);
		return data;
	} catch (err) {
		iptvWarn("xtream:fetch", label, "failed", err instanceof Error ? err.message : err);
		throw err;
	}
}
async function fetchList(creds, extra, label, timeoutMs = 9e4) {
	let lastError;
	for (let attempt = 0; attempt < 2; attempt++) try {
		const data = await fetchAction(creds, extra, label, timeoutMs);
		const list = asList(data);
		if (!list.length) iptvWarn("xtream:parse", label, "empty list after normalize", summarizePayload(data));
		return list;
	} catch (err) {
		lastError = err;
		iptvWarn("xtream:fetch", label, `attempt ${attempt + 1} failed`, err instanceof Error ? err.message : err);
	}
	iptvWarn("xtream:fetch", label, "giving up", lastError instanceof Error ? lastError.message : lastError);
	return [];
}
async function mapPool(items, concurrency, worker) {
	const results = new Array(items.length);
	let cursor = 0;
	async function run() {
		while (cursor < items.length) {
			const index = cursor++;
			const item = items[index];
			if (item === void 0) break;
			results[index] = await worker(item, index);
		}
	}
	await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => run()));
	return results;
}
function mapCategories(rows, kind) {
	const categories = [];
	const seen = /* @__PURE__ */ new Set();
	const prefix = kind === "show" ? "show" : kind;
	for (const row of rows) {
		const rawId = pickStreamId(row, "category_id", "id", "categoryId", "cat_id");
		if (rawId === void 0) {
			iptvWarn("xtream:map", kind, "category row missing id", Object.keys(row).slice(0, 8));
			continue;
		}
		const id = `${prefix}:${rawId}`;
		if (seen.has(id)) continue;
		seen.add(id);
		const name = pickString(row, "category_name", "name", "title") || (kind === "live" ? "Live" : kind === "movie" ? "Movies" : "TV Shows");
		let parentId = parentCategoryId(kind, row.parent_id ?? row.parentId ?? row.parentid ?? row.parent);
		if (parentId === id) parentId = void 0;
		categories.push({
			id,
			kind,
			name,
			parentId,
			sortOrder: categories.length
		});
	}
	iptvLog("xtream:map", kind, `categories=${categories.length}`);
	return categories;
}
function mapLive(row, creds, categories, forcedCat, index = 0) {
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
		number: Number.isFinite(num) && num > 0 ? num : void 0,
		sortOrder,
		added: unix(row.added ?? row.added_at),
		directSource: direct,
		containerExtension: ext
	};
}
function mapMovie(row, creds, categories, forcedCat, index = 0) {
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
		duration: row.duration_secs ? Number(row.duration_secs) : void 0,
		directSource: pickDirectSource(row)
	};
}
function mapShow(row, categories, forcedCat, index = 0) {
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
		xtreamSeriesId: seriesId
	};
}
function isUncategorized(id) {
	return Boolean(id && /:(uncat)$/.test(id));
}
function mergeById(existing, incoming) {
	const map = /* @__PURE__ */ new Map();
	for (const item of existing) map.set(item.id, item);
	for (const item of incoming) {
		const prev = map.get(item.id);
		if (!prev) {
			map.set(item.id, item);
			continue;
		}
		const ids = /* @__PURE__ */ new Set();
		for (const id of [
			prev.categoryId,
			item.categoryId,
			...prev.categoryIds ?? [],
			...item.categoryIds ?? []
		]) if (id) ids.add(id);
		const real = [...ids].filter((id) => !isUncategorized(id));
		const categoryIds = real.length ? real : [...ids];
		const categoryId = categoryIds.find((id) => id === prev.categoryId && !isUncategorized(id)) || categoryIds.find((id) => id === item.categoryId && !isUncategorized(id)) || categoryIds[0] || prev.categoryId || item.categoryId;
		map.set(item.id, {
			...prev,
			...item,
			categoryIds,
			categoryId,
			sortOrder: prev.sortOrder ?? item.sortOrder
		});
	}
	return [...map.values()];
}
function emptyCategoryIds(categories, items) {
	const filled = /* @__PURE__ */ new Set();
	for (const item of items) {
		filled.add(item.categoryId);
		for (const id of item.categoryIds ?? []) filled.add(id);
	}
	return categories.filter((category) => {
		return expandCategoryIds(categories, category.id).every((id) => !filled.has(id));
	}).map((category) => category.id);
}
async function hydrateCategoryContents(opts) {
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
		opts.onProgress?.(opts.progressFrom + (index + 1) / Math.max(total, 1) * (opts.progressTo - opts.progressFrom), `Loading ${opts.kind} category ${index + 1}/${total}`);
		const mapped = (await fetchList(opts.creds, {
			action: opts.action,
			category_id: rawId
		}, `${opts.action} category_id=${rawId}`, 45e3)).map((row, rowIndex) => opts.mapRow(row, rawId, rowIndex)).filter((row) => Boolean(row));
		iptvLog("xtream:map", opts.kind, `category ${rawId} → ${mapped.length} items`);
		return mapped;
	});
	for (const mapped of additions) if (mapped?.length) merged = mergeById(merged, mapped);
	const stillEmpty = emptyCategoryIds(opts.categories, merged);
	iptvLog("xtream:map", opts.kind, `after hydrate: items=${merged.length}, remaining empty=${stillEmpty.length}`, stillEmpty.slice(0, 12));
	if (stillEmpty.length) iptvWarn("xtream:map", opts.kind, "categories still empty after per-category fetch", stillEmpty);
	return merged;
}
function parseAllowedFormats(value) {
	if (!value) return void 0;
	if (Array.isArray(value)) return value.map((entry) => String(entry).toLowerCase());
	if (typeof value === "string") return value.split(/[,|]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}
async function xtreamLogin(creds) {
	const data = await fetchRemoteJson(apiUrl(creds), 25e3);
	const auth = data.user_info?.auth;
	const status = data.user_info?.status;
	if (!(auth === 1 || auth === "1" || status === "Active" || status === "active")) throw new Error(data.user_info?.message || "Xtream login failed. Check server, username, and password.");
	const streamBaseUrl = resolveStreamBase(creds.baseUrl, data.server_info);
	const token = pickString(data.user_info ?? {}, "token");
	const allowedFormats = parseAllowedFormats(data.user_info?.allowed_output_formats);
	iptvLog("xtream:fetch", "login ok", redactUrl(streamBaseUrl), allowedFormats?.join(",") || "formats=default");
	return {
		name: data.server_info?.url || data.user_info?.username || "Xtream playlist",
		streamBaseUrl,
		token,
		allowedFormats
	};
}
function parseXtreamInput(server, username, password) {
	return {
		baseUrl: normalizeBaseUrl(server),
		username: username.trim(),
		password: password.trim()
	};
}
async function fetchXtreamCatalog(creds, onProgress) {
	onProgress?.(.04, "Signing in");
	const login = await xtreamLogin(creds);
	const resolved = {
		...creds,
		streamBaseUrl: login.streamBaseUrl,
		token: login.token,
		allowedFormats: login.allowedFormats
	};
	onProgress?.(.1, "Fetching live categories");
	const liveCats = mapCategories(await fetchList(creds, { action: "get_live_categories" }, "get_live_categories"), "live");
	onProgress?.(.16, "Fetching live channels");
	const liveRows = await fetchList(creds, { action: "get_live_streams" }, "get_live_streams");
	let channels = liveRows.map((row, index) => mapLive(row, resolved, liveCats, void 0, index)).filter((row) => Boolean(row));
	iptvLog("xtream:map", "live bulk", `rows=${liveRows.length} mapped=${channels.length} cats=${liveCats.length}`);
	onProgress?.(.22, "Matching live categories");
	channels = await hydrateCategoryContents({
		creds,
		kind: "live",
		action: "get_live_streams",
		categories: liveCats,
		items: channels,
		mapRow: (row, forced, index) => mapLive(row, resolved, liveCats, forced, index),
		onProgress,
		progressFrom: .22,
		progressTo: .36
	});
	onProgress?.(.38, "Fetching movie categories");
	const vodCats = mapCategories(await fetchList(creds, { action: "get_vod_categories" }, "get_vod_categories"), "movie");
	onProgress?.(.44, "Fetching movies");
	const vodRows = await fetchList(creds, { action: "get_vod_streams" }, "get_vod_streams");
	let movies = vodRows.map((row, index) => mapMovie(row, resolved, vodCats, void 0, index)).filter((row) => Boolean(row));
	iptvLog("xtream:map", "movie bulk", `rows=${vodRows.length} mapped=${movies.length} cats=${vodCats.length}`);
	onProgress?.(.5, "Matching movie categories");
	movies = await hydrateCategoryContents({
		creds,
		kind: "movie",
		action: "get_vod_streams",
		categories: vodCats,
		items: movies,
		mapRow: (row, forced, index) => mapMovie(row, resolved, vodCats, forced, index),
		onProgress,
		progressFrom: .5,
		progressTo: .64
	});
	onProgress?.(.66, "Fetching TV show categories");
	const seriesCats = mapCategories(await fetchList(creds, { action: "get_series_categories" }, "get_series_categories"), "show");
	onProgress?.(.72, "Fetching TV shows");
	const seriesRows = await fetchList(creds, { action: "get_series" }, "get_series");
	let shows = seriesRows.map((row, index) => mapShow(row, seriesCats, void 0, index)).filter((row) => Boolean(row));
	iptvLog("xtream:map", "show bulk", `rows=${seriesRows.length} mapped=${shows.length} cats=${seriesCats.length}`);
	onProgress?.(.78, "Matching TV show categories");
	shows = await hydrateCategoryContents({
		creds,
		kind: "show",
		action: "get_series",
		categories: seriesCats,
		items: shows,
		mapRow: (row, forced, index) => mapShow(row, seriesCats, forced, index),
		onProgress,
		progressFrom: .78,
		progressTo: .88
	});
	const liveWithOrphans = ensureOrphanCategories("live", liveCats, channels);
	const movieWithOrphans = ensureOrphanCategories("movie", vodCats, movies);
	const showWithOrphans = ensureOrphanCategories("show", seriesCats, shows);
	const categories = [
		...liveWithOrphans,
		...movieWithOrphans,
		...showWithOrphans
	];
	iptvLog("xtream:map", `catalog liveCats=${liveWithOrphans.length} channels=${channels.length} movieCats=${movieWithOrphans.length} movies=${movies.length} showCats=${showWithOrphans.length} shows=${shows.length}`);
	onProgress?.(.9, "Saving library");
	return {
		categories,
		channels,
		movies,
		shows,
		name: login.name,
		streamBaseUrl: login.streamBaseUrl,
		token: login.token,
		allowedFormats: login.allowedFormats
	};
}
async function fetchSeriesEpisodes(config, show) {
	if (config.type !== "xtream" || !config.xtream || !show.xtreamSeriesId) return [];
	const creds = config.xtream;
	iptvLog("xtream:fetch", "get_series_info", show.xtreamSeriesId);
	let data = {};
	try {
		data = await fetchRemoteJson(apiUrl(creds, {
			action: "get_series_info",
			series_id: show.xtreamSeriesId
		}));
	} catch (err) {
		iptvWarn("xtream:fetch", "get_series_info failed", err instanceof Error ? err.message : err);
		return [];
	}
	const episodes = [];
	const rawEpisodes = data.episodes ?? data.episodes_info ?? data.data;
	const groups = normalizeEpisodeGroups(rawEpisodes);
	iptvLog("xtream:parse", "series episodes groups", groups.length, summarizePayload(rawEpisodes));
	for (const group of groups) for (const ep of group.episodes) {
		const episodeId = pickStreamId(ep, "id", "stream_id", "episode_id");
		if (!episodeId) continue;
		const episodeNum = Number(ep.episode_num ?? ep.episode ?? ep.num) || 0;
		const ext = pickExt(ep, "mp4");
		const info = ep.info && typeof ep.info === "object" ? ep.info : {};
		episodes.push({
			id: `episode:${episodeId}`,
			showId: show.id,
			season: Number(ep.season || group.season) || group.season || 1,
			episode: episodeNum,
			name: pickString(ep, "title", "name") || pickString(info, "name", "title") || `Episode ${episodeNum}`,
			plot: pickString(info, "plot", "description") || pickString(ep, "plot"),
			url: seriesStreamUrl(creds, episodeId, ext),
			duration: Number(info.duration_secs ?? ep.duration_secs) || void 0,
			containerExtension: ext,
			thumbnail: pickString(info, "movie_image", "cover") || show.poster,
			added: unix(ep.added),
			directSource: pickDirectSource(ep)
		});
	}
	iptvLog("xtream:map", "series", show.xtreamSeriesId, `episodes=${episodes.length}`);
	return episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
}
async function fetchShortEpg(creds, liveId) {
	const data = await fetchRemoteJson(shortEpgUrl(creds, liveId.replace(/^live:/, ""), 4), 2e4);
	return asList(data.epg_listings ?? data).map((row) => {
		const start = Number(row.start_timestamp) || Date.parse(String(row.start || "")) / 1e3;
		const end = Number(row.stop_timestamp) || Date.parse(String(row.end || "")) / 1e3;
		return {
			title: decodeMaybeBase64(pickString(row, "title")) || "Program",
			start: start || 0,
			end: end || 0,
			description: decodeMaybeBase64(pickString(row, "description"))
		};
	});
}
var EMPTY_STATS = {
	channels: 0,
	movies: 0,
	shows: 0,
	episodes: 0,
	categories: 0,
	hasMovieDates: false,
	hasShowDates: false
};
var EMPTY_SYNC = {
	active: false,
	phase: "",
	progress: 0,
	error: null,
	stats: null
};
var DB_NAME = "vox-iptv";
var DB_VERSION = 3;
var PLAYLIST_LS = "vox-iptv-playlist";
var PUT_CHUNK = 400;
var bus = new EventTarget();
function onDbEvent(type, fn) {
	bus.addEventListener(type, fn);
	return () => bus.removeEventListener(type, fn);
}
function emitDb(type) {
	bus.dispatchEvent(new Event(type));
}
var dbPromise = null;
function ensureIndexes(store, kind) {
	if (!store.indexNames.contains("categoryId")) store.createIndex("categoryId", "categoryId", { unique: false });
	if (!store.indexNames.contains("categoryIds")) store.createIndex("categoryIds", "categoryIds", {
		unique: false,
		multiEntry: true
	});
	if (!store.indexNames.contains("nameLower")) store.createIndex("nameLower", "nameLower", { unique: false });
	if (kind !== "channels" && !store.indexNames.contains("added")) store.createIndex("added", "added", { unique: false });
}
function openDb() {
	if (typeof indexedDB === "undefined") return Promise.reject(/* @__PURE__ */ new Error("IndexedDB is not available"));
	if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			const trans = req.transaction;
			if (!db.objectStoreNames.contains("channels")) {
				const s = db.createObjectStore("channels", { keyPath: "id" });
				s.createIndex("categoryId", "categoryId", { unique: false });
				s.createIndex("categoryIds", "categoryIds", {
					unique: false,
					multiEntry: true
				});
				s.createIndex("nameLower", "nameLower", { unique: false });
			} else if (trans) ensureIndexes(trans.objectStore("channels"), "channels");
			if (!db.objectStoreNames.contains("movies")) {
				const s = db.createObjectStore("movies", { keyPath: "id" });
				s.createIndex("categoryId", "categoryId", { unique: false });
				s.createIndex("categoryIds", "categoryIds", {
					unique: false,
					multiEntry: true
				});
				s.createIndex("nameLower", "nameLower", { unique: false });
				s.createIndex("added", "added", { unique: false });
			} else if (trans) ensureIndexes(trans.objectStore("movies"), "movies");
			if (!db.objectStoreNames.contains("shows")) {
				const s = db.createObjectStore("shows", { keyPath: "id" });
				s.createIndex("categoryId", "categoryId", { unique: false });
				s.createIndex("categoryIds", "categoryIds", {
					unique: false,
					multiEntry: true
				});
				s.createIndex("nameLower", "nameLower", { unique: false });
				s.createIndex("added", "added", { unique: false });
			} else if (trans) ensureIndexes(trans.objectStore("shows"), "shows");
			if (!db.objectStoreNames.contains("episodes")) db.createObjectStore("episodes", { keyPath: "id" }).createIndex("showId", "showId", { unique: false });
			if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" }).createIndex("kind", "kind", { unique: false });
			if (!db.objectStoreNames.contains("epg")) db.createObjectStore("epg", { keyPath: "channelId" });
			if (!db.objectStoreNames.contains("favorites")) db.createObjectStore("favorites", { keyPath: "key" });
			if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress", { keyPath: "key" }).createIndex("updatedAt", "updatedAt", { unique: false });
			if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => {
			dbPromise = null;
			reject(req.error ?? /* @__PURE__ */ new Error("Failed to open library cache"));
		};
	});
	return dbPromise;
}
function tx(db, stores, mode) {
	return db.transaction(stores, mode);
}
function reqToPromise(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function putAllChunk(store, items) {
	const t = tx(await openDb(), store, "readwrite");
	const s = t.objectStore(store);
	for (const item of items) s.put(item);
	await new Promise((resolve, reject) => {
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error);
		t.onabort = () => reject(t.error);
	});
}
async function putAll(store, items) {
	if (items.length === 0) return;
	for (let i = 0; i < items.length; i += PUT_CHUNK) await putAllChunk(store, items.slice(i, i + PUT_CHUNK));
}
async function getAll(store) {
	return reqToPromise(tx(await openDb(), store, "readonly").objectStore(store).getAll());
}
async function getById(store, id) {
	return reqToPromise(tx(await openDb(), store, "readonly").objectStore(store).get(id));
}
async function getByIndex(store, index, value) {
	const objectStore = tx(await openDb(), store, "readonly").objectStore(store);
	if (!objectStore.indexNames.contains(index)) return (await reqToPromise(objectStore.getAll())).filter((row) => {
		const record = row;
		if (record[index] === value) return true;
		if (Array.isArray(record[index]) && record[index].includes(value)) return true;
		if (index === "categoryIds" && record.categoryId === value) return true;
		return false;
	});
	return reqToPromise(objectStore.index(index).getAll(value));
}
async function countStore(store) {
	return reqToPromise(tx(await openDb(), store, "readonly").objectStore(store).count());
}
async function clearStores(stores) {
	const t = tx(await openDb(), stores, "readwrite");
	for (const name of stores) t.objectStore(name).clear();
	await new Promise((resolve, reject) => {
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error);
	});
}
async function setMeta(key, value) {
	const t = tx(await openDb(), "meta", "readwrite");
	t.objectStore("meta").put({
		key,
		value
	});
	await new Promise((resolve, reject) => {
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error);
	});
}
function readPlaylistFromStorage() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(PLAYLIST_LS);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
function writePlaylistToStorage(config) {
	if (typeof localStorage === "undefined") return;
	if (!config) localStorage.removeItem(PLAYLIST_LS);
	else localStorage.setItem(PLAYLIST_LS, JSON.stringify(config));
}
async function listRecent(store, limit = 24) {
	const idx = tx(await openDb(), store, "readonly").objectStore(store).index("added");
	const results = [];
	await new Promise((resolve, reject) => {
		const req = idx.openCursor(null, "prev");
		req.onerror = () => reject(req.error);
		req.onsuccess = () => {
			const cursor = req.result;
			if (!cursor || results.length >= limit) {
				resolve();
				return;
			}
			const value = cursor.value;
			if (value.added && value.added > 0) results.push(value);
			cursor.continue();
		};
	});
	return results;
}
async function computeStats() {
	const [channels, movies, shows, episodes, categories] = await Promise.all([
		countStore("channels"),
		countStore("movies"),
		countStore("shows"),
		countStore("episodes"),
		countStore("categories")
	]);
	const [sampleMovies, sampleShows] = await Promise.all([listRecent("movies", 1), listRecent("shows", 1)]);
	return {
		channels,
		movies,
		shows,
		episodes,
		categories,
		hasMovieDates: sampleMovies.length > 0,
		hasShowDates: sampleShows.length > 0
	};
}
async function replaceCatalog(opts) {
	iptvLog("store", "replaceCatalog", `cats=${opts.categories.length} channels=${opts.channels.length} movies=${opts.movies.length} shows=${opts.shows.length} episodes=${opts.episodes.length}`);
	await clearStores([
		"channels",
		"movies",
		"shows",
		"episodes",
		"categories",
		"epg"
	]);
	await putAll("categories", opts.categories);
	await putAll("channels", opts.channels);
	await putAll("movies", opts.movies);
	await putAll("shows", opts.shows);
	await putAll("episodes", opts.episodes);
	iptvLog("store", "replaceCatalog complete");
}
async function getFavorites() {
	return (await getAll("favorites")).sort((a, b) => b.addedAt - a.addedAt);
}
async function toggleFavorite(kind, itemId) {
	const key = `${kind}:${itemId}`;
	if (await getById("favorites", key)) {
		const t = tx(await openDb(), "favorites", "readwrite");
		t.objectStore("favorites").delete(key);
		await new Promise((resolve, reject) => {
			t.oncomplete = () => resolve();
			t.onerror = () => reject(t.error);
		});
		emitDb("favorites");
		return false;
	}
	await putAll("favorites", [{
		key,
		kind,
		itemId,
		addedAt: Date.now()
	}]);
	emitDb("favorites");
	return true;
}
async function isFavorite(kind, itemId) {
	const row = await getById("favorites", `${kind}:${itemId}`);
	return Boolean(row);
}
async function getContinueWatching() {
	return (await getAll("progress")).filter((p) => p.duration > 0 && p.position / p.duration >= .04 && p.position / p.duration <= .95).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24);
}
async function saveProgress(progress) {
	await putAll("progress", [progress]);
	emitDb("progress");
}
async function putEpg(entries) {
	await putAll("epg", entries);
	emitDb("epg");
}
function xmlUnescape(value) {
	return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/\u0026amp;/g, "&").replace(/\u0026lt;/g, "<").replace(/\u0026gt;/g, ">").replace(/\u0026quot;/g, "\"").replace(/\u0026#39;/g, "'");
}
function parseXmltvTime(raw) {
	const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
	if (!m) return Date.parse(raw) / 1e3 || 0;
	const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
	const tz = m[7] ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : "Z";
	return Date.parse(`${iso}${tz}`) / 1e3 || 0;
}
function parseXmltvNowNext(xml, channelByTvg) {
	const now = Date.now() / 1e3;
	const byChannel = /* @__PURE__ */ new Map();
	const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
	let match;
	while (match = re.exec(xml)) {
		const attrs = match[1] ?? "";
		const body = match[2] ?? "";
		const startRaw = attrs.match(/\bstart="([^"]+)"/)?.[1];
		const stopRaw = attrs.match(/\bstop="([^"]+)"/)?.[1];
		const chRaw = attrs.match(/\bchannel="([^"]+)"/)?.[1];
		if (!startRaw || !chRaw) continue;
		const start = parseXmltvTime(startRaw);
		const end = stopRaw ? parseXmltvTime(stopRaw) : start + 1800;
		if (end < now - 3600 || start > now + 28800) continue;
		const channelId = channelByTvg.get(chRaw);
		if (!channelId) continue;
		const title = xmlUnescape(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || "Program";
		const description = xmlUnescape(body.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i)?.[1] ?? "").trim();
		const list = byChannel.get(channelId) ?? [];
		list.push({
			title,
			start,
			end,
			description: description || void 0
		});
		byChannel.set(channelId, list);
	}
	const entries = [];
	for (const [channelId, programs] of byChannel) {
		programs.sort((a, b) => a.start - b.start);
		const current = programs.find((p) => p.start <= now && now < p.end) ?? programs[0];
		const next = programs.find((p) => p.start >= (current?.end || now));
		entries.push({
			channelId,
			now: current,
			next,
			updatedAt: Date.now()
		});
	}
	return entries;
}
async function importXmltv(url, channels) {
	const xml = await fetchRemoteText(url, 12e4);
	const map = /* @__PURE__ */ new Map();
	for (const ch of channels) if (ch.tvgId) map.set(ch.tvgId, ch.id);
	const entries = parseXmltvNowNext(xml, map);
	await putEpg(entries);
	return entries.length;
}
async function hydrateEpgForChannels(config, channels) {
	if (config.type !== "xtream" || !config.xtream) return;
	const creds = config.xtream;
	const entries = [];
	const now = Date.now() / 1e3;
	const queue = channels.slice(0, 40);
	const concurrency = 4;
	let cursor = 0;
	async function worker() {
		while (cursor < queue.length) {
			const ch = queue[cursor++];
			if (!ch) break;
			const existing = await getById("epg", ch.id);
			if (existing && Date.now() - existing.updatedAt < 6e5) continue;
			try {
				const listings = await fetchShortEpg(creds, ch.id);
				const current = listings.find((p) => p.start <= now && now < p.end) ?? listings[0];
				const next = listings.find((p) => p.start >= (current?.end || now));
				if (current) entries.push({
					channelId: ch.id,
					now: current,
					next,
					updatedAt: Date.now()
				});
			} catch {}
		}
	}
	await Promise.all(Array.from({ length: concurrency }, () => worker()));
	if (entries.length) await putEpg(entries);
}
var listeners = /* @__PURE__ */ new Set();
var current = { ...EMPTY_SYNC };
var running = null;
function subscribeSync(fn) {
	listeners.add(fn);
	fn(current);
	return () => listeners.delete(fn);
}
function getSyncState() {
	return current;
}
function emit(patch) {
	current = {
		...current,
		...patch
	};
	for (const fn of listeners) fn(current);
}
async function syncPlaylist(config, isFirst = false) {
	if (running) return running;
	running = (async () => {
		emit({
			active: true,
			progress: .02,
			phase: "Connecting to playlist",
			error: null,
			stats: null
		});
		try {
			if (config.type === "m3u") {
				if (!config.m3uUrl) throw new Error("Playlist URL is missing.");
				emit({
					progress: .08,
					phase: "Downloading playlist"
				});
				const text = await fetchRemoteText(config.m3uUrl, 12e4);
				if (!text.includes("#EXT")) throw new Error("That URL does not look like a valid M3U playlist.");
				const parsed = await parseM3u(text, (ratio, label) => {
					emit({
						progress: .1 + ratio * .55,
						phase: label
					});
				});
				emit({
					progress: .72,
					phase: "Caching your library"
				});
				await yieldToMain();
				await replaceCatalog({
					categories: parsed.categories,
					channels: parsed.channels,
					movies: parsed.movies,
					shows: parsed.shows,
					episodes: parsed.episodes
				});
				const nextConfig = {
					...config,
					epgUrl: parsed.epgUrl || config.epgUrl
				};
				writePlaylistToStorage(nextConfig);
				await setMeta("playlist", nextConfig);
				emitDb("playlist");
				if (parsed.epgUrl && parsed.channels.length) {
					emit({
						progress: .88,
						phase: "Loading TV guide"
					});
					try {
						await importXmltv(parsed.epgUrl, parsed.channels);
					} catch {}
				}
			} else {
				if (!config.xtream) throw new Error("Xtream login details are missing.");
				const catalog = await fetchXtreamCatalog(config.xtream, (ratio, label) => {
					emit({
						progress: Math.min(.82, ratio * .82),
						phase: label
					});
				});
				emit({
					progress: .86,
					phase: "Caching your library"
				});
				await replaceCatalog({
					categories: catalog.categories,
					channels: catalog.channels,
					movies: catalog.movies,
					shows: catalog.shows,
					episodes: []
				});
				const nextConfig = {
					...config,
					name: catalog.name || config.name,
					xtream: {
						...config.xtream,
						streamBaseUrl: catalog.streamBaseUrl || config.xtream.streamBaseUrl,
						token: catalog.token || config.xtream.token,
						allowedFormats: catalog.allowedFormats || config.xtream.allowedFormats
					}
				};
				writePlaylistToStorage(nextConfig);
				await setMeta("playlist", nextConfig);
				emitDb("playlist");
				iptvLog("store", "xtream catalog stored", `channels=${catalog.channels.length} movies=${catalog.movies.length} shows=${catalog.shows.length} categories=${catalog.categories.length}`);
				if (catalog.channels.length) {
					emit({
						progress: .92,
						phase: "Loading TV guide"
					});
					try {
						await importXmltv(xmltvUrl(config.xtream), catalog.channels);
					} catch (err) {
						iptvWarn("store", "xmltv optional failed", err instanceof Error ? err.message : err);
					}
				}
			}
			const stats = await computeStats();
			if (stats.channels + stats.movies + stats.shows === 0) throw new Error("The playlist connected, but it contains no channels, movies, or shows.");
			await setMeta("stats", stats);
			await setMeta("lastSync", Date.now());
			emit({
				active: false,
				progress: 1,
				phase: "Ready",
				stats,
				error: null
			});
			emitDb("playlist");
			return stats;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Playlist sync failed.";
			iptvWarn("store", "sync failed", message);
			emit({
				active: false,
				error: message,
				phase: "Sync failed"
			});
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
async function addPlaylist(config) {
	writePlaylistToStorage(config);
	emitDb("playlist");
	return syncPlaylist(config, true);
}
function useSyncProgress() {
	return (0, import_react.useSyncExternalStore)(subscribeSync, getSyncState, () => EMPTY_SYNC);
}
function usePlaylist() {
	const [playlist, setPlaylist] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setPlaylist(readPlaylistFromStorage());
		return onDbEvent("playlist", () => setPlaylist(readPlaylistFromStorage()));
	}, []);
	return playlist;
}
function useStats() {
	const [stats, setStats] = (0, import_react.useState)(EMPTY_STATS);
	const refresh = (0, import_react.useCallback)(() => {
		computeStats().then(setStats).catch(() => setStats(EMPTY_STATS));
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
		return onDbEvent("playlist", refresh);
	}, [refresh]);
	const sync = useSyncProgress();
	(0, import_react.useEffect)(() => {
		if (sync.stats) setStats(sync.stats);
	}, [sync.stats]);
	return stats;
}
function useKindLibrary(kind) {
	const [categories, setCategories] = (0, import_react.useState)([]);
	const [items, setItems] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let live = true;
		const store = kind === "live" ? "channels" : kind === "movie" ? "movies" : "shows";
		const load = async () => {
			setLoading(true);
			try {
				const [cats, rows] = await Promise.all([getByIndex("categories", "kind", kind), getAll(store)]);
				if (!live) return;
				const orderedCats = cats.sort((a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name));
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
		load();
		const off = onDbEvent("playlist", () => {
			load();
		});
		return () => {
			live = false;
			off();
		};
	}, [kind]);
	return {
		categories,
		items,
		loading
	};
}
function useContinueWatching() {
	const [rows, setRows] = (0, import_react.useState)([]);
	const refresh = (0, import_react.useCallback)(() => {
		getContinueWatching().then(setRows).catch(() => setRows([]));
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
		return onDbEvent("progress", refresh);
	}, [refresh]);
	return rows;
}
function useFavoriteList() {
	const [rows, setRows] = (0, import_react.useState)([]);
	const refresh = (0, import_react.useCallback)(() => {
		getFavorites().then(setRows).catch(() => setRows([]));
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
		return onDbEvent("favorites", refresh);
	}, [refresh]);
	return rows;
}
function useIsFavorite(kind, id) {
	const [on, setOn] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
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
	return [on, (0, import_react.useCallback)(() => {
		toggleFavorite(kind, id).then(setOn);
	}, [kind, id])];
}
function useRecent(kind) {
	const [rows, setRows] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		listRecent(kind === "movie" ? "movies" : "shows", 24).then(setRows).catch(() => setRows([]));
	}, [kind]);
	return rows;
}
function useEpgMap(channelIds) {
	const [map, setMap] = (0, import_react.useState)(/* @__PURE__ */ new Map());
	const key = channelIds.join("|");
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			const next = /* @__PURE__ */ new Map();
			for (const id of channelIds) {
				const row = await getById("epg", id);
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
function playbackUrls(primary, extra, more = []) {
	const extras = [
		extra,
		primary,
		...more
	].filter((value) => Boolean(value));
	const out = [];
	for (const url of extras) for (const variant of streamUrlVariants(url)) if (!out.includes(variant)) out.push(variant);
	return out;
}
function xtreamUrlBag(kind, id, ext, extra = []) {
	const creds = readPlaylistFromStorage()?.xtream;
	if (!creds) return extra;
	const streamId = id.replace(/^(live|movie|episode|show):/, "");
	const generated = kind === "live" ? liveStreamUrlVariants(creds, streamId) : vodStreamUrlVariants(creds, kind === "episode" ? "series" : "movie", streamId, ext || "mp4");
	const bases = streamHostBases(creds);
	const out = [...extra];
	for (const url of generated) for (const variant of retargetStreamHost(url, bases)) if (!out.includes(variant)) out.push(variant);
	return out;
}
async function resolvePlayable(kind, id) {
	if (kind === "live") {
		const ch = await getById("channels", id);
		if (!ch) return null;
		const extras = xtreamUrlBag("live", ch.id, ch.containerExtension, [ch.url, ch.directSource ?? ""]);
		return {
			kind: "live",
			id: ch.id,
			title: ch.name,
			poster: ch.logo,
			url: ch.url,
			urls: playbackUrls(ch.url, ch.directSource, extras),
			isLive: true
		};
	}
	if (kind === "movie") {
		const movie = await getById("movies", id);
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
			duration: movie.duration
		};
	}
	if (kind === "episode") {
		const episode = await getById("episodes", id);
		if (!episode) return null;
		const show = await getById("shows", episode.showId);
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
			duration: episode.duration
		};
	}
	return null;
}
async function loadShowEpisodes(show) {
	const existing = await getByIndex("episodes", "showId", show.id);
	if (existing.length) return existing.sort((a, b) => a.season - b.season || a.episode - b.episode);
	const playlist = readPlaylistFromStorage();
	if (!playlist) return [];
	iptvLog("xtream:fetch", "loadShowEpisodes", show.id, show.xtreamSeriesId);
	const fetched = await fetchSeriesEpisodes(playlist, show);
	if (fetched.length) await putAll("episodes", fetched);
	iptvLog("store", "episodes saved", show.id, fetched.length);
	return fetched;
}
async function refreshLibrary() {
	const playlist = readPlaylistFromStorage();
	if (!playlist) throw new Error("No playlist to refresh.");
	await syncPlaylist(playlist);
}
async function prefetchVisibleEpg(channels) {
	const playlist = readPlaylistFromStorage();
	if (!playlist) return;
	hydrateEpgForChannels(playlist, channels).catch(() => void 0);
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/logo-DCgFD2kl.js
var import_jsx_runtime = require_jsx_runtime();
function VoxMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 32 32",
		className: cn("text-accent", className),
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			width: "32",
			height: "32",
			rx: "8",
			fill: "currentColor"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M8.2 8.5h5.1L16 18.2 18.7 8.5h5.1L17.6 23.5h-3.2L8.2 8.5Z",
			fill: "white"
		})]
	});
}
function VoxWordmark({ compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoxMark, { className: "size-8" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex flex-col leading-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-lg font-semibold tracking-tight text-fg",
				children: "VOX"
			}), !compact && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[0.65rem] font-medium tracking-[0.22em] text-muted",
				children: "IPTV"
			})]
		})]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-Dz9LuctB.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-accent",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-muted",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-accent text-accent-fg hover:bg-accent/90",
			secondary: "bg-elevated text-fg hover:bg-elevated/80 shadow-[var(--shadow-border)]",
			ghost: "bg-transparent text-fg hover:bg-elevated",
			outline: "bg-transparent text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
			subtle: "bg-fg/10 text-fg hover:bg-fg/16"
		},
		size: {
			default: "h-11 rounded-md px-4 text-sm",
			sm: "h-9 rounded-sm px-3 text-sm",
			lg: "h-12 rounded-md px-5 text-base",
			icon: "size-11 rounded-md",
			"icon-sm": "size-9 rounded-sm"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild, static: isStatic, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), !isStatic && "active:not-disabled:scale-[0.96]", className),
		...props
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-12 w-full rounded-md bg-elevated px-3.5 text-base text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle", "transition-[box-shadow] duration-150 ease-out", "focus-visible:ring-2 focus-visible:ring-accent", className),
		...props
	});
}
function friendlyError(err) {
	const message = err instanceof Error ? err.message : "Could not add playlist.";
	if (/fetch failed|failed to fetch|networkerror|econnrefused|enotfound|abort/i.test(message)) return "Could not reach that playlist. Check the URL and try again.";
	return message;
}
function Onboarding() {
	const [mode, setMode] = (0, import_react.useState)("m3u");
	const [m3uUrl, setM3uUrl] = (0, import_react.useState)("");
	const [server, setServer] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const sync = useSyncProgress();
	async function onSubmit(e) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			if (mode === "m3u") {
				const url = m3uUrl.trim();
				if (!/^https?:\/\//i.test(url) && !url.startsWith("//")) throw new Error("Enter a full M3U / M3U8 URL starting with http:// or https://");
				await addPlaylist({
					type: "m3u",
					name: "M3U playlist",
					m3uUrl: url.startsWith("//") ? `https:${url}` : url,
					addedAt: Date.now()
				});
			} else {
				if (!server.trim() || !username.trim() || !password) throw new Error("Server URL, username, and password are all required.");
				await addPlaylist({
					type: "xtream",
					name: "Xtream playlist",
					xtream: parseXtreamInput(server, username, password),
					addedAt: Date.now()
				});
			}
		} catch (err) {
			setError(friendlyError(err));
		} finally {
			setBusy(false);
		}
	}
	const shownError = error || (!sync.active ? sync.error : null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "vignette flex min-h-dvh flex-col items-center justify-center px-5 py-12",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex w-full max-w-md flex-col items-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoxMark, { className: "size-14" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-5 font-display text-4xl font-semibold tracking-tight text-fg",
					children: "Vox IPTV"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-sm text-center text-sm leading-relaxed text-muted",
					children: "Add your own playlist to start watching. Nothing is preloaded."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit,
					className: "mt-8 w-full rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-1 rounded-lg bg-bg p-1",
						children: [{
							id: "m3u",
							label: "M3U URL",
							icon: Link2
						}, {
							id: "xtream",
							label: "Xtream Codes",
							icon: Server
						}].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setMode(tab.id);
								setError(null);
							},
							className: cn("flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150", mode === tab.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(tab.icon, { className: "size-4" }), tab.label]
						}, tab.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-3 px-3 pb-3 pt-4",
						children: [
							mode === "m3u" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-medium text-muted",
									children: "Playlist URL"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: m3uUrl,
									onChange: (e) => setM3uUrl(e.target.value),
									placeholder: "https://provider.example/playlist.m3u",
									autoComplete: "url",
									inputMode: "url",
									required: true
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-medium text-muted",
										children: "Server URL"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: server,
										onChange: (e) => setServer(e.target.value),
										placeholder: "http://host:port",
										autoComplete: "url",
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-medium text-muted",
										children: "Username"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: username,
										onChange: (e) => setUsername(e.target.value),
										placeholder: "Username",
										autoComplete: "username",
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-medium text-muted",
										children: "Password"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "password",
										value: password,
										onChange: (e) => setPassword(e.target.value),
										placeholder: "Password",
										autoComplete: "current-password",
										required: true
									})]
								})
							] }),
							shownError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-accent",
								role: "alert",
								children: shownError
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								size: "lg",
								className: "mt-1 w-full",
								disabled: busy || sync.active,
								children: busy || sync.active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Connecting"] }) : "Add playlist"
							})
						]
					})]
				})
			]
		})
	});
}
function Progress({ className, value, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		className: cn("progress-bar relative h-1.5 w-full overflow-hidden rounded-full", className),
		value,
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Indicator, {
			className: "h-full bg-accent transition-[transform] duration-300 ease-[var(--ease-smooth-out)]",
			style: { transform: `translateX(-${100 - (value || 0)}%)` }
		})
	});
}
function SyncOverlay() {
	const sync = useSyncProgress();
	if (!sync.active) return null;
	const pct = Math.round(sync.progress * 100);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-bg/95 px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex w-full max-w-md flex-col items-center text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoxMark, { className: "size-12" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-5 font-display text-2xl font-semibold tracking-tight",
					children: "Syncing your library"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: sync.phase || "Please wait"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, {
					value: pct,
					className: "mt-6 h-2"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-xs tabular-nums text-subtle",
					children: [pct, "%"]
				}),
				sync.stats && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-4 text-xs text-muted",
					children: [
						sync.stats.channels.toLocaleString(),
						" channels ·",
						" ",
						sync.stats.shows.toLocaleString(),
						" shows ·",
						" ",
						sync.stats.movies.toLocaleString(),
						" movies"
					]
				})
			]
		})
	});
}
function AppGuard({ children }) {
	const playlist = usePlaylist();
	const sync = useSyncProgress();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [playlist ? children : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Onboarding, {}), sync.active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SyncOverlay, {})] });
}
var KEY_TO_ACTION = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	Up: "up",
	Down: "down",
	Left: "left",
	Right: "right",
	"UIKeyInputUpArrow": "up",
	"UIKeyInputDownArrow": "down",
	"UIKeyInputLeftArrow": "left",
	"UIKeyInputRightArrow": "right",
	Enter: "select",
	NumpadEnter: "select",
	Select: "select",
	"DPAD_CENTER": "select",
	Escape: "back",
	Esc: "back",
	BrowserBack: "back",
	GoBack: "back",
	Back: "back",
	MediaPlayPause: "playpause",
	MediaPlay: "play",
	MediaPause: "pause",
	MediaStop: "stop",
	MediaRewind: "rewind",
	MediaFastForward: "forward",
	MediaTrackPrevious: "prev",
	MediaTrackNext: "next",
	MediaSkipBackward: "rewind",
	MediaSkipForward: "forward",
	Rewind: "rewind",
	FastForward: "forward",
	ChannelUp: "pageup",
	ChannelDown: "pagedown",
	PageUp: "pageup",
	PageDown: "pagedown",
	AudioVolumeMute: "playpause",
	ContextMenu: "menu",
	Info: "info",
	Guide: "info",
	F1: "info"
};
var CODE_TO_ACTION = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	Enter: "select",
	NumpadEnter: "select",
	Escape: "back",
	PageUp: "pageup",
	PageDown: "pagedown",
	MediaPlayPause: "playpause",
	MediaPlay: "play",
	MediaPause: "pause",
	MediaStop: "stop",
	MediaRewind: "rewind",
	MediaFastForward: "forward",
	MediaTrackPrevious: "prev",
	MediaTrackNext: "next"
};
/**
* Android / Fire TV / Chromium keyCodes seen in Silk, Android WebView, and
* Leanback. Media keys often arrive as key="Unidentified" with only a code.
*/
var KEYCODE_TO_ACTION = {
	4: "back",
	13: "select",
	19: "up",
	20: "down",
	21: "left",
	22: "right",
	23: "select",
	27: "back",
	33: "pageup",
	34: "pagedown",
	37: "left",
	38: "up",
	39: "right",
	40: "down",
	66: "select",
	82: "menu",
	85: "playpause",
	86: "stop",
	87: "next",
	88: "prev",
	89: "rewind",
	90: "forward",
	92: "pageup",
	93: "pagedown",
	96: "select",
	97: "back",
	102: "rewind",
	103: "forward",
	104: "rewind",
	105: "forward",
	111: "back",
	126: "play",
	127: "pause",
	166: "pageup",
	167: "pagedown",
	165: "info",
	170: "info",
	172: "info",
	175: "info",
	176: "rewind",
	177: "forward",
	178: "stop",
	179: "playpause",
	183: "rewind",
	184: "forward",
	204: "playpause",
	227: "rewind",
	228: "forward",
	272: "forward",
	273: "rewind",
	274: "forward",
	275: "rewind"
};
var GAMEPAD_BUTTON_ACTION = {
	0: "select",
	1: "back",
	2: "info",
	3: "menu",
	4: "rewind",
	5: "forward",
	6: "rewind",
	7: "forward",
	8: "rewind",
	9: "menu",
	12: "up",
	13: "down",
	14: "left",
	15: "right"
};
var DPAD_ACTIONS = /* @__PURE__ */ new Set([
	"up",
	"down",
	"left",
	"right",
	"select"
]);
var MEDIA_ACTIONS = /* @__PURE__ */ new Set([
	"playpause",
	"play",
	"pause",
	"stop",
	"rewind",
	"forward",
	"prev",
	"next"
]);
function actionFromKey(event, role = "ui") {
	if (event.ctrlKey || event.metaKey) return null;
	const key = event.key ?? "";
	const code = event.code ?? "";
	const keyCode = event.keyCode || event.which || 0;
	if (role === "keyboard") {
		if (key === "Backspace" || keyCode === 8) return "back";
		if (key === "Tab") return null;
	}
	if (role === "player" && (key === " " || key === "Spacebar" || code === "Space" || keyCode === 32)) return "playpause";
	if (role === "ui" && (key === " " || key === "Spacebar" || code === "Space" || keyCode === 32)) return "select";
	if (key && key !== "Unidentified" && KEY_TO_ACTION[key]) return KEY_TO_ACTION[key];
	if (code && CODE_TO_ACTION[code]) return CODE_TO_ACTION[code];
	if (keyCode && KEYCODE_TO_ACTION[keyCode]) return KEYCODE_TO_ACTION[keyCode];
	return null;
}
function isTvUserAgent(ua = typeof navigator === "undefined" ? "" : navigator.userAgent) {
	return /AFT|AFTA|AFTN|AFTT|AFTM|AFTB|AFTS|AFTK|AFTKA|Silk\/|Android TV|SMART-TV|SmartTV|TV Safari|Web0S|Tizen|Bravia|CrKey|GoogleTV|HbbTV|PlayStation|Xbox|Viera|NetCast|AppleTV|Vidaa|Hisense|FireTV|FTV|BRAVIA|MiTV|Plex|Homatics|Nvidia Shield/i.test(ua);
}
function enableTvMode() {
	if (typeof document === "undefined") return;
	document.documentElement.classList.add("tv-mode");
}
function isDpadAction(action) {
	return action !== null && DPAD_ACTIONS.has(action);
}
function isMediaAction(action) {
	return action !== null && MEDIA_ACTIONS.has(action);
}
function moveGridIndex(index, columns, count, dir) {
	if (count <= 0) return 0;
	const cols = Math.max(1, columns);
	const current = Math.max(0, Math.min(count - 1, index));
	const row = Math.floor(current / cols);
	const col = current % cols;
	const lastRow = Math.floor((count - 1) / cols);
	if (dir === "left") {
		if (col === 0) return current;
		return current - 1;
	}
	if (dir === "right") {
		if (current + 1 >= count) return current;
		if (col === cols - 1) return current;
		return current + 1;
	}
	if (dir === "up") {
		if (row === 0) return current;
		return (row - 1) * cols + col;
	}
	const next = (row + 1) * cols + col;
	if (row >= lastRow) return current;
	return Math.min(count - 1, next);
}
function seekStep(repeatCount) {
	if (repeatCount > 12) return 60;
	if (repeatCount > 4) return 30;
	return 10;
}
function isPrintableKey(event) {
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	const key = event.key ?? "";
	if (key.length !== 1) return null;
	if (key === " ") return " ";
	return key;
}
var AXIS_DEADZONE = .55;
function emptyGamepadHold() {
	return {
		action: null,
		since: 0,
		last: 0
	};
}
function axisAction(pad) {
	const x = pad.axes[0] ?? 0;
	const y = pad.axes[1] ?? 0;
	if (Math.abs(x) < AXIS_DEADZONE && Math.abs(y) < AXIS_DEADZONE) return null;
	if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
	return y > 0 ? "down" : "up";
}
function readGamepadAction(pad, prevButtons, now, hold) {
	const buttons = pad.buttons.map((button) => button.pressed || button.value > .5);
	let edge = null;
	for (let i = 0; i < buttons.length; i++) if (buttons[i] && !prevButtons[i]) {
		const mapped = GAMEPAD_BUTTON_ACTION[i];
		if (mapped) {
			edge = mapped;
			break;
		}
	}
	if (!edge) {
		const fromAxis = axisAction(pad);
		const axisWas = prevButtons[12] && hold.action === "up" || prevButtons[13] && hold.action === "down" || prevButtons[14] && hold.action === "left" || prevButtons[15] && hold.action === "right";
		if (fromAxis && !axisWas && hold.action !== fromAxis) edge = fromAxis;
	}
	const pressed = edge ?? (buttons[12] ? "up" : buttons[13] ? "down" : buttons[14] ? "left" : buttons[15] ? "right" : axisAction(pad));
	let action = null;
	let nextHold = hold;
	if (edge) {
		action = edge;
		nextHold = {
			action: edge,
			since: now,
			last: now
		};
	} else if (pressed && isDpadAction(pressed) && hold.action === pressed) {
		if (now - hold.since > 380 && now - hold.last > 85) {
			action = pressed;
			nextHold = {
				...hold,
				last: now
			};
		}
	} else if (!pressed) nextHold = emptyGamepadHold();
	return {
		action,
		buttons,
		hold: nextHold
	};
}
var lastAccepted = {
	action: "",
	at: 0
};
function acceptRemoteAction(action, repeat = false) {
	if (!action) return null;
	const now = typeof performance !== "undefined" ? performance.now() : Date.now();
	const minGap = repeat ? 70 : 24;
	if (lastAccepted.action === action && now - lastAccepted.at < minGap) return null;
	lastAccepted = {
		action,
		at: now
	};
	return action;
}
function focusTvIndex(index, attempts = 10) {
	const tryFocus = (left) => {
		const el = document.querySelector(`[data-tv-index="${index}"]`);
		if (el) {
			el.focus({ preventScroll: true });
			el.scrollIntoView({
				block: "nearest",
				inline: "nearest"
			});
			return;
		}
		if (left > 0) requestAnimationFrame(() => tryFocus(left - 1));
	};
	tryFocus(attempts);
}
function findNextInDirection(origin, candidates, dir) {
	const ox = origin.left + origin.width / 2;
	const oy = origin.top + origin.height / 2;
	let best = null;
	let bestScore = Infinity;
	for (const { el, rect } of candidates) {
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		const dx = x - ox;
		const dy = y - oy;
		let primary = 0;
		let secondary = 0;
		if (dir === "right") {
			if (rect.left < origin.right - 8) continue;
			primary = dx;
			secondary = Math.abs(dy);
		} else if (dir === "left") {
			if (rect.right > origin.left + 8) continue;
			primary = -dx;
			secondary = Math.abs(dy);
		} else if (dir === "down") {
			if (rect.top < origin.bottom - 8) continue;
			primary = dy;
			secondary = Math.abs(dx);
		} else {
			if (rect.bottom > origin.top + 8) continue;
			primary = -dy;
			secondary = Math.abs(dx);
		}
		if (primary <= 0) continue;
		const aligned = (dir === "left" || dir === "right" ? Math.min(origin.bottom, rect.bottom) - Math.max(origin.top, rect.top) : Math.min(origin.right, rect.right) - Math.max(origin.left, rect.left)) > 4 ? 0 : 1;
		const score = primary + secondary * (aligned ? 4 : .6);
		if (score < bestScore) {
			bestScore = score;
			best = el;
		}
	}
	return best;
}
function spatialNavigate(dir) {
	if (typeof document === "undefined") return false;
	const nodes = [...document.querySelectorAll("[data-tv-node], [data-tv-zone='search'], [data-tv-zone='sort'], [data-tv-zone='cats'], [data-tv-index], header nav a")].filter((el) => {
		if (el.closest("[data-kb-root]")) return false;
		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	});
	if (!nodes.length) return false;
	const active = document.activeElement;
	const current = active && nodes.includes(active) ? active : nodes.find((el) => el.tabIndex === 0) ?? nodes[0];
	const next = findNextInDirection(current.getBoundingClientRect(), nodes.filter((el) => el !== current).map((el) => ({
		el,
		rect: el.getBoundingClientRect()
	})), dir);
	if (!next) return false;
	next.focus({ preventScroll: true });
	next.scrollIntoView({
		block: "nearest",
		inline: "nearest"
	});
	return true;
}
var BackContext = (0, import_react.createContext)(() => () => void 0);
var RemoteContext = (0, import_react.createContext)(() => () => void 0);
function useBackHandler(handler, deps = []) {
	const register = (0, import_react.useContext)(BackContext);
	(0, import_react.useEffect)(() => register(handler), [register, ...deps]);
}
function useRemoteHandler(handler, deps = []) {
	const register = (0, import_react.useContext)(RemoteContext);
	(0, import_react.useEffect)(() => register(handler), [register, ...deps]);
}
function RemoteRoot({ children }) {
	const backHandlers = (0, import_react.useRef)([]);
	const remoteHandlers = (0, import_react.useRef)([]);
	const armed = (0, import_react.useRef)(false);
	const downActions = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const padButtons = (0, import_react.useRef)([]);
	const padHold = (0, import_react.useRef)([]);
	const registerBack = (0, import_react.useCallback)((handler) => {
		backHandlers.current.push(handler);
		return () => {
			backHandlers.current = backHandlers.current.filter((entry) => entry !== handler);
		};
	}, []);
	const registerRemote = (0, import_react.useCallback)((handler) => {
		remoteHandlers.current.push(handler);
		return () => {
			remoteHandlers.current = remoteHandlers.current.filter((entry) => entry !== handler);
		};
	}, []);
	const dispatchBack = (0, import_react.useCallback)(() => {
		const stack = backHandlers.current;
		for (let i = stack.length - 1; i >= 0; i--) if (stack[i]?.()) return true;
		return false;
	}, []);
	const dispatchRemote = (0, import_react.useCallback)((event, original) => {
		const action = acceptRemoteAction(event.action, event.repeat);
		if (!action) return false;
		const payload = {
			...event,
			action
		};
		for (let i = remoteHandlers.current.length - 1; i >= 0; i--) if (remoteHandlers.current[i]?.(payload)) {
			original?.preventDefault();
			original?.stopPropagation();
			return true;
		}
		if (action === "up" || action === "down" || action === "left" || action === "right") {
			if (spatialNavigate(action)) {
				original?.preventDefault();
				original?.stopPropagation();
				return true;
			}
		}
		return false;
	}, []);
	(0, import_react.useEffect)(() => {
		if (isTvUserAgent()) enableTvMode();
		const arm = () => {
			if (armed.current || typeof history === "undefined") return;
			try {
				history.pushState({ voxRemote: 1 }, "", window.location.href);
				armed.current = true;
			} catch {}
		};
		arm();
		const onPop = () => {
			armed.current = false;
			const consumed = dispatchBack();
			arm();
			if (consumed) return;
		};
		const isEditable = (target) => {
			const el = target;
			const tag = el?.tagName;
			return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);
		};
		const onKeyDown = (event) => {
			if (event.isComposing) return;
			const action = actionFromKey(event, "ui");
			if (!action) return;
			if (isDpadAction(action) || isMediaAction(action)) enableTvMode();
			downActions.current.add(action);
			if (action === "back") {
				if (isEditable(event.target)) return;
				event.preventDefault();
				if (dispatchBack()) event.stopPropagation();
				return;
			}
			if (isEditable(event.target) && !isMediaAction(action)) return;
			dispatchRemote({
				action,
				repeat: event.repeat,
				source: "key",
				key: event.key,
				keyCode: event.keyCode || event.which
			}, event);
		};
		const onKeyUp = (event) => {
			const action = actionFromKey(event, "ui");
			if (!action) return;
			const seen = downActions.current.has(action);
			downActions.current.delete(action);
			if (seen || event.isComposing) return;
			if (isEditable(event.target) && !isMediaAction(action)) return;
			if (action === "back") {
				event.preventDefault();
				if (dispatchBack()) event.stopPropagation();
				return;
			}
			dispatchRemote({
				action,
				repeat: false,
				source: "key",
				key: event.key,
				keyCode: event.keyCode || event.which
			}, event);
		};
		window.addEventListener("popstate", onPop);
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("keyup", onKeyUp, true);
		return () => {
			window.removeEventListener("popstate", onPop);
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("keyup", onKeyUp, true);
		};
	}, [dispatchBack, dispatchRemote]);
	(0, import_react.useEffect)(() => {
		let raf = 0;
		const poll = () => {
			raf = requestAnimationFrame(poll);
			const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
			const now = performance.now();
			for (let i = 0; i < pads.length; i++) {
				const pad = pads[i];
				if (!pad) continue;
				const result = readGamepadAction(pad, padButtons.current[i] ?? [], now, padHold.current[i] ?? emptyGamepadHold());
				padButtons.current[i] = result.buttons;
				padHold.current[i] = result.hold;
				if (!result.action) continue;
				enableTvMode();
				if (result.action === "back") {
					dispatchBack();
					continue;
				}
				dispatchRemote({
					action: result.action,
					repeat: result.hold.last !== result.hold.since && result.hold.action === result.action,
					source: "gamepad"
				});
			}
		};
		const start = () => {
			if (!raf) raf = requestAnimationFrame(poll);
		};
		window.addEventListener("gamepadconnected", start);
		start();
		return () => {
			window.removeEventListener("gamepadconnected", start);
			cancelAnimationFrame(raf);
		};
	}, [dispatchBack, dispatchRemote]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackContext.Provider, {
		value: registerBack,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoteContext.Provider, {
			value: registerRemote,
			children
		})
	});
}
var styles_default = "/assets/styles-BPzrO79N.css";
var APP_NAME = "Vox IPTV";
var Route$10 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#08080a"
			},
			{
				name: "description",
				content: "Vox IPTV — add your M3U or Xtream playlist and watch live TV, shows, and movies."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "dark antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoteRoot, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					theme: "dark",
					position: "top-center",
					toastOptions: { style: {
						background: "#1a1a1e",
						border: "1px solid rgb(255 255 255 / 0.08)",
						color: "#f4f4f5"
					} }
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	});
}
var $$splitComponentImporter$6 = () => import("./routes-v4m3c8em.mjs");
var Route$9 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./live-B6NrE8MV.mjs");
var Route$8 = createFileRoute("/live")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./movies-7PszWGrd.mjs");
var Route$7 = createFileRoute("/movies")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./shows--BTIFng3.mjs");
var Route$6 = createFileRoute("/shows")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./watch-V1tSaSsS.mjs");
var Route$5 = createFileRoute("/watch")({
	validateSearch: (search) => ({
		kind: String(search.kind ?? ""),
		id: String(search.id ?? "")
	}),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./shows.index-DJ5vCnmb.mjs");
var Route$4 = createFileRoute("/shows/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./shows._showId-WQGNGkDl.mjs");
var Route$3 = createFileRoute("/shows/$showId")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
function looksLikeTsAligned(bytes) {
	const limit = Math.min(bytes.length, 2048);
	for (let i = 0; i < Math.min(bytes.length, 188); i++) {
		if (bytes[i] !== 71) continue;
		const next = i + 188;
		const third = i + 376;
		if (next >= limit) return true;
		if (bytes[next] === 71 && (third >= limit || bytes[third] === 71)) return true;
	}
	return false;
}
function sniffStreamBytes(bytes) {
	if (!bytes || bytes.length === 0) return "unknown";
	let offset = 0;
	while (offset < bytes.length && (bytes[offset] === 32 || bytes[offset] === 10 || bytes[offset] === 13 || bytes[offset] === 9)) offset += 1;
	const slice = bytes.subarray(offset);
	if (slice.length >= 4) {
		const head = String.fromCharCode(slice[0], slice[1], slice[2], slice[3]);
		if (head.startsWith("#EXT")) return "hls";
		if (head.startsWith("ID3")) {
			if (looksLikeTsAligned(slice.subarray(Math.min(slice.length, 10)))) return "ts";
			return "unknown";
		}
	}
	if (looksLikeTsAligned(slice)) return "ts";
	if (slice.length >= 8) {
		if (String.fromCharCode(slice[4], slice[5], slice[6], slice[7]) === "ftyp") return "mp4";
	}
	if (slice[0] === 26 && slice[1] === 69 && slice[2] === 223) return "mkv";
	try {
		if (new TextDecoder("utf-8", { fatal: false }).decode(slice.subarray(0, Math.min(slice.length, 24))).trimStart().startsWith("#EXT")) return "hls";
	} catch {}
	return "unknown";
}
function mimeForKind(kind, fallback) {
	if (kind === "hls") return "application/vnd.apple.mpegurl";
	if (kind === "ts") return "video/mp2t";
	if (kind === "mp4") return "video/mp4";
	if (kind === "mkv") return "video/x-matroska";
	return fallback || "application/octet-stream";
}
function looksLikePlaylistUrl(url, contentType = "") {
	return /mpegurl|m3u8/i.test(contentType) || /\.m3u8(\?|$)/i.test(url);
}
function engineForKind(kind, fallbackUrl) {
	if (kind === "hls") return "hls";
	if (kind === "ts") return "mpegts";
	if (kind === "mp4" || kind === "mkv") return "native";
	if (fallbackUrl && /\.m3u8(\?|$)/i.test(fallbackUrl)) return "hls";
	if (fallbackUrl && /\/live\//i.test(fallbackUrl)) return "mpegts";
	return "native";
}
var API_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
var STREAM_UAS = [
	"VLC/3.0.21 LibVLC/3.0.21",
	"Lavf/60.16.100",
	"Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
	API_UA
];
var MAX_FETCH_BYTES = 94371840;
function decodeTargetUrl(raw) {
	if (!raw) throw new Error("Missing url");
	let url = raw;
	if (!/^https?:\/\//i.test(url)) try {
		const decoded = decodeURIComponent(raw);
		if (/^https?:\/\//i.test(decoded)) url = decoded;
	} catch {
		url = raw;
	}
	if (!/^https?:\/\//i.test(url)) throw new Error("Only HTTP and HTTPS URLs are allowed");
	return url;
}
function corsHeaders(extra) {
	const headers = new Headers(extra);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
	headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Stream-Format");
	headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
	return headers;
}
function optionsResponse() {
	return new Response(null, {
		status: 204,
		headers: corsHeaders()
	});
}
function resolveRef(base, ref) {
	try {
		return new URL(ref, base).href;
	} catch {
		return ref;
	}
}
function proxyStreamPath(url) {
	return `/api/iptv/stream?u=${encodeURIComponent(url)}`;
}
function rewriteM3u8(text, playlistUrl) {
	return text.split(/\r?\n/).map((line) => {
		const trimmed = line.trim();
		if (!trimmed) return line;
		if (trimmed.startsWith("#")) return line.replace(/URI=(?:"([^"]+)"|'([^']+)'|([^,\s]+))/g, (_all, d, s, u) => {
			const uri = d || s || u;
			if (!uri || uri.startsWith("data:")) return _all;
			return `URI="${proxyStreamPath(resolveRef(playlistUrl, uri))}"`;
		});
		return proxyStreamPath(resolveRef(playlistUrl, trimmed));
	}).join("\n");
}
async function upstream(url, request, { range = true, userAgent = API_UA } = {}) {
	const headers = new Headers();
	headers.set("User-Agent", userAgent);
	headers.set("Accept", "*/*");
	headers.set("Accept-Encoding", "identity");
	const rangeHeader = request.headers.get("Range");
	if (range && rangeHeader) headers.set("Range", rangeHeader);
	const incomingReferer = request.headers.get("x-upstream-referer");
	if (incomingReferer) headers.set("Referer", incomingReferer);
	else try {
		headers.set("Referer", new URL(url).origin + "/");
	} catch {}
	try {
		iptvLog("proxy", "upstream", redactUrl(url), userAgent.split(" ")[0]);
		return await fetch(url, {
			method: "GET",
			headers,
			redirect: "follow"
		});
	} catch (err) {
		iptvWarn("proxy", "upstream failed", redactUrl(url), err instanceof Error ? err.message : err);
		throw new Error("Could not reach the IPTV server. Check the URL and try again.");
	}
}
async function upstreamWithUaFallback(url, request, opts = {}) {
	const agents = opts.stream ? STREAM_UAS : [API_UA];
	let last = null;
	for (const ua of agents) {
		const res = await upstream(url, request, {
			range: opts.range,
			userAgent: ua
		});
		last = res;
		if (res.status === 401 || res.status === 403 || res.status === 406 || res.status === 451) {
			iptvWarn("proxy", "ua rejected", res.status, ua.split(" ")[0]);
			continue;
		}
		return res;
	}
	return last;
}
async function proxyFetch(url, request) {
	const res = await upstream(url, request, {
		range: false,
		userAgent: API_UA
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		iptvWarn("proxy", "fetch status", res.status, redactUrl(url));
		return new Response(body || res.statusText, {
			status: res.status,
			headers: corsHeaders({ "content-type": "text/plain; charset=utf-8" })
		});
	}
	const buf = await res.arrayBuffer();
	if (buf.byteLength > MAX_FETCH_BYTES) return new Response("Playlist is too large to import.", {
		status: 413,
		headers: corsHeaders({ "content-type": "text/plain; charset=utf-8" })
	});
	const type = res.headers.get("content-type") || "text/plain; charset=utf-8";
	iptvLog("proxy", "fetch ok", buf.byteLength, type);
	return new Response(buf, {
		status: 200,
		headers: corsHeaders({ "content-type": type })
	});
}
function passthroughHeaders(res, kind) {
	const headers = corsHeaders();
	for (const key of [
		"content-type",
		"content-length",
		"content-range",
		"accept-ranges",
		"cache-control"
	]) {
		const value = res.headers.get(key);
		if (value) headers.set(key, value);
	}
	headers.set("content-type", mimeForKind(kind, res.headers.get("content-type")));
	headers.set("x-stream-format", kind);
	if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
	headers.set("cache-control", "no-store");
	return headers;
}
async function peekBody(res, max = 512) {
	const body = res.body;
	if (!body) return {
		kind: "unknown",
		head: /* @__PURE__ */ new Uint8Array(),
		rest: null
	};
	const reader = body.getReader();
	const chunks = [];
	let size = 0;
	while (size < max) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) {
			chunks.push(value);
			size += value.length;
		}
	}
	const head = concatBytes(chunks);
	const rest = new ReadableStream({
		async start(controller) {
			if (head.length) controller.enqueue(head);
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (value) controller.enqueue(value);
				}
				controller.close();
			} catch (err) {
				controller.error(err);
			}
		},
		cancel() {
			reader.cancel();
		}
	});
	return {
		kind: sniffStreamBytes(head),
		head,
		rest
	};
}
function concatBytes(chunks) {
	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}
function errorResponse(status, message) {
	return new Response(message, {
		status,
		headers: corsHeaders({
			"content-type": "text/plain; charset=utf-8",
			"x-stream-format": "unknown"
		})
	});
}
async function proxyProbe(url, request) {
	try {
		const res = await upstreamWithUaFallback(url, request, {
			range: false,
			stream: true
		});
		const finalUrl = res.url || url;
		const peeked = await peekBody(res, 1024);
		peeked.rest?.cancel();
		const payload = {
			ok: res.status < 400,
			status: res.status,
			kind: peeked.kind === "unknown" && looksLikePlaylistUrl(url, res.headers.get("content-type") || "") ? "hls" : peeked.kind,
			finalUrl
		};
		iptvLog("proxy", "probe", payload.kind, payload.status, redactUrl(finalUrl));
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: corsHeaders({
				"content-type": "application/json",
				"x-stream-format": payload.kind
			})
		});
	} catch (err) {
		iptvWarn("proxy", "probe failed", redactUrl(url), err instanceof Error ? err.message : err);
		return new Response(JSON.stringify({
			ok: false,
			status: 0,
			kind: "unknown"
		}), {
			status: 200,
			headers: corsHeaders({ "content-type": "application/json" })
		});
	}
}
async function proxyStream(url, request) {
	const res = await upstreamWithUaFallback(url, request, {
		range: true,
		stream: true
	});
	if (res.status >= 400) {
		const message = `Upstream ${res.status}`;
		iptvWarn("proxy", "stream status", res.status, redactUrl(url));
		return errorResponse(res.status, message);
	}
	const finalUrl = res.url || url;
	const type = res.headers.get("content-type") || "";
	const playlistHint = looksLikePlaylistUrl(url, type) || looksLikePlaylistUrl(finalUrl, type);
	if (playlistHint || /octet-stream|mp2t|video\//i.test(type) || !type) {
		const peeked = await peekBody(res);
		iptvLog("proxy", "sniff", peeked.kind, redactUrl(finalUrl), type || "no-type");
		if (peeked.kind === "hls" || playlistHint && peeked.kind === "unknown" && peeked.head.length && looksLikeExt(peeked.head)) {
			const text = await readStreamText(peeked.rest);
			const rewritten = text.trimStart().startsWith("#EXT") ? rewriteM3u8(text, finalUrl) : text;
			return new Response(rewritten, {
				status: 200,
				headers: corsHeaders({
					"content-type": "application/vnd.apple.mpegurl",
					"cache-control": "no-store",
					"x-stream-format": "hls"
				})
			});
		}
		const headers = passthroughHeaders(res, peeked.kind === "unknown" && playlistHint ? "ts" : peeked.kind);
		return new Response(peeked.rest, {
			status: res.status,
			headers
		});
	}
	if (/mpegurl|m3u8/i.test(type)) {
		const text = await res.text();
		const rewritten = text.trimStart().startsWith("#EXT") ? rewriteM3u8(text, finalUrl) : text;
		return new Response(rewritten, {
			status: 200,
			headers: corsHeaders({
				"content-type": "application/vnd.apple.mpegurl",
				"cache-control": "no-store",
				"x-stream-format": "hls"
			})
		});
	}
	const headers = passthroughHeaders(res, sniffFromType(type));
	return new Response(res.body, {
		status: res.status,
		headers
	});
}
function looksLikeExt(bytes) {
	try {
		return new TextDecoder().decode(bytes).trimStart().startsWith("#EXT");
	} catch {
		return false;
	}
}
function sniffFromType(type) {
	if (/mpegurl|m3u8/i.test(type)) return "hls";
	if (/mp2t/i.test(type)) return "ts";
	if (/mp4/i.test(type)) return "mp4";
	if (/matroska|mkv/i.test(type)) return "mkv";
	return "unknown";
}
async function readStreamText(stream) {
	if (!stream) return "";
	const reader = stream.getReader();
	const chunks = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	return new TextDecoder().decode(concatBytes(chunks));
}
async function proxyImage(url, request) {
	const res = await upstream(url, request, { range: false });
	if (!res.ok) return new Response(null, {
		status: res.status,
		headers: corsHeaders()
	});
	const headers = corsHeaders({
		"content-type": res.headers.get("content-type") || "image/jpeg",
		"cache-control": "public, max-age=86400"
	});
	return new Response(res.body, {
		status: 200,
		headers
	});
}
var Route$2 = createFileRoute("/api/iptv/fetch")({ server: { handlers: {
	OPTIONS: async () => optionsResponse(),
	GET: async ({ request }) => {
		try {
			return await proxyFetch(decodeTargetUrl(new URL(request.url).searchParams.get("u")), request);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Proxy failed";
			return new Response(message, {
				status: 400,
				headers: { "content-type": "text/plain; charset=utf-8" }
			});
		}
	}
} } });
var Route$1 = createFileRoute("/api/iptv/image")({ server: { handlers: {
	OPTIONS: async () => optionsResponse(),
	GET: async ({ request }) => {
		try {
			return await proxyImage(decodeTargetUrl(new URL(request.url).searchParams.get("u")), request);
		} catch {
			return new Response(null, { status: 400 });
		}
	}
} } });
var Route = createFileRoute("/api/iptv/stream")({ server: { handlers: {
	OPTIONS: async () => optionsResponse(),
	GET: async ({ request }) => {
		try {
			const url = new URL(request.url);
			const target = decodeTargetUrl(url.searchParams.get("u"));
			if (url.searchParams.get("probe") === "1") return await proxyProbe(target, request);
			return await proxyStream(target, request);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Stream proxy failed";
			return new Response(message, {
				status: 400,
				headers: { "content-type": "text/plain; charset=utf-8" }
			});
		}
	}
} } });
var IndexRoute = Route$9.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$10
});
var LiveRoute = Route$8.update({
	id: "/live",
	path: "/live",
	getParentRoute: () => Route$10
});
var MoviesRoute = Route$7.update({
	id: "/movies",
	path: "/movies",
	getParentRoute: () => Route$10
});
var ShowsRoute = Route$6.update({
	id: "/shows",
	path: "/shows",
	getParentRoute: () => Route$10
});
var WatchRoute = Route$5.update({
	id: "/watch",
	path: "/watch",
	getParentRoute: () => Route$10
});
var ShowsIndexRoute = Route$4.update({
	id: "/",
	path: "/",
	getParentRoute: () => ShowsRoute
});
var ShowsShowIdRoute = Route$3.update({
	id: "/$showId",
	path: "/$showId",
	getParentRoute: () => ShowsRoute
});
var ApiIptvFetchRoute = Route$2.update({
	id: "/api/iptv/fetch",
	path: "/api/iptv/fetch",
	getParentRoute: () => Route$10
});
var ApiIptvImageRoute = Route$1.update({
	id: "/api/iptv/image",
	path: "/api/iptv/image",
	getParentRoute: () => Route$10
});
var ApiIptvStreamRoute = Route.update({
	id: "/api/iptv/stream",
	path: "/api/iptv/stream",
	getParentRoute: () => Route$10
});
var ShowsRouteChildren = {
	ShowsShowIdRoute,
	ShowsIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	LiveRoute,
	MoviesRoute,
	ShowsRoute: ShowsRoute._addFileChildren(ShowsRouteChildren),
	WatchRoute,
	ApiIptvFetchRoute,
	ApiIptvImageRoute,
	ApiIptvStreamRoute
};
var routeTree = Route$10._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent,
		scrollRestoration: true
	});
}
//#endregion
export { pickEngine as A, sortCatalogItems as B, formatDuration as C, loadShowEpisodes as D, iptvWarn as E, redactUrl as F, useFavoriteList as G, unwrapProxiedUrl as H, refreshLibrary as I, usePlaylist as J, useIsFavorite as K, resolvePlayable as L, probeStream as M, proxiedImageUrl as N, loadSort as O, proxiedStreamUrl as P, saveProgress as R, flattenCategoryTree as S, iptvLog as T, useContinueWatching as U, streamUrlVariants as V, useEpgMap as W, useStats as X, useRecent as Y, useSyncProgress as Z, availableSorts as _, useBackHandler as a, cn as b, enableTvMode as c, moveGridIndex as d, seekStep as f, allCategoryId as g, VoxWordmark as h, Route$5 as i, prefetchVisibleEpg as j, looksHls as k, focusTvIndex as l, Button as m, engineForKind as n, useRemoteHandler as o, SyncOverlay as p, useKindLibrary as q, Route$3 as r, actionFromKey as s, router_exports as t, isPrintableKey as u, buildCategoryTree as v, getById as w, filterCatalogItems as x, categoryItemCounts as y, saveSort as z };
