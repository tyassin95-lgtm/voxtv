import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as Play } from "../_libs/lucide-react.mjs";
import { N as proxiedImageUrl, b as cn } from "./router-Dz9LuctB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/poster-card-oiMIDCyi.js
var import_jsx_runtime = require_jsx_runtime();
function PosterCard({ to, search, title, image, subtitle, progress, tvIndex, tvFocused }) {
	const inner = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "poster-frame relative block overflow-hidden rounded-md bg-elevated",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: proxiedImageUrl(image) || image,
					alt: "",
					loading: "lazy",
					className: "absolute inset-0 size-full object-cover"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute inset-0 flex items-center justify-center bg-bg/0 opacity-0 transition-[opacity,background-color] duration-200 group-hover:bg-bg/35 group-hover:opacity-100 group-focus-visible:bg-bg/35 group-focus-visible:opacity-100",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "ml-0.5 size-5 fill-current" })
					})
				}),
				progress !== void 0 && progress > 0 && progress < 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-fg/25",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block h-full bg-accent",
						style: { width: `${progress * 100}%` }
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mt-2 block truncate text-sm font-medium text-fg",
			children: title
		}),
		subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block truncate text-xs text-muted",
			children: subtitle
		})
	] });
	const className = cn("poster-scale group min-w-0 snap-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", tvFocused && "tv-focused");
	const tabIndex = tvIndex === void 0 ? void 0 : tvFocused ? 0 : -1;
	if (to === "/shows/$showId") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/shows/$showId",
		params: { showId: search?.id ?? "" },
		className,
		"data-tv-index": tvIndex,
		"data-tv-node": "card",
		tabIndex,
		children: inner
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/watch",
		search: {
			kind: search?.kind ?? "movie",
			id: search?.id ?? ""
		},
		className,
		"data-tv-index": tvIndex,
		"data-tv-node": "card",
		tabIndex,
		children: inner
	});
}
function WideCard({ title, subtitle, image, progress, kind, id }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/watch",
		search: {
			kind,
			id
		},
		className: "poster-scale group w-56 shrink-0 snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64",
		"data-tv-node": "wide",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "wide-frame relative block overflow-hidden rounded-md bg-elevated",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: proxiedImageUrl(image) || image,
						alt: "",
						loading: "lazy",
						className: "absolute inset-0 size-full object-cover"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute inset-0 flex items-center justify-center bg-bg/0 opacity-0 transition-[opacity] duration-200 group-hover:bg-bg/35 group-hover:opacity-100",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "ml-0.5 size-5 fill-current" })
						})
					}),
					progress !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-fg/25",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block h-full bg-accent",
							style: { width: `${Math.min(100, progress * 100)}%` }
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-2 block truncate text-sm font-medium",
				children: title
			}),
			subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate text-xs text-muted",
				children: subtitle
			})
		]
	});
}
//#endregion
export { WideCard as n, PosterCard as t };
