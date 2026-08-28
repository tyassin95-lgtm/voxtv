import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Check, PanelLeft, X } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { SearchKeyboard } from "@/components/search-keyboard";
import { PosterCard } from "@/components/poster-card";
import { useBackHandler, useRemoteHandler } from "@/components/remote-root";
import { proxiedImageUrl } from "@/lib/iptv/proxy";
import { prefetchVisibleEpg, useEpgMap, useKindLibrary } from "@/lib/iptv/store";
import { rememberBrowseList } from "@/lib/iptv/browse-list";
import type { CatalogSort, Channel, ContentKind } from "@/lib/iptv/types";
import {
  allCategoryId,
  availableSorts,
  buildCategoryTree,
  categoryItemCounts,
  filterCatalogItems,
  flattenCategoryTree,
  loadSort,
  saveSort,
  sortCatalogItems,
  type CategoryNode,
} from "@/lib/iptv/catalog-view";
import { enableTvMode, focusTvIndex, moveGridIndex } from "@/lib/iptv/remote";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";

type Zone = "header" | "sidebar" | "search" | "sort" | "grid" | "sortmenu";

function useColumnCount() {
  const [count, setCount] = useState(3);
  useEffect(() => {
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

function storedCategoryKey(kind: ContentKind) {
  return `vox-iptv-cat-${kind}`;
}

function headerLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("header nav a")];
}

export function CategoryBrowser({
  kind,
  title,
  searchPlaceholder,
}: {
  kind: ContentKind;
  title: string;
  searchPlaceholder: string;
}) {
  const navigate = useNavigate();
  const { categories, items: allItems, loading } = useKindLibrary(kind);
  const [categoryId, setCategoryId] = useState<string>(() => {
    if (typeof sessionStorage === "undefined") return allCategoryId(kind);
    return sessionStorage.getItem(storedCategoryKey(kind)) || allCategoryId(kind);
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>(() => loadSort(kind));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [zone, setZone] = useState<Zone>("grid");
  // The grid highlight only appears once a remote/d-pad is actually in use —
  // on mouse/touch the first tile must not look pre-selected.
  const [tvActive, setTvActive] = useState(false);
  // Which category the d-pad is sitting on. Moving through the list must not
  // reload the grid — only pressing select (or stepping right into it) does.
  const [catCursor, setCatCursor] = useState<string>(categoryId);
  const [gridIndex, setGridIndex] = useState(0);
  const [sortCursor, setSortCursor] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);
  const tvActiveRef = useRef(false);
  tvActiveRef.current = tvActive;
  const columns = useColumnCount();
  const allId = allCategoryId(kind);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(storedCategoryKey(kind), categoryId);
  }, [kind, categoryId]);

  useEffect(() => {
    setCatCursor(categoryId);
  }, [categoryId]);

  useEffect(() => {
    if (loading) return;
    if (categoryId === allId) return;
    if (!categories.some((category) => category.id === categoryId)) setCategoryId(allId);
  }, [loading, categories, categoryId, allId]);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flat = useMemo(() => flattenCategoryTree(tree), [tree]);
  const navIds = useMemo(() => [allId, ...flat.map((node) => node.category.id)], [allId, flat]);
  const counts = useMemo(() => categoryItemCounts(allItems, categories), [allItems, categories]);
  const selected = categories.find((c) => c.id === categoryId);
  const selectedName = categoryId === allId ? "All" : selected?.name || "All";

  const filtered = useMemo(
    () => filterCatalogItems(allItems, categories, query ? allId : categoryId, query),
    [allItems, categories, categoryId, query, allId],
  );
  const items = useMemo(() => sortCatalogItems(filtered, sort, kind), [filtered, sort, kind]);
  const sortOptions = useMemo(() => availableSorts(allItems, kind), [allItems, kind]);

  const isLive = kind === "live";
  const gridColumns = isLive ? 1 : columns;
  const rows = isLive ? items.length : Math.ceil(items.length / columns);
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isLive ? 76 : 280),
    overscan: 8,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
    setGridIndex(0);
  }, [categoryId, query, sort]);

  useEffect(() => {
    setGridIndex((index) => Math.max(0, Math.min(Math.max(items.length - 1, 0), index)));
  }, [items.length]);

  useEffect(() => {
    rememberBrowseList(
      kind,
      items.map((item) => item.id),
    );
  }, [kind, items]);

  const virtualItems = virtualizer.getVirtualItems();
  const visibleIds = isLive
    ? virtualItems
        .map((row) => items[row.index]?.id)
        .filter((id): id is string => Boolean(id))
        .join(",")
    : "";

  const visibleChannels = useMemo(() => {
    if (!isLive || !visibleIds) return [];
    const wanted = new Set(visibleIds.split(","));
    return (items as Channel[]).filter((ch) => wanted.has(ch.id));
  }, [isLive, items, visibleIds]);

  const epgMap = useEpgMap(visibleChannels.map((c) => c.id));

  useEffect(() => {
    if (isLive && visibleChannels.length) prefetchVisibleEpg(visibleChannels);
  }, [isLive, visibleIds]);

  function selectCategory(id: string, opts?: { keepDrawer?: boolean }) {
    setCategoryId(id);
    setCatCursor(id);
    setQuery("");
    if (!opts?.keepDrawer) setDrawerOpen(false);
  }

  function focusCategoryButton(id: string) {
    const drawer = document.getElementById(`drawer-cat-${id}`);
    const desktop = document.getElementById(`cat-${id}`);
    const visibleDrawer = drawer && drawer.getClientRects().length > 0;
    (visibleDrawer ? drawer : desktop)?.focus();
  }

  function focusZone(next: Zone, index = gridIndex) {
    setZone(next);
    if (next === "sidebar") {
      const openBtn = document.querySelector<HTMLElement>("[data-tv-zone='cats']");
      if (openBtn && window.matchMedia("(max-width: 767px)").matches && !drawerOpen) {
        openBtn.focus();
        return;
      }
      focusCategoryButton(catCursor);
      return;
    }
    if (next === "search") {
      document.querySelector<HTMLElement>("[data-tv-zone='search']")?.focus();
      return;
    }
    if (next === "sort" || next === "sortmenu") {
      document.querySelector<HTMLElement>("[data-tv-zone='sort']")?.focus();
      return;
    }
    if (next === "header") {
      const links = headerLinks();
      const active = links.find((link) => link.getAttribute("aria-current") === "page") ?? links[0];
      active?.focus();
      return;
    }
    if (next === "grid") {
      const clamped = Math.max(0, Math.min(Math.max(items.length - 1, 0), index));
      setGridIndex(clamped);
      enableTvMode();
    }
  }

  useEffect(() => {
    if (!tvActive || zone !== "grid" || !items.length) return;
    const row = isLive ? gridIndex : Math.floor(gridIndex / Math.max(columns, 1));
    virtualizer.scrollToIndex(row, { align: "center" });
    const timer = window.setTimeout(() => focusTvIndex(gridIndex), 16);
    return () => window.clearTimeout(timer);
  }, [tvActive, zone, gridIndex, columns, isLive, items.length, virtualizer]);

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
  }, [keyboardOpen, sortOpen, drawerOpen, query, categoryId, allId, navigate]);

  const navState = useRef({
    zone,
    gridIndex,
    categoryId,
    catCursor,
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
    sort,
  });
  navState.current = {
    zone,
    gridIndex,
    categoryId,
    catCursor,
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
    sort,
  };

  useRemoteHandler(
    (event) => {
      const state = navState.current;
      if (state.keyboardOpen) return false;
      const action = event.action;
      if (
        action !== "up" &&
        action !== "down" &&
        action !== "left" &&
        action !== "right" &&
        action !== "select" &&
        action !== "pageup" &&
        action !== "pagedown"
      ) {
        return false;
      }
      enableTvMode();
      const wasActive = tvActiveRef.current;
      tvActiveRef.current = true;
      setTvActive(true);

      const active = document.activeElement as HTMLElement | null;
      let currentZone = state.zone;
      if (active?.dataset.tvIndex !== undefined) currentZone = "grid";
      else if (active?.dataset.tvZone === "search") currentZone = "search";
      else if (active?.dataset.tvZone === "sort") currentZone = "sort";
      else if (active?.dataset.tvZone === "sidebar" || active?.dataset.catId)
        currentZone = "sidebar";
      else if (active?.dataset.tvZone === "cats") currentZone = "sidebar";
      else if (active?.closest("header nav")) currentZone = "header";
      if (currentZone !== state.zone) setZone(currentZone);

      if (state.sortOpen || currentZone === "sortmenu") {
        const last = state.sortOptions.length - 1;
        if (action === "up") setSortCursor((i) => Math.max(0, i - 1));
        else if (action === "down" || action === "pagedown")
          setSortCursor((i) => Math.min(last, i + 1));
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
          setSortCursor(
            Math.max(
              0,
              state.sortOptions.findIndex((option) => option.id === state.sort),
            ),
          );
          setSortOpen(true);
          setZone("sortmenu");
          return true;
        }
        if (currentZone === "sidebar") {
          if (window.matchMedia("(max-width: 767px)").matches && !state.drawerOpen) {
            setDrawerOpen(true);
            return true;
          }
          const cursor =
            (document.activeElement as HTMLElement | null)?.dataset.catId || state.catCursor;
          selectCategory(cursor, { keepDrawer: true });
          focusCategoryButton(cursor);
          return true;
        }
        const focused = document.activeElement as HTMLElement | null;
        if (focused && (focused.tagName === "A" || focused.tagName === "BUTTON")) {
          focused.click();
        }
        return true;
      }

      if (currentZone === "header") {
        const links = headerLinks();
        const current = Math.max(
          0,
          links.findIndex((link) => link === document.activeElement),
        );
        if (action === "left" && current > 0) links[current - 1]?.focus();
        else if (action === "right" && current < links.length - 1) links[current + 1]?.focus();
        else if (action === "down")
          focusZone(state.itemsLength ? "grid" : "sidebar", state.gridIndex);
        return true;
      }

      if (currentZone === "sidebar") {
        const cursor = active?.dataset.catId || state.catCursor;
        if (action === "up" || action === "pageup") {
          const current = state.navIds.indexOf(cursor);
          if (current <= 0) {
            focusZone("header");
            return true;
          }
          const next = state.navIds[current - 1];
          if (next) {
            setCatCursor(next);
            focusCategoryButton(next);
          }
          return true;
        }
        if (action === "down" || action === "pagedown") {
          const current = state.navIds.indexOf(cursor);
          const from = current === -1 ? 0 : current;
          if (from >= state.navIds.length - 1) return true;
          const next = state.navIds[from + 1];
          if (next) {
            setCatCursor(next);
            focusCategoryButton(next);
          }
          return true;
        }
        if (action === "right") {
          // Stepping into the grid is a deliberate "show me this one".
          if (cursor !== state.categoryId) selectCategory(cursor, { keepDrawer: true });
          if (state.drawerOpen) setDrawerOpen(false);
          if (state.itemsLength || cursor !== state.categoryId) focusZone("grid", 0);
          else focusZone("search");
          return true;
        }
        if (action === "left") focusZone("header");
        return true;
      }

      if (currentZone === "search") {
        if (action === "left") focusZone("sidebar");
        else if (action === "right") focusZone("sort");
        else if (action === "down" || action === "pagedown")
          focusZone(state.itemsLength ? "grid" : "sidebar", 0);
        else if (action === "up") focusZone("header");
        return true;
      }

      if (currentZone === "sort") {
        if (action === "left") focusZone("search");
        else if (action === "down" || action === "pagedown")
          focusZone(state.itemsLength ? "grid" : "sidebar", 0);
        else if (action === "up") focusZone("header");
        else if (action === "right") {
          setSortCursor(
            Math.max(
              0,
              state.sortOptions.findIndex((option) => option.id === state.sort),
            ),
          );
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
        if (!wasActive) {
          // Nothing was highlighted yet: land on the current tile rather than
          // stepping past the first row.
          setGridIndex((index) => Math.max(0, Math.min(state.itemsLength - 1, index)));
          return true;
        }
        const fromAttr = active?.dataset.tvIndex;
        const fromIndex =
          fromAttr !== undefined && fromAttr !== "" ? Number(fromAttr) : state.gridIndex;
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
        const dir =
          action === "up" || action === "down" || action === "left" || action === "right"
            ? action
            : null;
        if (dir)
          setGridIndex(
            moveGridIndex(
              Number.isFinite(fromIndex) ? fromIndex : state.gridIndex,
              cols,
              state.itemsLength,
              dir,
            ),
          );
        return true;
      }

      return false;
    },
    [kind],
  );

  const sidebarProps = {
    kind,
    allId,
    tree,
    selectedId: query ? "" : categoryId,
    total: allItems.length,
    counts,
    onSelect: (id: string) => {
      selectCategory(id);
      setZone("sidebar");
    },
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-bg md:flex">
        <CategorySidebar {...sidebarProps} idPrefix="cat" />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-overlay"
            aria-label="Close categories"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-full flex-col bg-surface shadow-[var(--shadow-poster)]">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <p className="text-sm font-medium">Categories</p>
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
                aria-label="Close categories"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <CategorySidebar {...sidebarProps} idPrefix="drawer-cat" />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col gap-4 px-4 pt-5 md:px-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              data-tv-zone="cats"
              className="flex h-11 min-w-0 items-center gap-2 rounded-md bg-elevated px-3 text-sm font-medium shadow-[var(--shadow-border)] focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open categories"
            >
              <PanelLeft className="size-4 shrink-0 text-muted" />
              <span className="truncate">{selectedName}</span>
            </button>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder={searchPlaceholder}
              className="max-w-none flex-1"
              onActivate={() => {
                setZone("search");
                setKeyboardOpen(true);
              }}
              active={keyboardOpen || zone === "search"}
            />
            <div className="relative">
              <button
                type="button"
                data-tv-zone="sort"
                onClick={() => {
                  setSortCursor(
                    Math.max(
                      0,
                      sortOptions.findIndex((option) => option.id === sort),
                    ),
                  );
                  setSortOpen((open) => !open);
                  setZone("sortmenu");
                }}
                className={cn(
                  "relative flex h-11 min-w-36 items-center gap-2 rounded-md bg-elevated px-3 text-sm shadow-[var(--shadow-border)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  (zone === "sort" || sortOpen) && "ring-2 ring-accent",
                )}
                aria-label="Sort titles"
                aria-expanded={sortOpen}
              >
                <ArrowUpDown className="size-4 text-muted" />
                <span>{sortOptions.find((option) => option.id === sort)?.label ?? "Sort"}</span>
              </button>
              {sortOpen && (
                <div className="absolute top-12 right-0 z-20 min-w-48 rounded-md bg-elevated p-1 shadow-[var(--shadow-poster)]">
                  {sortOptions.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSort(option.id);
                        saveSort(kind, option.id);
                        setSortOpen(false);
                        setZone("sort");
                      }}
                      className={cn(
                        "flex h-11 w-full items-center justify-between rounded-sm px-3 text-left text-sm",
                        index === sortCursor || option.id === sort
                          ? "bg-surface text-fg"
                          : "text-muted",
                      )}
                    >
                      {option.label}
                      {option.id === sort && <Check className="size-4 text-accent" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-muted">
            {loading
              ? "Loading library…"
              : query
                ? `${items.length} result${items.length === 1 ? "" : "s"}`
                : `${items.length} in ${selectedName}`}
          </p>
        </div>

        <div ref={parentRef} className="mt-3 min-h-0 flex-1 overflow-auto px-4 pb-8 md:px-6">
          {loading ? (
            <p className="py-16 text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyLibrary kind={kind} searching={Boolean(query)} />
          ) : (
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((row) => {
                if (isLive) {
                  const ch = items[row.index] as Channel | undefined;
                  if (!ch) return null;
                  return (
                    <div
                      key={row.key}
                      className="absolute top-0 left-0 w-full pb-2"
                      style={{ transform: `translateY(${row.start}px)` }}
                    >
                      <ChannelRow
                        channel={ch}
                        epgTitle={epgMap.get(ch.id)?.now?.title}
                        tvIndex={row.index}
                        tvFocused={tvActive && zone === "grid" && gridIndex === row.index}
                      />
                    </div>
                  );
                }
                const start = row.index * columns;
                const slice = items.slice(start, start + columns);
                return (
                  <div
                    key={row.key}
                    className="absolute top-0 left-0 grid w-full gap-3 pb-4 md:gap-4"
                    style={{
                      transform: `translateY(${row.start}px)`,
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {slice.map((item, offset) => {
                      const index = start + offset;
                      return (
                        <PosterCard
                          key={item.id}
                          to={kind === "show" ? "/shows/$showId" : "/watch"}
                          search={{ kind: kind === "show" ? "show" : "movie", id: item.id }}
                          title={item.name}
                          image={"poster" in item ? item.poster : ""}
                          subtitle={"year" in item ? item.year : undefined}
                          tvIndex={index}
                          tvFocused={tvActive && zone === "grid" && gridIndex === index}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SearchKeyboard
        open={keyboardOpen}
        value={query}
        onChange={setQuery}
        onClose={() => {
          setKeyboardOpen(false);
          focusZone("grid", 0);
        }}
        placeholder={searchPlaceholder}
      />
    </div>
  );
}

function CategorySidebar({
  kind,
  allId,
  tree,
  selectedId,
  total,
  counts,
  idPrefix,
  onSelect,
}: {
  kind: ContentKind;
  allId: string;
  tree: CategoryNode[];
  selectedId: string;
  total: number;
  counts: Map<string, number>;
  idPrefix: string;
  onSelect: (id: string) => void;
}) {
  const allLabel =
    kind === "live" ? "All channels" : kind === "show" ? "All TV shows" : "All movies";
  return (
    <nav className="cat-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Categories">
      <p className="px-3 pb-2 text-xs font-semibold tracking-widest text-subtle uppercase">
        Browse
      </p>
      <SidebarButton
        id={`${idPrefix}-${allId}`}
        catId={allId}
        label={allLabel}
        active={selectedId === allId}
        depth={0}
        count={total}
        onClick={() => onSelect(allId)}
      />
      {tree.map((node) => (
        <SidebarBranch
          key={node.category.id}
          node={node}
          selectedId={selectedId}
          counts={counts}
          idPrefix={idPrefix}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}

function SidebarBranch({
  node,
  selectedId,
  counts,
  idPrefix,
  onSelect,
}: {
  node: CategoryNode;
  selectedId: string;
  counts: Map<string, number>;
  idPrefix: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <SidebarButton
        id={`${idPrefix}-${node.category.id}`}
        catId={node.category.id}
        label={node.category.name}
        active={selectedId === node.category.id}
        depth={node.depth}
        count={counts.get(node.category.id) ?? 0}
        onClick={() => onSelect(node.category.id)}
      />
      {node.children.map((child) => (
        <SidebarBranch
          key={child.category.id}
          node={child}
          selectedId={selectedId}
          counts={counts}
          idPrefix={idPrefix}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function SidebarButton({
  id,
  catId,
  label,
  active,
  depth,
  count,
  onClick,
}: {
  id: string;
  catId: string;
  label: string;
  active: boolean;
  depth: number;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      data-cat-id={catId}
      data-tv-zone="sidebar"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        depth === 1 && "pl-6",
        depth >= 2 && "pl-9",
        active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
      )}
    >
      {active && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-accent" />}
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className="ml-2 text-xs tabular-nums text-subtle">{count}</span>
      )}
    </button>
  );
}

function ChannelRow({
  channel,
  epgTitle,
  tvIndex,
  tvFocused,
}: {
  channel: Channel;
  epgTitle?: string;
  tvIndex?: number;
  tvFocused?: boolean;
}) {
  return (
    <Link
      to="/watch"
      search={{ kind: "live", id: channel.id }}
      data-tv-index={tvIndex}
      data-tv-node="row"
      tabIndex={tvIndex === undefined ? undefined : tvFocused ? 0 : -1}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-lg bg-surface px-3 py-2 shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150 hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        tvFocused && "tv-focused",
      )}
    >
      <img
        src={proxiedImageUrl(channel.logo) || channel.logo}
        alt=""
        className="size-10 rounded-sm bg-elevated object-contain"
        loading="lazy"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {channel.number ? (
            <span className="mr-2 text-xs tabular-nums text-muted">{channel.number}</span>
          ) : null}
          {channel.name}
        </span>
        {epgTitle && <span className="block truncate text-xs text-muted">{epgTitle}</span>}
      </span>
    </Link>
  );
}

function EmptyLibrary({ kind, searching }: { kind: ContentKind; searching: boolean }) {
  const label = kind === "live" ? "live channels" : kind === "show" ? "TV shows" : "movies";
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted">
        {searching ? `No ${label} match that search.` : `No ${label} in this category.`}
      </p>
    </div>
  );
}
