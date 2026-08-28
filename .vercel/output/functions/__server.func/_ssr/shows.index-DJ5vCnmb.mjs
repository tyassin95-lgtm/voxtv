import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as AppShell } from "./app-shell-BOR87Stn.mjs";
import { t as CategoryBrowser } from "./category-browser-BXQcRuNp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shows.index-DJ5vCnmb.js
var import_jsx_runtime = require_jsx_runtime();
function ShowsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		fill: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategoryBrowser, {
			kind: "show",
			title: "TV Shows",
			searchPlaceholder: "Search TV shows"
		})
	});
}
//#endregion
export { ShowsPage as component };
