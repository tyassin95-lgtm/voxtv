import type { CatalogSort, Category, Channel, ContentKind, Movie, Show } from "./types.ts";
import { expandCategoryIds, fallbackCategoryId } from "./xtream-parse.ts";

export type CatalogItem = Channel | Movie | Show;

export const ALL_CATEGORY: Record<ContentKind, string> = {
  live: "live:all",
  movie: "movie:all",
  show: "show:all",
};

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
  depth: number;
}

export function allCategoryId(kind: ContentKind): string {
  return ALL_CATEGORY[kind];
}

export function isAllCategory(id: string | null | undefined): boolean {
  return id === "live:all" || id === "movie:all" || id === "show:all";
}

export function itemCategorySet(item: CatalogItem): Set<string> {
  return new Set<string>([item.categoryId, ...(item.categoryIds ?? [])]);
}

export function itemBelongsToCategory(
  item: CatalogItem,
  categoryId: string,
  categories: Category[],
): boolean {
  if (isAllCategory(categoryId)) return true;
  const tree = expandCategoryIds(categories, categoryId);
  const owned = itemCategorySet(item);
  return tree.some((id) => owned.has(id));
}

export function filterCatalogItems(
  items: CatalogItem[],
  categories: Category[],
  categoryId: string | null,
  query: string,
): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (q) {
    return items.filter((item) => item.nameLower.includes(q) || item.name.toLowerCase().includes(q));
  }
  if (!categoryId || isAllCategory(categoryId)) return items;
  return items.filter((item) => itemBelongsToCategory(item, categoryId, categories));
}

function yearValue(item: CatalogItem): number {
  if (!("year" in item) || !item.year) return 0;
  const n = Number(String(item.year).slice(0, 4));
  return Number.isFinite(n) ? n : 0;
}

function addedValue(item: CatalogItem): number {
  return "added" in item && typeof item.added === "number" ? item.added : 0;
}

function providerValue(item: CatalogItem): number {
  if ("number" in item && typeof item.number === "number" && item.number > 0) return item.number;
  if (typeof item.sortOrder === "number") return item.sortOrder;
  return Number.MAX_SAFE_INTEGER;
}

export function sortCatalogItems(items: CatalogItem[], sort: CatalogSort, kind: ContentKind): CatalogItem[] {
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

export function availableSorts(items: CatalogItem[], kind: ContentKind): { id: CatalogSort; label: string }[] {
  const options: { id: CatalogSort; label: string }[] = [
    { id: "provider", label: kind === "live" ? "Channel order" : "Provider order" },
    { id: "added", label: kind === "show" ? "Recently updated" : "Recently added" },
    { id: "az", label: "A–Z" },
    { id: "za", label: "Z–A" },
  ];
  if (kind !== "live" && items.some((item) => yearValue(item) > 0)) {
    options.push({ id: "year", label: "Release year" });
  }
  return options;
}

function compareOrder(a: Category, b: Category): number {
  const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name);
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | undefined, Category[]>();
  const ids = new Set(categories.map((c) => c.id));
  for (const category of categories) {
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : undefined;
    const list = byParent.get(parent) ?? [];
    list.push(category);
    byParent.set(parent, list);
  }
  for (const list of byParent.values()) list.sort(compareOrder);

  const walk = (parentId: string | undefined, depth: number): CategoryNode[] => {
    return (byParent.get(parentId) ?? []).map((category) => ({
      category,
      depth,
      children: walk(category.id, depth + 1),
    }));
  };
  return walk(undefined, 0);
}

export function flattenCategoryTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (list: CategoryNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function categoryItemCounts(items: CatalogItem[], categories: Category[]): Map<string, number> {
  const parent = new Map<string, string | undefined>();
  for (const category of categories) parent.set(category.id, category.parentId);
  const counts = new Map<string, number>();
  const bump = (id: string | undefined, seen: Set<string>) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    bump(parent.get(id), seen);
  };
  for (const item of items) {
    const seen = new Set<string>();
    for (const id of itemCategorySet(item)) bump(id, seen);
  }
  return counts;
}

export function ensureOrphanCategories(
  kind: ContentKind,
  categories: Category[],
  items: CatalogItem[],
): Category[] {
  const known = new Set(categories.map((c) => c.id));
  const extras: Category[] = [];
  const fallback = fallbackCategoryId(kind);
  for (const item of items) {
    for (const id of itemCategorySet(item)) {
      if (known.has(id) || isAllCategory(id)) continue;
      known.add(id);
      const raw = id.replace(/^(live|movie|show):/, "");
      extras.push({
        id,
        kind,
        name: raw === "uncat" ? "Uncategorized" : `Category ${raw}`,
        sortOrder: 10_000 + extras.length,
      });
    }
  }
  if (items.some((item) => itemCategorySet(item).has(fallback)) && !known.has(fallback)) {
    extras.push({ id: fallback, kind, name: "Uncategorized", sortOrder: 20_000 });
  }
  return extras.length ? [...categories, ...extras] : categories;
}

const SORT_LS = "vox-iptv-sort";

export function loadSort(kind: ContentKind): CatalogSort {
  if (typeof localStorage === "undefined") return "provider";
  const raw = localStorage.getItem(`${SORT_LS}-${kind}`);
  if (raw === "provider" || raw === "az" || raw === "za" || raw === "added" || raw === "year") return raw;
  return "provider";
}

export function saveSort(kind: ContentKind, sort: CatalogSort) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${SORT_LS}-${kind}`, sort);
}
