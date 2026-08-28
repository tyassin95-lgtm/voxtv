import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteM3u8 } from "./iptv-dev-proxy.mjs";

describe("rewriteM3u8", () => {
  it("rewrites relative segments through the stream proxy", () => {
    const out = rewriteM3u8("#EXTM3U\n#EXTINF:1,\nseg.ts\n", "http://host/live/u/p/1.m3u8");
    assert.match(out, /\/api\/iptv\/stream\?u=/);
    assert.match(out, /seg\.ts/);
  });
});
