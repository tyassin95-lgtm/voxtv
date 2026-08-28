#!/usr/bin/env node
// @ts-nocheck
/**
 * Local Xtream Codes panel used to verify catalog mapping + playback.
 * Intentionally reproduces provider quirks:
 * - numeric category_id vs string
 * - parent/subcategory trees
 * - bulk lists that omit some categories
 * - PHP warning prefixed JSON
 * - .m3u8 live URLs that actually serve MPEG-TS
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.join("/tmp", "vox-xtream-media");
const HOST = process.env.XTREAM_MOCK_HOST || "127.0.0.1";
const USER = "demo";
const PASS = "secret+1";
let listeningPort = Number(process.env.XTREAM_MOCK_PORT || 8788);

function runFfmpeg(args) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${r.stderr?.slice(-400) || r.error}`);
  }
}

function ensureMedia() {
  fs.mkdirSync(MEDIA, { recursive: true });
  const ts = path.join(MEDIA, "live.ts");
  const mp4 = path.join(MEDIA, "vod.mp4");
  const episode = path.join(MEDIA, "episode.mp4");
  const playlist = path.join(MEDIA, "live.m3u8");
  const lavfi = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x240:rate=25",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:sample_rate=44100",
    "-t",
    "4",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
  ];
  if (!fs.existsSync(ts)) {
    runFfmpeg([...lavfi, "-f", "mpegts", ts]);
  }
  if (!fs.existsSync(mp4)) {
    runFfmpeg([...lavfi, mp4]);
  }
  if (!fs.existsSync(episode)) {
    fs.copyFileSync(mp4, episode);
  }
  if (!fs.existsSync(playlist)) {
    runFfmpeg(["-y", "-i", mp4, "-c", "copy", "-hls_time", "2", "-hls_list_size", "0", playlist]);
  }
}

function json(res, data, { phpWarning = false, status = 200 } = {}) {
  const body = (phpWarning ? "Notice: Undefined index: foo in player_api.php on line 1\n" : "") + JSON.stringify(data);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

function file(res, filePath, type) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "content-type": type,
    "content-length": stat.size,
    "accept-ranges": "bytes",
  });
  fs.createReadStream(filePath).pipe(res);
}

const liveCategories = [
  { category_id: 1, category_name: "Sports", parent_id: 0 },
  { category_id: 10, category_name: "Football", parent_id: 1 },
  { category_id: 11, category_name: "Tennis", parent_id: 1 },
  { category_id: 2, category_name: "News", parent_id: 0 },
];

const vodCategories = [
  { category_id: "20", category_name: "Action", parent_id: 0 },
  { category_id: 21, category_name: "Drama", parent_id: 0 },
];

const seriesCategories = [
  { category_id: 30, category_name: "Originals", parent_id: 0 },
  { category_id: 31, category_name: "Hidden Series", parent_id: 0 },
];

const liveByCategory = {
  10: [
    {
      num: 1,
      name: "Football One",
      stream_type: "live",
      stream_id: 101,
      stream_icon: "",
      epg_channel_id: "fb1",
      added: "1700000000",
      category_id: 10,
      category_ids: ["10", "1"],
    },
  ],
  11: [
    {
      num: 2,
      name: "Tennis Court",
      stream_type: "live",
      stream_id: 111,
      stream_icon: "",
      epg_channel_id: "tn1",
      added: "1700000000",
      category_id: "11",
    },
  ],
  2: [
    {
      num: 3,
      name: "World News",
      stream_type: "live",
      stream_id: 201,
      stream_icon: "",
      epg_channel_id: "news1",
      added: "1700000000",
      category_id: 2,
    },
  ],
};

const vodByCategory = {
  20: [
    {
      stream_id: 501,
      name: "Night Drive",
      stream_icon: "",
      category_id: 20,
      added: "1700000100",
      container_extension: "mp4",
      plot: "A test movie",
      year: "2024",
    },
    {
      stream_id: 503,
      name: "Stray Bullet",
      stream_icon: "",
      added: "1700000150",
      container_extension: "mp4",
      year: "2024",
    },
  ],
  21: [
    {
      stream_id: 502,
      name: "Quiet Town",
      stream_icon: "",
      category_ids: [21],
      added: "1700000200",
      container_extension: "mp4",
      year: "2023",
    },
  ],
};

const seriesByCategory = {
  30: [
    {
      series_id: 801,
      name: "Harbor Lights",
      cover: "",
      category_id: "30",
      plot: "A test show",
      year: "2022",
      last_modified: "1700000300",
    },
  ],
  31: [
    {
      series_id: 802,
      name: "Only Per Category",
      cover: "",
      category_id: 31,
      year: "2021",
      last_modified: "1700000400",
    },
  ],
};

function flatten(map) {
  return Object.values(map).flat();
}

function authOk(query) {
  return query.username === USER && query.password === PASS;
}

function playerApi(url, res) {
  const query = Object.fromEntries(url.searchParams.entries());
  if (!authOk(query)) {
    json(res, { user_info: { auth: 0, status: "Disabled", message: "Invalid credentials" } });
    return;
  }
  const action = query.action || "";
  if (!action) {
    json(res, {
      user_info: { auth: 1, status: "Active", username: USER },
      server_info: { url: `${HOST}`, port: String(listeningPort), https_port: "443", server_protocol: "http" },
    });
    return;
  }
  if (action === "get_live_categories") {
    json(res, liveCategories, { phpWarning: true });
    return;
  }
  if (action === "get_vod_categories") {
    json(res, vodCategories);
    return;
  }
  if (action === "get_series_categories") {
    json(res, seriesCategories);
    return;
  }
  if (action === "get_live_streams") {
    if (query.category_id) {
      json(res, liveByCategory[query.category_id] || []);
      return;
    }
    // Bulk list intentionally omits Tennis and has numeric ids only for News.
    json(res, [...liveByCategory[10], ...liveByCategory[2]]);
    return;
  }
  if (action === "get_vod_streams") {
    if (query.category_id) {
      json(res, vodByCategory[query.category_id] || []);
      return;
    }
    // Bulk omits Drama, includes a stray title without category_id, and a title
    // whose category_id is the category name rather than the numeric id.
    json(res, [
      vodByCategory[20][0],
      {
        stream_id: 503,
        name: "Stray Bullet",
        stream_icon: "",
        added: "1700000150",
        container_extension: "mp4",
        year: "2024",
      },
      {
        stream_id: 504,
        name: "Alias Action",
        stream_icon: "",
        category_id: "Action",
        genre: "Action",
        added: "1700000160",
        container_extension: "mp4",
        year: "2020",
      },
    ]);
    return;
  }
  if (action === "get_series") {
    if (query.category_id) {
      json(res, seriesByCategory[query.category_id] || []);
      return;
    }
    json(res, { 0: seriesByCategory[30][0] });
    return;
  }
  if (action === "get_series_info") {
    json(res, {
      info: { name: "Harbor Lights", plot: "A test show" },
      episodes: {
        "1": {
          "0": {
            id: "901",
            episode_num: 1,
            title: "Pilot",
            container_extension: "mp4",
            info: { plot: "The beginning" },
          },
        },
      },
    });
    return;
  }
  if (action === "get_short_epg") {
    json(res, { epg_listings: [] });
    return;
  }
  json(res, []);
}

function mediaPath(kind, id, ext) {
  if (kind === "live") {
    if (ext === "m3u8") return { file: path.join(MEDIA, "live.ts"), type: "video/mp2t" };
    return { file: path.join(MEDIA, "live.ts"), type: "video/mp2t" };
  }
  if (kind === "movie") return { file: path.join(MEDIA, "vod.mp4"), type: "video/mp4" };
  return { file: path.join(MEDIA, "episode.mp4"), type: "video/mp4" };
}

export function startXtreamMock(port = Number(process.env.XTREAM_MOCK_PORT || 8788)) {
  ensureMedia();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:8788`}`);
    if (url.pathname === "/player_api.php") {
      playerApi(url, res);
      return;
    }
    if (url.pathname === "/xmltv.php") {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end("<tv></tv>");
      return;
    }
    const live = url.pathname.match(/^\/live\/([^/]+)\/([^/]+)\/([^/.]+)(?:\.(m3u8|ts))?$/);
    const movie = url.pathname.match(/^\/movie\/([^/]+)\/([^/]+)\/([^/.]+)\.([a-z0-9]+)$/i);
    const series = url.pathname.match(/^\/series\/([^/]+)\/([^/]+)\/([^/.]+)\.([a-z0-9]+)$/i);
    const creds = (user, pass) => decodeURIComponent(user) === USER && decodeURIComponent(pass) === PASS;
    if (live) {
      if (!creds(live[1], live[2])) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const media = mediaPath("live", live[3], live[4] || "ts");
      file(res, media.file, media.type);
      return;
    }
    if (movie) {
      if (!creds(movie[1], movie[2])) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      file(res, path.join(MEDIA, "vod.mp4"), "video/mp4");
      return;
    }
    if (series) {
      if (!creds(series[1], series[2])) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      file(res, path.join(MEDIA, "episode.mp4"), "video/mp4");
      return;
    }
    if (url.pathname.endsWith(".ts") && url.pathname.includes("live.m3u8") === false) {
      const seg = path.join(MEDIA, path.basename(url.pathname));
      if (fs.existsSync(seg)) {
        file(res, seg, "video/mp2t");
        return;
      }
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      listeningPort = actualPort;
      resolve({
        server,
        origin: `http://${HOST}:${actualPort}`,
        username: USER,
        password: PASS,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startXtreamMock()
    .then((mock) => {
      console.log(`xtream mock at ${mock.origin} user=${mock.username}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
