import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asList,
  collectCategoryIds,
  expandCategoryIds,
  leafCategoryIds,
  normalizeEpisodeGroups,
  normalizeId,
  parseJsonPayload,
  parentCategoryId,
  pickExt,
  pickStreamId,
  prefixedCategoryIds,
  resolveCategoryIds,
  resolveStreamBase,
} from "./xtream-parse.ts";

describe("asList", () => {
  it("returns arrays unchanged", () => {
    assert.deepEqual(asList([{ a: 1 }]), [{ a: 1 }]);
  });
  it("unwraps common Xtream wrappers", () => {
    assert.equal(asList({ streams: [{ id: 1 }, { id: 2 }] }).length, 2);
  });
  it("unwraps XUI js wrappers", () => {
    assert.equal(asList({ js: [{ id: 1 }, { id: 2 }] }).length, 2);
    assert.equal(asList({ js: { "0": { id: 1 }, "1": { id: 2 } } }).length, 2);
  });
  it("converts numeric-keyed objects", () => {
    const rows = asList({ "0": { stream_id: 1 }, "1": { stream_id: 2 }, user_info: { auth: 1 } });
    assert.equal(rows.length, 2);
  });
  it("treats empty objects as empty lists", () => {
    assert.deepEqual(asList({}), []);
  });
});

describe("category ids", () => {
  it("keeps numeric zero as a real id", () => {
    assert.equal(normalizeId(0), "0");
    assert.equal(normalizeId("0"), "0");
  });
  it("collapses leading zeros on numeric ids", () => {
    assert.equal(normalizeId("01"), "1");
    assert.equal(normalizeId("10"), "10");
  });
  it("reads category_id, category_ids, and comma lists", () => {
    assert.deepEqual(collectCategoryIds({ category_id: 12 }), ["12"]);
    assert.deepEqual(collectCategoryIds({ category_id: null, category_ids: [3, "4"] }), ["3", "4"]);
    assert.deepEqual(collectCategoryIds({ category_id: "1,2|3" }), ["1", "2", "3"]);
    assert.deepEqual(collectCategoryIds({ cat_id: "08" }), ["8"]);
  });
  it("prefixes without dropping string/number mismatches", () => {
    assert.deepEqual(prefixedCategoryIds("live", ["5", 5 as unknown as string]), ["live:5"]);
    assert.deepEqual(prefixedCategoryIds("live", ["01"]), ["live:1"]);
  });
  it("ignores parent_id 0", () => {
    assert.equal(parentCategoryId("live", 0), undefined);
    assert.equal(parentCategoryId("live", "8"), "live:8");
  });
  it("expands parent categories to include children", () => {
    const cats = [
      { id: "live:1", kind: "live" as const, name: "Sports" },
      { id: "live:10", kind: "live" as const, name: "Football", parentId: "live:1" },
      { id: "live:11", kind: "live" as const, name: "Tennis", parentId: "live:1" },
    ];
    assert.deepEqual(expandCategoryIds(cats, "live:1").sort(), ["live:1", "live:10", "live:11"]);
    assert.deepEqual([...leafCategoryIds(cats)].sort(), ["live:10", "live:11"]);
  });
  it("treats every category as a leaf when parent pointers are cyclic", () => {
    const cats = [
      { id: "live:1", parentId: "live:2" },
      { id: "live:2", parentId: "live:1" },
    ];
    assert.deepEqual([...leafCategoryIds(cats)].sort(), ["live:1", "live:2"]);
  });
  it("resolves numeric ids, name-as-id, genre names, and forced category", () => {
    const cats = [
      { id: "movie:20", kind: "movie" as const, name: "Action" },
      { id: "movie:21", kind: "movie" as const, name: "Drama" },
    ];
    assert.deepEqual(resolveCategoryIds("movie", { category_id: 20 }, cats), ["movie:20"]);
    assert.deepEqual(resolveCategoryIds("movie", { category_id: "Action" }, cats), ["movie:20"]);
    assert.deepEqual(resolveCategoryIds("movie", { genre: "Drama" }, cats), ["movie:21"]);
    assert.deepEqual(resolveCategoryIds("movie", { category_ids: ["Action", "21"] }, cats), [
      "movie:20",
      "movie:21",
    ]);
    assert.deepEqual(resolveCategoryIds("movie", {}, cats, "20"), ["movie:20"]);
    assert.deepEqual(resolveCategoryIds("movie", { name: "orphan" }, cats), ["movie:uncat"]);
  });
});

describe("stream fields", () => {
  it("picks stream_id or id", () => {
    assert.equal(pickStreamId({ stream_id: 99 }, "stream_id", "id"), "99");
    assert.equal(pickStreamId({ id: "abc" }, "stream_id", "id"), "abc");
  });
  it("reads container extension from several keys", () => {
    assert.equal(pickExt({ container_extension: "MKV" }), "mkv");
    assert.equal(pickExt({ info: { extension: ".ts" } }), "ts");
  });
});

describe("episodes", () => {
  it("reads object-of-arrays seasons", () => {
    const groups = normalizeEpisodeGroups({
      "1": [{ id: "1", episode_num: 1 }],
      "2": [{ id: "2", episode_num: 1 }],
    });
    assert.equal(groups.length, 2);
    assert.equal(groups[1]?.season, 2);
  });
  it("reads object-of-objects seasons", () => {
    const groups = normalizeEpisodeGroups({
      "1": { "0": { id: "10", episode_num: 1 }, "1": { id: "11", episode_num: 2 } },
    });
    assert.equal(groups[0]?.episodes.length, 2);
  });
});

describe("payloads", () => {
  it("strips PHP warnings before JSON", () => {
    const data = parseJsonPayload("Warning: something\n[{ \"category_id\": 1 }]");
    assert.equal((data as { category_id: number }[])[0]?.category_id, 1);
  });
  it("builds stream host from server_info", () => {
    assert.equal(
      resolveStreamBase("http://portal.example:80", {
        url: "cdn.example.com",
        port: "8080",
        server_protocol: "http",
      }),
      "http://cdn.example.com:8080",
    );
  });
});
