import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playbackCandidates, videoBoxFor } from "./playback.ts";
import { clampAudioDelay, formatAudioDelay } from "./audio-sync.ts";
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

describe("aspect modes", () => {
  it("fills the stage for the fit modes", () => {
    assert.deepEqual(videoBoxFor("contain", 1920, 1080), { width: 1920, height: 1080, objectFit: "contain" });
    assert.deepEqual(videoBoxFor("cover", 1920, 1080), { width: 1920, height: 1080, objectFit: "cover" });
    assert.deepEqual(videoBoxFor("fill", 1280, 720), { width: 1280, height: 720, objectFit: "fill" });
  });

  it("letterboxes forced ratios instead of relying on css aspect-ratio", () => {
    // Wide stage: height wins, width is trimmed to the ratio.
    assert.deepEqual(videoBoxFor("4:3", 1920, 1080), { width: 1440, height: 1080, objectFit: "fill" });
    // Tall stage: width wins.
    assert.deepEqual(videoBoxFor("16:9", 1000, 1000), { width: 1000, height: 563, objectFit: "fill" });
  });

  it("survives being measured before layout", () => {
    assert.deepEqual(videoBoxFor("16:9", 0, 0), { width: 0, height: 0, objectFit: "contain" });
  });
});

describe("audio sync offsets", () => {
  it("snaps to 50ms steps inside the supported range", () => {
    assert.equal(clampAudioDelay(-200), 0);
    assert.equal(clampAudioDelay(231), 250);
    assert.equal(clampAudioDelay(99999), 3000);
    assert.equal(formatAudioDelay(0), "0 ms");
    assert.equal(formatAudioDelay(250), "+250 ms");
  });
});
