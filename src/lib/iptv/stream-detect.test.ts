import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffStreamBytes } from "./stream-detect.ts";

describe("sniffStreamBytes", () => {
  it("detects HLS playlists", () => {
    assert.equal(sniffStreamBytes(Buffer.from("#EXTM3U\n#EXTINF:1\nseg.ts\n")), "hls");
  });
  it("detects MPEG-TS sync bytes even when the url said m3u8", () => {
    const ts = Buffer.from([0x47, 0x40, 0x00, 0x10, 0x00]);
    assert.equal(sniffStreamBytes(ts), "ts");
  });
  it("detects mp4 ftyp boxes", () => {
    const mp4 = Buffer.from("\u0000\u0000\u0000\u0018ftypisom", "latin1");
    assert.equal(sniffStreamBytes(mp4), "mp4");
  });
});
