import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Category, Movie } from "./types.ts";
import {
  availableSorts,
  buildCategoryTree,
  categoryItemCounts,
  ensureOrphanCategories,
  filterCatalogItems,
  itemBelongsToCategory,
  sortCatalogItems,
} from "./catalog-view.ts";

function movie(
  id: string,
  name: string,
  categoryIds: string[],
  extra: Partial<Movie> = {},
): Movie {
  return {
    id,
    name,
    nameLower: name.toLowerCase(),
    poster: "",
    categoryId: categoryIds[0] || "movie:uncat",
    categoryIds,
    url: "",
    ...extra,
  };
}

const categories: Category[] = [
  { id: "movie:20", kind: "movie", name: "Action", sortOrder: 0 },
  { id: "movie:21", kind: "movie", name: "Drama", sortOrder: 1 },
  { id: "live:1", kind: "live", name: "Sports", sortOrder: 0 },
  { id: "live:10", kind: "live", name: "Football", parentId: "live:1", sortOrder: 1 },
  { id: "live:11", kind: "live", name: "Tennis", parentId: "live:1", sortOrder: 2 },
];

describe("catalog view mapping", () => {
  it("keeps search and category browse on the same items", () => {
    const items = [
      movie("movie:1", "Night Drive", ["movie:20"], { year: "2024", added: 100, sortOrder: 1 }),
      movie("movie:2", "Quiet Town", ["movie:21"], { year: "2023", added: 200, sortOrder: 2 }),
      movie("movie:3", "Stray Bullet", ["movie:20"], { year: "2024", added: 150, sortOrder: 3 }),
    ];
    const searched = filterCatalogItems(items, categories, "movie:21", "stray");
    assert.equal(searched.length, 1);
    assert.equal(searched[0]?.name, "Stray Bullet");
    const action = filterCatalogItems(items, categories, "movie:20", "");
    assert.deepEqual(
      action.map((row) => row.name).sort(),
      ["Night Drive", "Stray Bullet"],
    );
    const drama = filterCatalogItems(items, categories, "movie:21", "");
    assert.deepEqual(
      drama.map((row) => row.name),
      ["Quiet Town"],
    );
  });

  it("includes child titles when browsing a parent category", () => {
    const items = [
      movie("live:101", "Football One", ["live:10", "live:1"]),
      movie("live:111", "Tennis Court", ["live:11"]),
      movie("live:201", "World News", ["live:2"]),
    ];
    const liveCats = categories.filter((c) => c.kind === "live");
    assert.equal(itemBelongsToCategory(items[0]!, "live:1", liveCats), true);
    assert.equal(itemBelongsToCategory(items[1]!, "live:1", liveCats), true);
    assert.equal(itemBelongsToCategory(items[1]!, "live:10", liveCats), false);
    const sports = filterCatalogItems(items, liveCats, "live:1", "");
    assert.deepEqual(
      sports.map((row) => row.name).sort(),
      ["Football One", "Tennis Court"],
    );
  });

  it("sorts by provider order, name, year, and added without mutating source", () => {
    const items = [
      movie("movie:1", "Night Drive", ["movie:20"], { year: "2024", added: 100, sortOrder: 2 }),
      movie("movie:2", "Quiet Town", ["movie:21"], { year: "2023", added: 300, sortOrder: 1 }),
      movie("movie:3", "Alpha", ["movie:20"], { year: "2020", added: 200, sortOrder: 3 }),
    ];
    const frozen = items.map((row) => row.id);
    assert.deepEqual(
      sortCatalogItems(items, "provider", "movie").map((row) => row.name),
      ["Quiet Town", "Night Drive", "Alpha"],
    );
    assert.deepEqual(
      sortCatalogItems(items, "az", "movie").map((row) => row.name),
      ["Alpha", "Night Drive", "Quiet Town"],
    );
    assert.deepEqual(
      sortCatalogItems(items, "za", "movie").map((row) => row.name),
      ["Quiet Town", "Night Drive", "Alpha"],
    );
    assert.deepEqual(
      sortCatalogItems(items, "year", "movie").map((row) => row.name),
      ["Night Drive", "Quiet Town", "Alpha"],
    );
    assert.deepEqual(
      sortCatalogItems(items, "added", "movie").map((row) => row.name),
      ["Quiet Town", "Alpha", "Night Drive"],
    );
    assert.deepEqual(
      items.map((row) => row.id),
      frozen,
    );
  });

  it("builds provider-order trees and counts parent plus children", () => {
    const liveCats = categories.filter((c) => c.kind === "live");
    const tree = buildCategoryTree(liveCats);
    assert.equal(tree[0]?.category.name, "Sports");
    assert.deepEqual(
      tree[0]?.children.map((child) => child.category.name),
      ["Football", "Tennis"],
    );
    const items = [
      movie("live:101", "Football One", ["live:10"]),
      movie("live:111", "Tennis Court", ["live:11"]),
    ];
    const counts = categoryItemCounts(items, liveCats);
    assert.equal(counts.get("live:1"), 2);
    assert.equal(counts.get("live:10"), 1);
    assert.equal(counts.get("live:11"), 1);
  });

  it("adds an uncategorized bucket for items with no provider category", () => {
    const items = [movie("movie:9", "Lost Reel", ["movie:uncat"])];
    const next = ensureOrphanCategories("movie", [{ id: "movie:20", kind: "movie", name: "Action" }], items);
    assert.ok(next.some((category) => category.id === "movie:uncat"));
  });

  it("always offers recently added plus a-z sorts", () => {
    const labels = availableSorts([], "movie").map((option) => option.id);
    assert.deepEqual(labels, ["provider", "added", "az", "za"]);
    const withYear = availableSorts(
      [movie("movie:1", "X", ["movie:20"], { year: "2024" })],
      "movie",
    ).map((option) => option.id);
    assert.ok(withYear.includes("year"));
  });
});
