import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playbackCandidates } from "./playback.ts";
import { credentialPathPairs, looksHls, pickEngine, streamUrlVariants } from "./playback-urls.ts";
import { engineForKind } from "./stream-detect.ts";

describe("engine detection", () => {
  it("does not treat every /live/ url as HLS", () => {
    assert.equal(looksHls("http://host/live/user/pass/1.ts"), false);
    assert.equal(pickEngine("http://host/live/user/pass/1.ts"), "mpegts");
    assert.equal(pickEngine("http://host/live/user/pass/1.m3u8"), "hls");
    assert.equal(pickEngine("http://host/movie/user/pass/9.mp4"), "native");
  });
  it("maps probed kinds onto engines", () => {
    assert.equal(engineForKind("ts"), "mpegts");
    assert.equal(engineForKind("hls"), "hls");
    assert.equal(engineForKind("mp4"), "native");
  });
});

describe("url variants", () => {
  it("adds ts and extensionless live fallbacks", () => {
    const variants = streamUrlVariants("http://host/live/u/p/12.m3u8");
    assert.ok(variants.includes("http://host/live/u/p/12.m3u8"));
    assert.ok(variants.includes("http://host/live/u/p/12.ts"));
    assert.ok(variants.includes("http://host/live/u/p/12"));
    assert.ok(variants.includes("http://host/u/p/12"));
  });
  it("encodes plus signs in credentials", () => {
    const pairs = credentialPathPairs("demo", "secret+1");
    assert.ok(pairs.some(([, pass]) => pass === "secret%2B1"));
    assert.ok(pairs.some(([, pass]) => pass === "secret+1"));
  });
  it("tries mpegts before hls for live m3u8 urls", () => {
    const candidates = playbackCandidates("http://host/live/u/p/12.m3u8", "live");
    const first = candidates.find((c) => c.source.includes("12.m3u8"));
    assert.equal(first?.engine, "mpegts");
  });
});
