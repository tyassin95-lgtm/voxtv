import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startXtreamMock } from "../../../scripts/xtream-mock.mjs";
import { fetchSeriesEpisodes, fetchXtreamCatalog } from "./xtream.ts";
import { expandCategoryIds } from "./xtream-parse.ts";
import { liveStreamUrlVariants, vodStreamUrlVariants } from "./playback-urls.ts";

type Mock = Awaited<ReturnType<typeof startXtreamMock>>;

function installFetchProxy() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/iptv/fetch")) {
      const target = new URL(url, "http://local.invalid").searchParams.get("u");
      if (!target) throw new Error("missing u");
      return original(target, init);
    }
    return original(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("xtream catalog against provider quirks", () => {
  let mock: Mock;
  let restore: () => void;

  before(async () => {
    restore = installFetchProxy();
    mock = await startXtreamMock(0);
  });

  after(async () => {
    restore();
    await mock.close();
  });

  it("fills every category that the bulk list omitted", async () => {
    const catalog = await fetchXtreamCatalog({
      baseUrl: mock.origin,
      username: mock.username,
      password: mock.password,
    });

    assert.ok(catalog.channels.length >= 3, `channels=${catalog.channels.length}`);
    assert.ok(catalog.movies.length >= 4, `movies=${catalog.movies.length}`);
    assert.ok(catalog.shows.length >= 2, `shows=${catalog.shows.length}`);

    const liveCats = catalog.categories.filter((c) => c.kind === "live");
    const movieCats = catalog.categories.filter((c) => c.kind === "movie");
    const showCats = catalog.categories.filter((c) => c.kind === "show");

    for (const category of liveCats) {
      const ids = expandCategoryIds(liveCats, category.id);
      const count = catalog.channels.filter((item) =>
        ids.some((id) => (item.categoryIds ?? [item.categoryId]).includes(id)),
      ).length;
      assert.ok(count > 0, `empty live category ${category.id} ${category.name}`);
    }
    for (const category of movieCats) {
      const ids = expandCategoryIds(movieCats, category.id);
      const count = catalog.movies.filter((item) =>
        ids.some((id) => (item.categoryIds ?? [item.categoryId]).includes(id)),
      ).length;
      assert.ok(count > 0, `empty movie category ${category.id} ${category.name}`);
    }
    for (const category of showCats) {
      const ids = expandCategoryIds(showCats, category.id);
      const count = catalog.shows.filter((item) =>
        ids.some((id) => (item.categoryIds ?? [item.categoryId]).includes(id)),
      ).length;
      assert.ok(count > 0, `empty show category ${category.id} ${category.name}`);
    }

    const tennis = catalog.channels.find((ch) => ch.name === "Tennis Court");
    assert.ok(tennis);
    assert.ok(tennis.categoryIds?.includes("live:11"));

    const drama = catalog.movies.find((movie) => movie.name === "Quiet Town");
    assert.ok(drama);
    assert.ok(drama.categoryIds?.includes("movie:21"));

    const stray = catalog.movies.find((movie) => movie.name === "Stray Bullet");
    assert.ok(stray, "stray movie missing from catalog");
    assert.ok(stray.categoryIds?.includes("movie:20"), `stray cats=${stray.categoryIds}`);
    assert.ok(!stray.categoryIds?.includes("movie:uncat"));

    const alias = catalog.movies.find((movie) => movie.name === "Alias Action");
    assert.ok(alias, "name-as-id movie missing from catalog");
    assert.ok(alias.categoryIds?.includes("movie:20"), `alias cats=${alias.categoryIds}`);

    const searchable = catalog.movies.filter((movie) => movie.nameLower.includes("stray"));
    const actionBrowse = catalog.movies.filter((movie) =>
      (movie.categoryIds ?? [movie.categoryId]).includes("movie:20"),
    );
    assert.ok(searchable.every((movie) => actionBrowse.some((row) => row.id === movie.id)));

    const hidden = catalog.shows.find((show) => show.name === "Only Per Category");
    assert.ok(hidden);
    assert.ok(hidden.categoryIds?.includes("show:31"));

    const harbor = catalog.shows.find((show) => show.name === "Harbor Lights");
    assert.ok(harbor);
    const episodes = await fetchSeriesEpisodes(
      { type: "xtream", name: "t", addedAt: 0, xtream: { baseUrl: mock.origin, username: mock.username, password: mock.password } },
      harbor,
    );
    assert.equal(episodes.length, 1);
    assert.match(episodes[0]!.url, /\/series\//);
  });

  it("builds playable live/movie/series urls against the mock", async () => {
    const creds = { baseUrl: mock.origin, username: mock.username, password: mock.password };
    const live = liveStreamUrlVariants(creds, 101);
    const movie = vodStreamUrlVariants(creds, "movie", 501, "mp4");
    const episode = vodStreamUrlVariants(creds, "series", 901, "mp4");
    const original = globalThis.fetch;

    async function ok(url: string) {
      const res = await original(url);
      assert.equal(res.status, 200, `${url} -> ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      assert.ok(buf.length > 100, `tiny body for ${url}`);
    }

    await ok(live.find((url) => url.endsWith(".m3u8"))!);
    await ok(live.find((url) => url.endsWith(".ts"))!);
    await ok(movie[0]!);
    await ok(episode[0]!);
  });
});
