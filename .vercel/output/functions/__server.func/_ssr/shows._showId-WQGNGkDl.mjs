import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as Play, k as ArrowLeft, x as Heart } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./app-shell-BOR87Stn.mjs";
import { D as loadShowEpisodes, K as useIsFavorite, N as proxiedImageUrl, a as useBackHandler, b as cn, c as enableTvMode, m as Button, o as useRemoteHandler, r as Route$3, w as getById } from "./router-Dz9LuctB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shows._showId-WQGNGkDl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ShowPage() {
	const { showId } = Route$3.useParams();
	const navigate = useNavigate();
	const [show, setShow] = (0, import_react.useState)(null);
	const [episodes, setEpisodes] = (0, import_react.useState)([]);
	const [season, setSeason] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [favorited, toggleFav] = useIsFavorite("show", showId);
	const [epIndex, setEpIndex] = (0, import_react.useState)(0);
	const [zone, setZone] = (0, import_react.useState)("play");
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			const row = await getById("shows", showId);
			if (!live) return;
			if (!row) {
				setLoading(false);
				return;
			}
			setShow(row);
			const eps = await loadShowEpisodes(row);
			if (!live) return;
			setEpisodes(eps);
			setSeason(eps[0]?.season ?? 1);
			setLoading(false);
		})();
		return () => {
			live = false;
		};
	}, [showId]);
	const seasons = (0, import_react.useMemo)(() => [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b), [episodes]);
	const visible = episodes.filter((e) => e.season === season);
	(0, import_react.useEffect)(() => {
		setEpIndex((index) => Math.max(0, Math.min(Math.max(visible.length - 1, 0), index)));
	}, [visible.length, season]);
	useBackHandler(() => {
		navigate({ to: "/shows" });
		return true;
	}, [navigate]);
	useRemoteHandler((event) => {
		if (loading || !show) return false;
		const action = event.action;
		if (action !== "up" && action !== "down" && action !== "left" && action !== "right" && action !== "select" && action !== "playpause" && action !== "play") return false;
		enableTvMode();
		const playFirst = () => {
			const ep = visible[0] ?? visible[epIndex];
			if (ep) navigate({
				to: "/watch",
				search: {
					kind: "episode",
					id: ep.id
				}
			});
		};
		if (action === "play" || action === "playpause") {
			const ep = visible[epIndex] ?? visible[0];
			if (ep) navigate({
				to: "/watch",
				search: {
					kind: "episode",
					id: ep.id
				}
			});
			return true;
		}
		if (action === "select") {
			if (zone === "play") playFirst();
			else if (zone === "fav") toggleFav();
			else if (zone === "seasons") return true;
			else {
				const ep = visible[epIndex];
				if (ep) navigate({
					to: "/watch",
					search: {
						kind: "episode",
						id: ep.id
					}
				});
			}
			return true;
		}
		if (zone === "play" || zone === "fav") {
			if (action === "right") setZone("fav");
			else if (action === "left") setZone("play");
			else if (action === "down") setZone(seasons.length ? "seasons" : "episodes");
			return true;
		}
		if (zone === "seasons") {
			if (action === "up") {
				setZone("play");
				return true;
			}
			if (action === "down") {
				setZone("episodes");
				return true;
			}
			if (action === "left" || action === "right") {
				const i = Math.max(0, seasons.indexOf(season ?? seasons[0] ?? 1));
				const next = action === "left" ? Math.max(0, i - 1) : Math.min(seasons.length - 1, i + 1);
				const value = seasons[next];
				if (value !== void 0) setSeason(value);
			}
			return true;
		}
		if (action === "up") {
			if (epIndex <= 0) setZone(seasons.length ? "seasons" : "play");
			else setEpIndex((i) => i - 1);
			return true;
		}
		if (action === "down") {
			setEpIndex((i) => Math.min(visible.length - 1, i + 1));
			return true;
		}
		return true;
	}, [
		loading,
		show,
		visible,
		epIndex,
		zone,
		seasons,
		season,
		toggleFav,
		navigate
	]);
	(0, import_react.useEffect)(() => {
		if (zone !== "episodes") return;
		document.querySelector(`[data-ep-index="${epIndex}"]`)?.scrollIntoView({ block: "nearest" });
	}, [epIndex, zone]);
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-8 py-16 text-sm text-muted",
		children: "Loading show…"
	}) });
	if (!show) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-8 py-16 text-sm text-muted",
		children: "This show is no longer in your library."
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [show.backdrop && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: proxiedImageUrl(show.backdrop),
			alt: "",
			className: "absolute inset-0 h-72 w-full object-cover opacity-30"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex flex-col gap-5 px-4 py-6 md:flex-row md:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: proxiedImageUrl(show.poster) || show.poster,
				alt: "",
				className: "h-64 w-44 rounded-lg object-cover shadow-[var(--shadow-poster)]"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col justify-end",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => navigate({ to: "/shows" }),
						className: "mb-3 flex h-10 w-10 items-center justify-center rounded-md text-muted hover:text-fg",
						"aria-label": "Back to TV shows",
						"data-tv-node": "back",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl font-semibold tracking-tight",
						children: show.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							show.year,
							show.rating,
							`${seasons.length} season${seasons.length === 1 ? "" : "s"}`
						].filter(Boolean).join(" · ")
					}),
					show.plot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-2xl text-sm leading-relaxed text-muted",
						children: show.plot
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-2",
						children: [visible[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							onClick: () => navigate({
								to: "/watch",
								search: {
									kind: "episode",
									id: visible[0].id
								}
							}),
							className: cn(zone === "play" && "tv-focused"),
							"data-tv-node": "play",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "ml-0.5 size-4 fill-current" }), "Play"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "secondary",
							onClick: toggleFav,
							className: cn(zone === "fav" && "tv-focused"),
							"data-tv-node": "fav",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: cn("size-4", favorited && "fill-accent text-accent") }), favorited ? "Saved" : "Favorite"]
						})]
					})
				]
			})]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-4 pb-10 md:px-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "row-scroll mt-2 flex gap-2 overflow-x-auto",
			children: seasons.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSeason(s),
				"data-tv-node": "season",
				className: cn("h-11 shrink-0 rounded-full px-4 text-sm font-medium", season === s ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg", zone === "seasons" && season === s && "tv-focused"),
				children: ["Season ", s]
			}, s))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-col gap-2",
			children: [visible.map((ep, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-ep-index": index,
				"data-tv-node": "episode",
				onClick: () => navigate({
					to: "/watch",
					search: {
						kind: "episode",
						id: ep.id
					}
				}),
				className: cn("flex min-h-16 items-center gap-3 rounded-lg bg-surface px-3 py-3 text-left shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]", zone === "episodes" && index === epIndex && "tv-focused"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-10 text-sm tabular-nums text-muted",
						children: ep.episode
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate text-sm font-medium",
							children: ep.name
						}), ep.plot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate text-xs text-muted",
							children: ep.plot
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 text-muted" })
				]
			}, ep.id)), visible.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "py-8 text-sm text-muted",
				children: "No episodes in this season yet."
			})]
		})]
	})] });
}
//#endregion
export { ShowPage as component };
