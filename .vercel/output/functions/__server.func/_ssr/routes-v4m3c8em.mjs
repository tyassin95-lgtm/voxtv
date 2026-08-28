import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as RefreshCw } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./app-shell-BOR87Stn.mjs";
import { G as useFavoriteList, I as refreshLibrary, J as usePlaylist, U as useContinueWatching, X as useStats, Y as useRecent, Z as useSyncProgress, b as cn, m as Button, p as SyncOverlay, w as getById } from "./router-Dz9LuctB.mjs";
import { n as WideCard, t as PosterCard } from "./poster-card-oiMIDCyi.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-v4m3c8em.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ContentRow({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mb-3 px-4 font-display text-lg font-semibold tracking-tight md:px-8",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "row-scroll flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:gap-4 md:px-8",
			children
		})]
	});
}
var TABS = [
	{
		id: "live",
		label: "Channels"
	},
	{
		id: "show",
		label: "TV Shows"
	},
	{
		id: "movie",
		label: "Movies"
	}
];
function FavoritesPanel() {
	const favorites = useFavoriteList();
	const [tab, setTab] = (0, import_react.useState)("live");
	const [items, setItems] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		let live = true;
		const subset = favorites.filter((f) => f.kind === tab);
		Promise.all(subset.map(async (fav) => {
			const store = fav.kind === "live" ? "channels" : fav.kind === "movie" ? "movies" : "shows";
			return getById(store, fav.itemId);
		})).then((rows) => {
			if (live) setItems(rows.filter(Boolean));
		});
		return () => {
			live = false;
		};
	}, [favorites, tab]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8 px-4 md:px-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-semibold tracking-tight",
				children: "Favorites"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-1 rounded-lg bg-elevated p-1",
				children: TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(t.id),
					className: cn("h-9 rounded-md px-3 text-sm font-medium transition-colors duration-150", tab === t.id ? "bg-surface text-fg" : "text-muted hover:text-fg"),
					children: t.label
				}, t.id))
			})]
		}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "py-8 text-sm text-muted",
			children: "Nothing saved here yet. Heart a title while browsing to keep it close."
		}) : tab === "live" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "row-scroll flex snap-x gap-3 overflow-x-auto pb-2",
			children: items.map((ch) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WideCard, {
				title: ch.name,
				image: ch.logo,
				kind: "live",
				id: ch.id
			}, ch.id))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6",
			children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
				to: tab === "show" ? "/shows/$showId" : "/watch",
				search: {
					kind: tab,
					id: item.id
				},
				title: item.name,
				image: "poster" in item ? item.poster : ""
			}, item.id))
		})]
	});
}
function HomePage() {
	const stats = useStats();
	const playlist = usePlaylist();
	const continueWatching = useContinueWatching();
	const recentShows = useRecent("show");
	const recentMovies = useRecent("movie");
	const sync = useSyncProgress();
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function refresh() {
		setBusy(true);
		try {
			await refreshLibrary();
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		trailing: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "secondary",
			size: "sm",
			onClick: refresh,
			disabled: busy || sync.active,
			className: "shrink-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: busy || sync.active ? "size-4 animate-spin" : "size-4" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden sm:inline",
					children: "Refresh playlist data"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "sm:hidden",
					children: "Refresh"
				})
			]
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-4 pt-6 md:px-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: playlist?.name || "Your library"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 font-display text-3xl font-semibold tracking-tight",
					children: "Home"
				})]
			}),
			continueWatching.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentRow, {
				title: "Continue Watching",
				children: continueWatching.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WideCard, {
					title: item.title,
					subtitle: item.subtitle,
					image: item.poster,
					progress: item.duration ? item.position / item.duration : 0,
					kind: item.kind,
					id: item.itemId
				}, item.key))
			}),
			stats.hasShowDates && recentShows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentRow, {
				title: "Recently Added TV Shows",
				children: recentShows.map((show) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-32 shrink-0 snap-start sm:w-36",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
						to: "/shows/$showId",
						search: {
							kind: "show",
							id: show.id
						},
						title: show.name,
						image: show.poster,
						subtitle: show.year
					})
				}, show.id))
			}),
			stats.hasMovieDates && recentMovies.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentRow, {
				title: "Recently Added Movies",
				children: recentMovies.map((movie) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-32 shrink-0 snap-start sm:w-36",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
						to: "/watch",
						search: {
							kind: "movie",
							id: movie.id
						},
						title: movie.name,
						image: movie.poster,
						subtitle: movie.year
					})
				}, movie.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FavoritesPanel, {}),
			sync.active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SyncOverlay, {})
		]
	});
}
//#endregion
export { HomePage as component };
