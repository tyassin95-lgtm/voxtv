import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { d as useRouterState, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { S as Film, T as Clapperboard, b as House, u as Radio } from "../_libs/lucide-react.mjs";
import { b as cn, h as VoxWordmark } from "./router-Dz9LuctB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-shell-BOR87Stn.js
var import_jsx_runtime = require_jsx_runtime();
var NAV = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/live",
		label: "Live TV",
		icon: Radio
	},
	{
		to: "/shows",
		label: "TV Shows",
		icon: Clapperboard
	},
	{
		to: "/movies",
		label: "Movies",
		icon: Film
	}
];
function AppShell({ children, trailing, fill }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("bg-bg text-fg", fill ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-bg/90 px-4 backdrop-blur-md md:px-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoxWordmark, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "ml-4 hidden items-center gap-1 md:flex",
						children: NAV.map((item) => {
							const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								"aria-current": active ? "page" : void 0,
								"data-tv-node": "nav",
								className: cn("rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", active ? "text-fg" : "text-muted hover:text-fg"),
								children: [item.label, active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1 block h-0.5 rounded-full bg-accent" })]
							}, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ml-auto flex min-w-0 items-center gap-2",
						children: trailing
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn(fill ? "flex min-h-0 flex-1 flex-col overflow-hidden pb-20 md:pb-0" : "pb-24 md:pb-8"),
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden",
				children: NAV.map((item) => {
					const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", active ? "text-fg" : "text-muted"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: cn("size-5", active && "text-accent") }), item.label]
					}, item.to);
				})
			})
		]
	});
}
//#endregion
export { AppShell as t };
