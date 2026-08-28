import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { v as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { E as Check, O as ArrowUpDown, a as Space, k as ArrowLeft, p as PanelLeft, s as Search, t as X, v as Languages, w as Delete, y as Keyboard } from "../_libs/lucide-react.mjs";
import { B as sortCatalogItems, N as proxiedImageUrl, O as loadSort, S as flattenCategoryTree, W as useEpgMap, _ as availableSorts, a as useBackHandler, b as cn, c as enableTvMode, d as moveGridIndex, g as allCategoryId, j as prefetchVisibleEpg, l as focusTvIndex, o as useRemoteHandler, q as useKindLibrary, s as actionFromKey, u as isPrintableKey, v as buildCategoryTree, x as filterCatalogItems, y as categoryItemCounts, z as saveSort } from "./router-Dz9LuctB.mjs";
import { t as PosterCard } from "./poster-card-oiMIDCyi.mjs";
import { n as rememberBrowseList } from "./browse-list-Cm4wC9Gf.mjs";
import { t as useVirtualizer } from "../_libs/@tanstack/react-virtual+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/category-browser-BXQcRuNp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SearchBar({ value, onChange, placeholder, className, onActivate, active }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative w-full max-w-md", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"data-tv-zone": "search",
				"data-tv-node": "search",
				onClick: () => onActivate?.(),
				className: cn("flex h-11 w-full items-center rounded-md bg-elevated pr-20 pl-10 text-left text-sm shadow-[var(--shadow-border)]", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", active && "ring-2 ring-accent", !value && "text-subtle"),
				"aria-label": placeholder,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1 truncate",
					dir: "auto",
					children: value || placeholder
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5",
				children: [value ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": "Clear search",
					onClick: (event) => {
						event.stopPropagation();
						onChange("");
					},
					className: "flex size-8 items-center justify-center rounded-sm text-muted hover:text-fg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": "Open keyboard",
					onClick: () => onActivate?.(),
					className: "flex size-8 items-center justify-center rounded-sm text-muted hover:text-fg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, { className: "size-4" })
				})]
			})
		]
	});
}
var EN_LETTERS = [
	[
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"0"
	].map((c) => ({
		id: c,
		label: c,
		char: c
	})),
	[
		"q",
		"w",
		"e",
		"r",
		"t",
		"y",
		"u",
		"i",
		"o",
		"p"
	].map((c) => ({
		id: c,
		label: c.toUpperCase(),
		char: c
	})),
	[
		"a",
		"s",
		"d",
		"f",
		"g",
		"h",
		"j",
		"k",
		"l"
	].map((c) => ({
		id: c,
		label: c.toUpperCase(),
		char: c
	})),
	[
		"z",
		"x",
		"c",
		"v",
		"b",
		"n",
		"m"
	].map((c) => ({
		id: c,
		label: c.toUpperCase(),
		char: c
	}))
];
var EN_SYMBOLS = [
	[
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"0"
	].map((c) => ({
		id: `s${c}`,
		label: c,
		char: c
	})),
	[
		"-",
		"/",
		":",
		";",
		"(",
		")",
		"$",
		"&",
		"@",
		"\""
	].map((c) => ({
		id: c,
		label: c,
		char: c
	})),
	[
		"#",
		"%",
		"!",
		"?",
		".",
		",",
		"'",
		"*",
		"+",
		"="
	].map((c) => ({
		id: c,
		label: c,
		char: c
	}))
];
var AR_LETTERS = [
	[
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"0"
	].map((c) => ({
		id: `ar${c}`,
		label: c,
		char: c
	})),
	[
		"ض",
		"ص",
		"ث",
		"ق",
		"ف",
		"غ",
		"ع",
		"ه",
		"خ",
		"ح",
		"ج",
		"د"
	].map((c) => ({
		id: c,
		label: c,
		char: c,
		rtl: true
	})),
	[
		"ش",
		"س",
		"ي",
		"ب",
		"ل",
		"ا",
		"ت",
		"ن",
		"م",
		"ك",
		"ط"
	].map((c) => ({
		id: c,
		label: c,
		char: c,
		rtl: true
	})),
	[
		"ئ",
		"ء",
		"ؤ",
		"ر",
		"لا",
		"ى",
		"ة",
		"و",
		"ز",
		"ظ",
		"ذ"
	].map((c) => ({
		id: c,
		label: c,
		char: c,
		rtl: true
	}))
];
var AR_SYMBOLS = [
	[
		"١",
		"٢",
		"٣",
		"٤",
		"٥",
		"٦",
		"٧",
		"٨",
		"٩",
		"٠"
	].map((c) => ({
		id: `ind${c}`,
		label: c,
		char: c,
		rtl: true
	})),
	[
		"آ",
		"أ",
		"إ",
		"ة",
		"ى",
		"و",
		"ي",
		"ء",
		"ؤ",
		"ئ"
	].map((c) => ({
		id: `ham${c}`,
		label: c,
		char: c,
		rtl: true
	})),
	[
		"،",
		"؛",
		"؟",
		"!",
		".",
		":",
		"\"",
		"'",
		"-",
		"_"
	].map((c) => ({
		id: `p${c}`,
		label: c,
		char: c
	}))
];
var LANG_LS = "vox-iptv-kb-lang";
function loadKeyboardLang() {
	if (typeof localStorage === "undefined") return "en";
	return localStorage.getItem("vox-iptv-kb-lang") === "ar" ? "ar" : "en";
}
function saveKeyboardLang(lang) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(LANG_LS, lang);
}
function actionRow(lang, mode) {
	return [
		{
			id: "mode",
			label: mode === "letters" ? "123" : lang === "ar" ? "أبجد" : "ABC",
			action: "mode",
			grow: 1.2
		},
		{
			id: "lang",
			label: lang === "ar" ? "EN" : "العربية",
			action: "lang",
			grow: 1.5
		},
		{
			id: "space",
			label: lang === "ar" ? "مسافة" : "Space",
			action: "space",
			grow: 3
		},
		{
			id: "clear",
			label: lang === "ar" ? "مسح" : "Clear",
			action: "clear",
			grow: 1.3
		},
		{
			id: "backspace",
			label: lang === "ar" ? "حذف" : "Delete",
			action: "backspace",
			grow: 1.3
		},
		{
			id: "done",
			label: lang === "ar" ? "تم" : "Done",
			action: "done",
			grow: 1.4
		}
	];
}
function buildRows(lang, mode) {
	return [...mode === "symbols" ? lang === "ar" ? AR_SYMBOLS : EN_SYMBOLS : lang === "ar" ? AR_LETTERS : EN_LETTERS, actionRow(lang, mode)];
}
function keyAt(rows, row, col) {
	const r = Math.max(0, Math.min(rows.length - 1, row));
	const line = rows[r] ?? [];
	return {
		row: r,
		col: Math.max(0, Math.min(Math.max(line.length - 1, 0), col))
	};
}
function moveKey(rows, row, col, dir) {
	if (dir !== "up" && dir !== "down" && dir !== "left" && dir !== "right") return {
		row,
		col
	};
	const current = rows[row] ?? [];
	if (dir === "left") return keyAt(rows, row, col - 1);
	if (dir === "right") return keyAt(rows, row, col + 1);
	const nextRow = dir === "up" ? row - 1 : row + 1;
	if (nextRow < 0 || nextRow >= rows.length) return {
		row,
		col
	};
	const from = current[col];
	const nextLine = rows[nextRow] ?? [];
	if (!from || !nextLine.length) return keyAt(rows, nextRow, 0);
	const fromMid = current.slice(0, col).reduce((sum, key) => sum + (key.grow ?? 1), 0) + (from.grow ?? 1) / 2;
	let acc = 0;
	let best = 0;
	let bestDist = Infinity;
	nextLine.forEach((key, index) => {
		const mid = acc + (key.grow ?? 1) / 2;
		const dist = Math.abs(mid - fromMid);
		if (dist < bestDist) {
			bestDist = dist;
			best = index;
		}
		acc += key.grow ?? 1;
	});
	return {
		row: nextRow,
		col: best
	};
}
function SearchKeyboard({ open, value, onChange, onClose, placeholder }) {
	const [lang, setLang] = (0, import_react.useState)(loadKeyboardLang);
	const [mode, setMode] = (0, import_react.useState)("letters");
	const [cursor, setCursor] = (0, import_react.useState)({
		row: 1,
		col: 0
	});
	const rows = (0, import_react.useMemo)(() => buildRows(lang, mode), [lang, mode]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setCursor({
			row: 1,
			col: 0
		});
	}, [
		open,
		lang,
		mode
	]);
	useRemoteHandler((event) => {
		if (!open) return false;
		const { action, key } = event;
		if (action === "up" || action === "down" || action === "left" || action === "right") {
			setCursor((cur) => moveKey(rows, cur.row, cur.col, action));
			return true;
		}
		if (action === "select") {
			if (key === " " || key === "Spacebar") {
				onChange(value + " ");
				return true;
			}
			const current = rows[cursor.row]?.[cursor.col];
			if (current) applyKey(current);
			return true;
		}
		return false;
	}, [
		open,
		rows,
		cursor,
		value,
		onChange,
		lang
	]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const onKey = (event) => {
			const printable = isPrintableKey(event);
			if (printable) {
				event.preventDefault();
				event.stopPropagation();
				onChange(value + printable);
				return;
			}
			if (actionFromKey(event, "keyboard") === "back" && (event.key === "Backspace" || event.keyCode === 8)) {
				event.preventDefault();
				event.stopPropagation();
				onChange(value.slice(0, -1));
			}
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [
		open,
		value,
		onChange
	]);
	function applyKey(key) {
		if ("char" in key) {
			onChange(value + key.char);
			return;
		}
		if (key.action === "space") onChange(value + " ");
		else if (key.action === "backspace") onChange(value.slice(0, -1));
		else if (key.action === "clear") onChange("");
		else if (key.action === "done") onClose();
		else if (key.action === "lang") {
			const next = lang === "en" ? "ar" : "en";
			setLang(next);
			saveKeyboardLang(next);
			setMode("letters");
		} else if (key.action === "mode") setMode((current) => current === "letters" ? "symbols" : "letters");
	}
	if (!open) return null;
	const rtl = lang === "ar";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-50 flex flex-col justify-end",
		"data-kb-root": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "pointer-events-auto absolute inset-0 bg-overlay",
			"aria-label": "Close keyboard",
			tabIndex: -1,
			onClick: onClose
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "dialog",
			"aria-label": lang === "ar" ? "لوحة المفاتيح" : "Search keyboard",
			"aria-modal": "true",
			className: cn("pointer-events-auto relative border-t border-border bg-surface px-3 pb-5 pt-3 shadow-[var(--shadow-poster)] md:px-6", rtl && "font-arabic"),
			dir: rtl ? "rtl" : "ltr",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:text-fg",
					"aria-label": "Close keyboard",
					onClick: onClose,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: cn("min-h-12 min-w-0 flex-1 truncate rounded-md bg-elevated px-3 py-2 text-lg shadow-[var(--shadow-border)]", rtl && "font-arabic", !value && "text-subtle"),
					dir: "auto",
					children: [value || placeholder, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-accent align-middle" })]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-1.5",
				children: rows.map((line, rowIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-1.5",
					children: line.map((key, colIndex) => {
						const focused = cursor.row === rowIndex && cursor.col === colIndex;
						const grow = key.grow ?? 1;
						const arabic = "rtl" in key && key.rtl;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"data-kb-row": rowIndex,
							"data-kb-col": colIndex,
							onMouseEnter: () => setCursor({
								row: rowIndex,
								col: colIndex
							}),
							onClick: () => applyKey(key),
							style: {
								flexGrow: grow,
								flexBasis: 0
							},
							className: cn("tv-key flex min-h-12 items-center justify-center rounded-md px-1 text-sm font-medium whitespace-nowrap shadow-[var(--shadow-border)] transition-colors duration-150", focused ? "bg-accent text-accent-fg" : "bg-elevated text-fg hover:bg-elevated/80", arabic && "font-arabic text-lg"),
							children: "action" in key && key.action === "backspace" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Delete, { className: "size-4" }) : "action" in key && key.action === "space" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1",
								children: [!rtl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Space, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: key.label })]
							}) : "action" in key && key.action === "lang" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("flex items-center gap-1", lang === "en" && "font-arabic"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Languages, { className: "size-3.5" }), key.label]
							}) : "action" in key && key.action === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), key.label]
							}) : key.label
						}, key.id);
					})
				}, rowIndex))
			})]
		})]
	});
}
function useColumnCount() {
	const [count, setCount] = (0, import_react.useState)(3);
	(0, import_react.useEffect)(() => {
		const compute = () => {
			const w = window.innerWidth;
			if (w < 480) setCount(2);
			else if (w < 720) setCount(3);
			else if (w < 1024) setCount(4);
			else if (w < 1400) setCount(5);
			else setCount(6);
		};
		compute();
		window.addEventListener("resize", compute);
		return () => window.removeEventListener("resize", compute);
	}, []);
	return count;
}
function storedCategoryKey(kind) {
	return `vox-iptv-cat-${kind}`;
}
function headerLinks() {
	return [...document.querySelectorAll("header nav a")];
}
function CategoryBrowser({ kind, title, searchPlaceholder }) {
	const navigate = useNavigate();
	const { categories, items: allItems, loading } = useKindLibrary(kind);
	const [categoryId, setCategoryId] = (0, import_react.useState)(() => {
		if (typeof sessionStorage === "undefined") return allCategoryId(kind);
		return sessionStorage.getItem(storedCategoryKey(kind)) || allCategoryId(kind);
	});
	const [query, setQuery] = (0, import_react.useState)("");
	const [sort, setSort] = (0, import_react.useState)(() => loadSort(kind));
	const [drawerOpen, setDrawerOpen] = (0, import_react.useState)(false);
	const [keyboardOpen, setKeyboardOpen] = (0, import_react.useState)(false);
	const [sortOpen, setSortOpen] = (0, import_react.useState)(false);
	const [zone, setZone] = (0, import_react.useState)("grid");
	const [gridIndex, setGridIndex] = (0, import_react.useState)(0);
	const [sortCursor, setSortCursor] = (0, import_react.useState)(0);
	const parentRef = (0, import_react.useRef)(null);
	const columns = useColumnCount();
	const allId = allCategoryId(kind);
	(0, import_react.useEffect)(() => {
		if (typeof sessionStorage === "undefined") return;
		sessionStorage.setItem(storedCategoryKey(kind), categoryId);
	}, [kind, categoryId]);
	(0, import_react.useEffect)(() => {
		if (loading) return;
		if (categoryId === allId) return;
		if (!categories.some((category) => category.id === categoryId)) setCategoryId(allId);
	}, [
		loading,
		categories,
		categoryId,
		allId
	]);
	const tree = (0, import_react.useMemo)(() => buildCategoryTree(categories), [categories]);
	const flat = (0, import_react.useMemo)(() => flattenCategoryTree(tree), [tree]);
	const navIds = (0, import_react.useMemo)(() => [allId, ...flat.map((node) => node.category.id)], [allId, flat]);
	const counts = (0, import_react.useMemo)(() => categoryItemCounts(allItems, categories), [allItems, categories]);
	const selected = categories.find((c) => c.id === categoryId);
	const selectedName = categoryId === allId ? "All" : selected?.name || "All";
	const filtered = (0, import_react.useMemo)(() => filterCatalogItems(allItems, categories, query ? allId : categoryId, query), [
		allItems,
		categories,
		categoryId,
		query,
		allId
	]);
	const items = (0, import_react.useMemo)(() => sortCatalogItems(filtered, sort, kind), [
		filtered,
		sort,
		kind
	]);
	const sortOptions = (0, import_react.useMemo)(() => availableSorts(allItems, kind), [allItems, kind]);
	const isLive = kind === "live";
	const gridColumns = isLive ? 1 : columns;
	const rows = isLive ? items.length : Math.ceil(items.length / columns);
	const virtualizer = useVirtualizer({
		count: rows,
		getScrollElement: () => parentRef.current,
		estimateSize: () => isLive ? 76 : 280,
		overscan: 8
	});
	(0, import_react.useEffect)(() => {
		parentRef.current?.scrollTo({ top: 0 });
		setGridIndex(0);
	}, [
		categoryId,
		query,
		sort
	]);
	(0, import_react.useEffect)(() => {
		setGridIndex((index) => Math.max(0, Math.min(Math.max(items.length - 1, 0), index)));
	}, [items.length]);
	(0, import_react.useEffect)(() => {
		rememberBrowseList(kind, items.map((item) => item.id));
	}, [kind, items]);
	const virtualItems = virtualizer.getVirtualItems();
	const visibleIds = isLive ? virtualItems.map((row) => items[row.index]?.id).filter((id) => Boolean(id)).join(",") : "";
	const visibleChannels = (0, import_react.useMemo)(() => {
		if (!isLive || !visibleIds) return [];
		const wanted = new Set(visibleIds.split(","));
		return items.filter((ch) => wanted.has(ch.id));
	}, [
		isLive,
		items,
		visibleIds
	]);
	const epgMap = useEpgMap(visibleChannels.map((c) => c.id));
	(0, import_react.useEffect)(() => {
		if (isLive && visibleChannels.length) prefetchVisibleEpg(visibleChannels);
	}, [isLive, visibleIds]);
	function selectCategory(id, opts) {
		setCategoryId(id);
		setQuery("");
		if (!opts?.keepDrawer) setDrawerOpen(false);
	}
	function focusCategoryButton(id) {
		const drawer = document.getElementById(`drawer-cat-${id}`);
		const desktop = document.getElementById(`cat-${id}`);
		(drawer && drawer.getClientRects().length > 0 ? drawer : desktop)?.focus();
	}
	function focusZone(next, index = gridIndex) {
		setZone(next);
		if (next === "sidebar") {
			const openBtn = document.querySelector("[data-tv-zone='cats']");
			if (openBtn && window.matchMedia("(max-width: 767px)").matches && !drawerOpen) {
				openBtn.focus();
				return;
			}
			focusCategoryButton(categoryId);
			return;
		}
		if (next === "search") {
			document.querySelector("[data-tv-zone='search']")?.focus();
			return;
		}
		if (next === "sort" || next === "sortmenu") {
			document.querySelector("[data-tv-zone='sort']")?.focus();
			return;
		}
		if (next === "header") {
			const links = headerLinks();
			(links.find((link) => link.getAttribute("aria-current") === "page") ?? links[0])?.focus();
			return;
		}
		if (next === "grid") {
			const clamped = Math.max(0, Math.min(Math.max(items.length - 1, 0), index));
			setGridIndex(clamped);
			enableTvMode();
		}
	}
	(0, import_react.useEffect)(() => {
		if (zone !== "grid" || !items.length) return;
		const row = isLive ? gridIndex : Math.floor(gridIndex / Math.max(columns, 1));
		virtualizer.scrollToIndex(row, { align: "center" });
		const timer = window.setTimeout(() => focusTvIndex(gridIndex), 16);
		return () => window.clearTimeout(timer);
	}, [
		zone,
		gridIndex,
		columns,
		isLive,
		items.length,
		virtualizer
	]);
	useBackHandler(() => {
		if (keyboardOpen) {
			setKeyboardOpen(false);
			focusZone("search");
			return true;
		}
		if (sortOpen) {
			setSortOpen(false);
			focusZone("sort");
			return true;
		}
		if (drawerOpen) {
			setDrawerOpen(false);
			return true;
		}
		if (query) {
			setQuery("");
			return true;
		}
		if (categoryId !== allId) {
			selectCategory(allId, { keepDrawer: true });
			return true;
		}
		navigate({ to: "/" });
		return true;
	}, [
		keyboardOpen,
		sortOpen,
		drawerOpen,
		query,
		categoryId,
		allId,
		navigate
	]);
	const navState = (0, import_react.useRef)({
		zone,
		gridIndex,
		categoryId,
		navIds,
		itemsLength: items.length,
		columns: gridColumns,
		sortOpen,
		sortCursor,
		sortOptions,
		keyboardOpen,
		drawerOpen,
		query,
		allId,
		sort
	});
	navState.current = {
		zone,
		gridIndex,
		categoryId,
		navIds,
		itemsLength: items.length,
		columns: gridColumns,
		sortOpen,
		sortCursor,
		sortOptions,
		keyboardOpen,
		drawerOpen,
		query,
		allId,
		sort
	};
	useRemoteHandler((event) => {
		const state = navState.current;
		if (state.keyboardOpen) return false;
		const action = event.action;
		if (action !== "up" && action !== "down" && action !== "left" && action !== "right" && action !== "select" && action !== "pageup" && action !== "pagedown") return false;
		enableTvMode();
		const active = document.activeElement;
		let currentZone = state.zone;
		if (active?.dataset.tvIndex !== void 0) currentZone = "grid";
		else if (active?.dataset.tvZone === "search") currentZone = "search";
		else if (active?.dataset.tvZone === "sort") currentZone = "sort";
		else if (active?.dataset.tvZone === "sidebar" || active?.dataset.catId) currentZone = "sidebar";
		else if (active?.dataset.tvZone === "cats") currentZone = "sidebar";
		else if (active?.closest("header nav")) currentZone = "header";
		if (currentZone !== state.zone) setZone(currentZone);
		if (state.sortOpen || currentZone === "sortmenu") {
			const last = state.sortOptions.length - 1;
			if (action === "up") setSortCursor((i) => Math.max(0, i - 1));
			else if (action === "down" || action === "pagedown") setSortCursor((i) => Math.min(last, i + 1));
			else if (action === "pageup") setSortCursor(0);
			else if (action === "select") {
				const option = state.sortOptions[state.sortCursor];
				if (option) {
					setSort(option.id);
					saveSort(kind, option.id);
				}
				setSortOpen(false);
				setZone("sort");
			} else if (action === "left" || action === "right") {
				setSortOpen(false);
				setZone("sort");
			}
			return true;
		}
		if (action === "select") {
			if (currentZone === "search") {
				setKeyboardOpen(true);
				return true;
			}
			if (currentZone === "sort") {
				setSortCursor(Math.max(0, state.sortOptions.findIndex((option) => option.id === state.sort)));
				setSortOpen(true);
				setZone("sortmenu");
				return true;
			}
			if (currentZone === "sidebar") {
				if (window.matchMedia("(max-width: 767px)").matches && !state.drawerOpen) {
					setDrawerOpen(true);
					return true;
				}
				if (state.itemsLength) focusZone("grid", 0);
				return true;
			}
			const focused = document.activeElement;
			if (focused && (focused.tagName === "A" || focused.tagName === "BUTTON")) focused.click();
			return true;
		}
		if (currentZone === "header") {
			const links = headerLinks();
			const current = Math.max(0, links.findIndex((link) => link === document.activeElement));
			if (action === "left" && current > 0) links[current - 1]?.focus();
			else if (action === "right" && current < links.length - 1) links[current + 1]?.focus();
			else if (action === "down") focusZone(state.itemsLength ? "grid" : "sidebar", state.gridIndex);
			return true;
		}
		if (currentZone === "sidebar") {
			if (action === "up" || action === "pageup") {
				const focused = active?.dataset.catId || state.categoryId;
				const current = state.navIds.indexOf(focused);
				if (current <= 0) {
					focusZone("header");
					return true;
				}
				const next = state.navIds[current - 1];
				if (next) {
					selectCategory(next, { keepDrawer: true });
					focusCategoryButton(next);
				}
				return true;
			}
			if (action === "down" || action === "pagedown") {
				const focused = active?.dataset.catId || state.categoryId;
				const current = state.navIds.indexOf(focused);
				const from = current === -1 ? 0 : current;
				if (from >= state.navIds.length - 1) return true;
				const next = state.navIds[from + 1];
				if (next) {
					selectCategory(next, { keepDrawer: true });
					focusCategoryButton(next);
				}
				return true;
			}
			if (action === "right") {
				if (state.drawerOpen) setDrawerOpen(false);
				if (state.itemsLength) focusZone("grid", 0);
				else focusZone("search");
				return true;
			}
			if (action === "left") focusZone("header");
			return true;
		}
		if (currentZone === "search") {
			if (action === "left") focusZone("sidebar");
			else if (action === "right") focusZone("sort");
			else if (action === "down" || action === "pagedown") focusZone(state.itemsLength ? "grid" : "sidebar", 0);
			else if (action === "up") focusZone("header");
			return true;
		}
		if (currentZone === "sort") {
			if (action === "left") focusZone("search");
			else if (action === "down" || action === "pagedown") focusZone(state.itemsLength ? "grid" : "sidebar", 0);
			else if (action === "up") focusZone("header");
			else if (action === "right") {
				setSortCursor(Math.max(0, state.sortOptions.findIndex((option) => option.id === state.sort)));
				setSortOpen(true);
				setZone("sortmenu");
			}
			return true;
		}
		if (currentZone === "grid") {
			if (!state.itemsLength) {
				focusZone("sidebar");
				return true;
			}
			const fromAttr = active?.dataset.tvIndex;
			const fromIndex = fromAttr !== void 0 && fromAttr !== "" ? Number(fromAttr) : state.gridIndex;
			const cols = state.columns;
			const atLeft = fromIndex % cols === 0;
			const atTop = fromIndex < cols;
			if (action === "left" && atLeft) {
				focusZone("sidebar");
				return true;
			}
			if ((action === "up" || action === "pageup") && atTop) {
				focusZone("search");
				return true;
			}
			if (action === "pageup") {
				setGridIndex(Math.max(0, fromIndex - cols * 5));
				return true;
			}
			if (action === "pagedown") {
				setGridIndex(Math.min(state.itemsLength - 1, fromIndex + cols * 5));
				return true;
			}
			const dir = action === "up" || action === "down" || action === "left" || action === "right" ? action : null;
			if (dir) setGridIndex(moveGridIndex(Number.isFinite(fromIndex) ? fromIndex : state.gridIndex, cols, state.itemsLength, dir));
			return true;
		}
		return false;
	}, [kind]);
	const sidebarProps = {
		kind,
		allId,
		tree,
		selectedId: query ? "" : categoryId,
		total: allItems.length,
		counts,
		onSelect: (id) => {
			selectCategory(id);
			setZone("sidebar");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-0 flex-1 overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: "hidden h-full w-64 shrink-0 flex-col border-r border-border bg-bg md:flex",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySidebar, {
					...sidebarProps,
					idPrefix: "cat"
				})
			}),
			drawerOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-0 z-40 md:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "absolute inset-0 bg-overlay",
					"aria-label": "Close categories",
					onClick: () => setDrawerOpen(false)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "absolute inset-y-0 left-0 flex w-72 max-w-full flex-col bg-surface shadow-[var(--shadow-poster)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex h-14 shrink-0 items-center justify-between border-b border-border px-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: "Categories"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "flex size-11 items-center justify-center rounded-md text-muted hover:text-fg",
							"aria-label": "Close categories",
							onClick: () => setDrawerOpen(false),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySidebar, {
						...sidebarProps,
						idPrefix: "drawer-cat"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 flex-col gap-4 px-4 pt-5 md:px-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-3xl font-semibold tracking-tight",
							children: title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-3 sm:flex-row sm:items-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									"data-tv-zone": "cats",
									className: "flex h-11 min-w-0 items-center gap-2 rounded-md bg-elevated px-3 text-sm font-medium shadow-[var(--shadow-border)] focus-visible:ring-2 focus-visible:ring-accent md:hidden",
									onClick: () => setDrawerOpen(true),
									"aria-label": "Open categories",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeft, { className: "size-4 shrink-0 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: selectedName
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchBar, {
									value: query,
									onChange: setQuery,
									placeholder: searchPlaceholder,
									className: "max-w-none flex-1",
									onActivate: () => {
										setZone("search");
										setKeyboardOpen(true);
									},
									active: keyboardOpen || zone === "search"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										"data-tv-zone": "sort",
										onClick: () => {
											setSortCursor(Math.max(0, sortOptions.findIndex((option) => option.id === sort)));
											setSortOpen((open) => !open);
											setZone("sortmenu");
										},
										className: cn("relative flex h-11 min-w-36 items-center gap-2 rounded-md bg-elevated px-3 text-sm shadow-[var(--shadow-border)]", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", (zone === "sort" || sortOpen) && "ring-2 ring-accent"),
										"aria-label": "Sort titles",
										"aria-expanded": sortOpen,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpDown, { className: "size-4 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: sortOptions.find((option) => option.id === sort)?.label ?? "Sort" })]
									}), sortOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute top-12 right-0 z-20 min-w-48 rounded-md bg-elevated p-1 shadow-[var(--shadow-poster)]",
										children: sortOptions.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												setSort(option.id);
												saveSort(kind, option.id);
												setSortOpen(false);
												setZone("sort");
											},
											className: cn("flex h-11 w-full items-center justify-between rounded-sm px-3 text-left text-sm", index === sortCursor || option.id === sort ? "bg-surface text-fg" : "text-muted"),
											children: [option.label, option.id === sort && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 text-accent" })]
										}, option.id))
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: loading ? "Loading library…" : query ? `${items.length} result${items.length === 1 ? "" : "s"}` : `${items.length} in ${selectedName}`
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: parentRef,
					className: "mt-3 min-h-0 flex-1 overflow-auto px-4 pb-8 md:px-6",
					children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "py-16 text-sm text-muted",
						children: "Loading…"
					}) : items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyLibrary, {
						kind,
						searching: Boolean(query)
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative w-full",
						style: { height: virtualizer.getTotalSize() },
						children: virtualItems.map((row) => {
							if (isLive) {
								const ch = items[row.index];
								if (!ch) return null;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute top-0 left-0 w-full pb-2",
									style: { transform: `translateY(${row.start}px)` },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChannelRow, {
										channel: ch,
										epgTitle: epgMap.get(ch.id)?.now?.title,
										tvIndex: row.index,
										tvFocused: zone === "grid" && gridIndex === row.index
									})
								}, row.key);
							}
							const start = row.index * columns;
							const slice = items.slice(start, start + columns);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute top-0 left-0 grid w-full gap-3 pb-4 md:gap-4",
								style: {
									transform: `translateY(${row.start}px)`,
									gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
								},
								children: slice.map((item, offset) => {
									const index = start + offset;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, {
										to: kind === "show" ? "/shows/$showId" : "/watch",
										search: {
											kind: kind === "show" ? "show" : "movie",
											id: item.id
										},
										title: item.name,
										image: "poster" in item ? item.poster : "",
										subtitle: "year" in item ? item.year : void 0,
										tvIndex: index,
										tvFocused: zone === "grid" && gridIndex === index
									}, item.id);
								})
							}, row.key);
						})
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchKeyboard, {
				open: keyboardOpen,
				value: query,
				onChange: setQuery,
				onClose: () => {
					setKeyboardOpen(false);
					focusZone("grid", 0);
				},
				placeholder: searchPlaceholder
			})
		]
	});
}
function CategorySidebar({ kind, allId, tree, selectedId, total, counts, idPrefix, onSelect }) {
	const allLabel = kind === "live" ? "All channels" : kind === "show" ? "All TV shows" : "All movies";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
		className: "cat-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3",
		"aria-label": "Categories",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 pb-2 text-xs font-semibold tracking-widest text-subtle uppercase",
				children: "Browse"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarButton, {
				id: `${idPrefix}-${allId}`,
				catId: allId,
				label: allLabel,
				active: selectedId === allId,
				depth: 0,
				count: total,
				onClick: () => onSelect(allId)
			}),
			tree.map((node) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarBranch, {
				node,
				selectedId,
				counts,
				idPrefix,
				onSelect
			}, node.category.id))
		]
	});
}
function SidebarBranch({ node, selectedId, counts, idPrefix, onSelect }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarButton, {
		id: `${idPrefix}-${node.category.id}`,
		catId: node.category.id,
		label: node.category.name,
		active: selectedId === node.category.id,
		depth: node.depth,
		count: counts.get(node.category.id) ?? 0,
		onClick: () => onSelect(node.category.id)
	}), node.children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarBranch, {
		node: child,
		selectedId,
		counts,
		idPrefix,
		onSelect
	}, child.category.id))] });
}
function SidebarButton({ id, catId, label, active, depth, count, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		id,
		type: "button",
		"data-cat-id": catId,
		"data-tv-zone": "sidebar",
		onClick,
		"aria-current": active ? "true" : void 0,
		className: cn("relative flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors duration-150", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", depth === 1 && "pl-6", depth >= 2 && "pl-9", active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg"),
		children: [
			active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute left-0 h-5 w-0.5 rounded-full bg-accent" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "relative min-w-0 flex-1 truncate",
				children: label
			}),
			typeof count === "number" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-2 text-xs tabular-nums text-subtle",
				children: count
			})
		]
	});
}
function ChannelRow({ channel, epgTitle, tvIndex, tvFocused }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/watch",
		search: {
			kind: "live",
			id: channel.id
		},
		"data-tv-index": tvIndex,
		"data-tv-node": "row",
		tabIndex: tvIndex === void 0 ? void 0 : tvFocused ? 0 : -1,
		className: cn("flex min-h-16 items-center gap-3 rounded-lg bg-surface px-3 py-2 shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150 hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", tvFocused && "tv-focused"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: proxiedImageUrl(channel.logo) || channel.logo,
			alt: "",
			className: "size-10 rounded-sm bg-elevated object-contain",
			loading: "lazy"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block truncate text-sm font-medium",
				children: [channel.number ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mr-2 text-xs tabular-nums text-muted",
					children: channel.number
				}) : null, channel.name]
			}), epgTitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate text-xs text-muted",
				children: epgTitle
			})]
		})]
	});
}
function EmptyLibrary({ kind, searching }) {
	const label = kind === "live" ? "live channels" : kind === "show" ? "TV shows" : "movies";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "py-16 text-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: searching ? `No ${label} match that search.` : `No ${label} in this category.`
		})
	});
}
//#endregion
export { CategoryBrowser as t };
