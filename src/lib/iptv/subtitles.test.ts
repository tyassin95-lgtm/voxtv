import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSearchPath,
  decodeSubtitleBytes,
  looksGzipped,
  normalizeQuery,
  parseSearchResults,
  cleanCueText,
  srtToVtt,
} from "./opensubtitles.ts";
import { subtitleQueryFor } from "./subtitles.ts";

describe("opensubtitles queries", () => {
  it("strips release noise from titles", () => {
    assert.equal(normalizeQuery("The.Matrix.1999.1080p.WEB-DL.x264"), "The Matrix 1999");
    assert.equal(normalizeQuery("  Dune  "), "Dune");
  });

  it("builds alphabetically ordered rest paths", () => {
    assert.equal(
      buildSearchPath({ query: "the office", langs: ["eng", "ara"], season: 2, episode: 5 }),
      "https://rest.opensubtitles.org/search/episode-5/query-the%20office/season-2/sublanguageid-eng,ara",
    );
    assert.equal(
      buildSearchPath({ query: "dune", langs: ["ara"] }),
      "https://rest.opensubtitles.org/search/query-dune/sublanguageid-ara",
    );
  });

  it("keeps only english and arabic srt results, best downloads first", () => {
    const hits = parseSearchResults(
      [
        {
          IDSubtitleFile: "1",
          SubLanguageID: "eng",
          SubFormat: "srt",
          SubDownloadsCnt: "10",
          SubFileName: "a",
        },
        { IDSubtitleFile: "2", SubLanguageID: "fre", SubFormat: "srt", SubDownloadsCnt: "999" },
        { IDSubtitleFile: "3", SubLanguageID: "eng", SubFormat: "sub", SubDownloadsCnt: "999" },
        {
          IDSubtitleFile: "4",
          SubLanguageID: "ara",
          SubFormat: "srt",
          SubDownloadsCnt: "50",
          SubFileName: "b",
        },
        {
          IDSubtitleFile: "5",
          SubLanguageID: "eng",
          SubFormat: "srt",
          SubDownloadsCnt: "80",
          SubFileName: "c",
        },
      ],
      ["eng", "ara"],
    );
    assert.deepEqual(
      hits.map((hit) => hit.id),
      ["5", "4", "1"],
    );
    assert.equal(hits[0]?.langLabel, "English");
  });

  it("ignores non-array payloads", () => {
    assert.deepEqual(parseSearchResults({ status: "error" }, ["eng"]), []);
  });
});

describe("srtToVtt", () => {
  it("converts subrip cues", () => {
    const srt =
      "1\r\n00:00:01,500 --> 00:00:03,000\r\nHello\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nBye\r\n";
    assert.equal(
      srtToVtt(srt),
      "WEBVTT\n\n00:00:01.500 --> 00:00:03.000\nHello\n\n00:00:04.000 --> 00:00:05.000\nBye\n",
    );
  });

  it("passes webvtt through and drops junk blocks", () => {
    const vtt = "WEBVTT\n\nNOTE nothing\n\n00:00:01.000 --> 00:00:02.000\nHi\n";
    assert.equal(srtToVtt(vtt), "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n");
  });
});

describe("cue cleanup", () => {
  it("drops ass override blocks and font tags but keeps italics", () => {
    assert.equal(
      cleanCueText('{\\an8}<font face="Sakkal Majalla">\u0645\u0631\u062d\u0628\u0627</font>'),
      "\u0645\u0631\u062d\u0628\u0627",
    );
    assert.equal(cleanCueText("<i>Hello</i>"), "<i>Hello</i>");
  });
});

describe("subtitle payload decoding", () => {
  it("detects gzip magic bytes", () => {
    assert.equal(looksGzipped(new Uint8Array([0x1f, 0x8b, 0x08])), true);
    assert.equal(looksGzipped(new Uint8Array([0x31, 0x0a, 0x30])), false);
  });

  it("falls back to windows-1256 for arabic files", () => {
    // 0xC7 0xE1 is "ال" in windows-1256 and invalid UTF-8.
    assert.equal(decodeSubtitleBytes(new Uint8Array([0xc7, 0xe1]), "ara"), "ال");
    assert.equal(decodeSubtitleBytes(new TextEncoder().encode("مرحبا"), "ara"), "مرحبا");
  });
});

describe("subtitleQueryFor", () => {
  it("uses the show title with season and episode numbers", () => {
    assert.deepEqual(
      subtitleQueryFor({ kind: "episode", title: "The Office", subtitle: "S2 · E5  The Fire" }),
      { query: "The Office", langs: ["eng"], season: 2, episode: 5 },
    );
  });

  it("falls back to the plain title for movies", () => {
    assert.deepEqual(subtitleQueryFor({ kind: "movie", title: "Dune", subtitle: "2021" }), {
      query: "Dune",
      langs: ["eng"],
    });
  });
});
