import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Heart,
  Maximize,
  Minimize,
  Pause,
  Play,
  FastForward,
  Rewind,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useBackHandler, useRemoteHandler } from "@/components/remote-root";
import {
  ASPECT_MODES,
  aspectRatioFor,
  loadAspect,
  loadVolume,
  objectFitFor,
  playbackCandidates,
  saveAspect,
  saveVolume,
  type AspectMode,
  type Engine,
  type PlaybackCandidate,
} from "@/lib/iptv/playback";
import { getById, saveProgress } from "@/lib/iptv/db";
import { useIsFavorite } from "@/lib/iptv/store";
import type { ContentKind, Playable, WatchProgress } from "@/lib/iptv/types";
import { cn, formatDuration } from "@/lib/utils";
import { iptvLog, iptvWarn, redactUrl } from "@/lib/iptv/log";
import { probeStream } from "@/lib/iptv/proxy";
import { engineForKind, type StreamKind } from "@/lib/iptv/stream-detect";
import { unwrapProxiedUrl } from "@/lib/iptv/playback-urls";
import { enableTvMode, seekStep } from "@/lib/iptv/remote";
import { neighborInBrowseList } from "@/lib/iptv/browse-list";

interface TsPlayer {
  pause: () => void;
  unload: () => void;
  detachMediaElement: () => void;
  destroy: () => void;
  attachMediaElement: (el: HTMLVideoElement) => void;
  load: () => void;
  play: () => Promise<void> | void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

interface MpegtsLib {
  isSupported: () => boolean;
  createPlayer: (media: Record<string, unknown>, config: Record<string, unknown>) => TsPlayer;
  Events: { ERROR: string };
}

const LIVE_DROPOUT_RETRIES = 2;

function engineFromProbe(kind: StreamKind, fallback: Engine, source: string): Engine {
  if (kind === "unknown") return fallback;
  return engineForKind(kind, source);
}

export function VideoPlayer({ item }: { item: Playable }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const tsRef = useRef<TsPlayer | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const dropoutRef = useRef(0);
  const candidatesRef = useRef<PlaybackCandidate[]>([]);
  const playingRef = useRef(false);
  const tearingDownRef = useRef(false);
  const generationRef = useRef(0);
  const attachGenRef = useRef(0);
  const volumeRef = useRef(loadVolume());
  const mutedRef = useRef(false);
  const failCurrentRef = useRef<(reason: string) => void>(() => undefined);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(item.duration ?? 0);
  const [volume, setVolume] = useState(volumeRef.current);
  const [muted, setMuted] = useState(false);
  const [aspect, setAspect] = useState<AspectMode>(loadAspect);
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]);
  const [subsOn, setSubsOn] = useState(true);
  const [subIndex, setSubIndex] = useState(0);
  const [subMenu, setSubMenu] = useState(false);
  const [seekFlash, setSeekFlash] = useState<string | null>(null);
  const [playerCtrl, setPlayerCtrl] = useState("play");
  const chromeRef = useRef(true);
  const seekHoldRef = useRef(0);
  const flashTimer = useRef<number | null>(null);
  chromeRef.current = chrome;
  const favKind: ContentKind = item.kind === "live" ? "live" : item.kind === "movie" ? "movie" : "show";
  const favId = item.kind === "episode" ? item.showId || item.id : item.id;
  const [favorited, toggleFav] = useIsFavorite(favKind, favId);

  const destroyEngines = useCallback(() => {
    tearingDownRef.current = true;
    try {
      hlsRef.current?.destroy();
    } catch {
      /* already torn down */
    }
    hlsRef.current = null;
    try {
      tsRef.current?.pause();
      tsRef.current?.unload();
      tsRef.current?.detachMediaElement();
      tsRef.current?.destroy();
    } catch {
      /* already torn down */
    }
    tsRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3200);
  }, []);

  const bumpChrome = useCallback(() => {
    setChrome(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const session = ++generationRef.current;
    let cancelled = false;
    playingRef.current = false;
    dropoutRef.current = 0;
    candidatesRef.current = playbackCandidates(item.url, item.kind, item.urls ?? []);
    attemptRef.current = 0;
    const probeCache = new Map<string, Awaited<ReturnType<typeof probeStream>>>();
    iptvLog(
      "player",
      "plan",
      item.kind,
      candidatesRef.current.map((c) => `${c.engine}:${redactUrl(c.source)}`).join(" | "),
    );

    const isCurrent = () => !cancelled && generationRef.current === session;

    async function attachEngine(candidate: PlaybackCandidate, engine: Engine) {
      if (!video || !isCurrent()) return;
      destroyEngines();
      const attachGen = ++attachGenRef.current;
      tearingDownRef.current = false;
      setBuffering(true);
      const url = candidate.url;
      iptvLog("player", "start", engine, redactUrl(candidate.source));
      if (engine === "hls") {
        if (video.canPlayType("application/vnd.apple.mpegurl") && !url.includes("/api/iptv/stream")) {
          video.src = url;
        } else {
          const { default: Hls } = await import("hls.js");
          if (!isCurrent() || attachGen !== attachGenRef.current) return;
          if (!Hls.isSupported()) {
            video.src = url;
          } else {
            const hls = new Hls({
              enableWorker: false,
              lowLatencyMode: false,
              capLevelToPlayerSize: true,
              maxBufferLength: item.isLive ? 12 : 30,
              maxMaxBufferLength: item.isLive ? 24 : 60,
              backBufferLength: item.isLive ? 8 : 30,
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 10,
              startLevel: -1,
              fragLoadingMaxRetry: 2,
              manifestLoadingMaxRetry: 2,
              levelLoadingMaxRetry: 2,
              manifestLoadingTimeOut: 15000,
              fragLoadingTimeOut: 20000,
              xhrSetup(xhr) {
                xhr.withCredentials = false;
              },
            });
            hlsRef.current = hls;
            hls.attachMedia(video);
            hls.loadSource(url);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!isCurrent() || attachGen !== attachGenRef.current) return;
              video.play().catch(() => undefined);
            });
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (!data.fatal || !isCurrent() || tearingDownRef.current || attachGen !== attachGenRef.current) return;
              const detail = String(data.details || data.type || "hls error");
              iptvWarn("player", "hls fatal", detail);
              failCurrentRef.current(`HLS ${detail}`);
            });
          }
        }
      } else if (engine === "mpegts") {
        const mod = (await import("mpegts.js")) as unknown as {
          default?: MpegtsLib;
          isSupported?: () => boolean;
          createPlayer?: MpegtsLib["createPlayer"];
          Events?: MpegtsLib["Events"];
        };
        if (!isCurrent() || attachGen !== attachGenRef.current) return;
        const mpeg = (mod.default ?? mod) as MpegtsLib;
        if (!mpeg.isSupported()) {
          video.src = url;
        } else {
          const player = mpeg.createPlayer(
            { type: "mpegts", isLive: item.isLive, url, cors: true },
            {
              enableWorker: false,
              lazyLoad: false,
              enableStashBuffer: !item.isLive,
              liveBufferLatencyChasing: item.isLive,
              liveBufferLatencyMaxLatency: 8,
              stashInitialSize: 384 * 1024,
              autoCleanupSourceBuffer: true,
              fixTimestampOverflow: true,
            },
          );
          tsRef.current = player;
          player.attachMediaElement(video);
          player.load();
          void player.play();
          player.on(mpeg.Events.ERROR, (...args: unknown[]) => {
            if (!isCurrent() || tearingDownRef.current || attachGen !== attachGenRef.current) return;
            iptvWarn("player", "mpegts error", ...args);
            failCurrentRef.current("MPEG-TS stream error");
          });
        }
      } else {
        video.src = url;
      }
      video.volume = volumeRef.current;
      video.muted = mutedRef.current;
      await video.play().catch(() => undefined);
    }

    async function startPlayback() {
      if (!video || !isCurrent()) return;
      const candidates = candidatesRef.current;
      if (!candidates.length) {
        setError("No playable stream URL was generated for this title.");
        setBuffering(false);
        setReconnecting(false);
        return;
      }
      if (attemptRef.current >= candidates.length) {
        if (item.isLive && playingRef.current && dropoutRef.current < LIVE_DROPOUT_RETRIES) {
          dropoutRef.current += 1;
          const delay = Math.min(6000, 1200 * 2 ** (dropoutRef.current - 1));
          iptvWarn("player", `live dropout retry ${dropoutRef.current}/${LIVE_DROPOUT_RETRIES} in ${delay}ms`);
          setReconnecting(true);
          setError("Connection lost. Reconnecting…");
          attemptRef.current = 0;
          if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
          reconnectTimer.current = window.setTimeout(() => {
            void startPlayback();
          }, delay);
          return;
        }
        destroyEngines();
        tearingDownRef.current = false;
        setReconnecting(false);
        setBuffering(false);
        setError("This stream could not be played. The provider may be offline or the format is not supported in this browser.");
        iptvWarn("player", "gave up after", candidates.length, "candidates");
        return;
      }
      const candidate = candidates[attemptRef.current];
      if (!candidate) return;
      setError(null);
      setReconnecting(dropoutRef.current > 0);
      setBuffering(true);
      try {
        let engine = candidate.engine;
        const source = unwrapProxiedUrl(candidate.source);
        let probe = probeCache.get(source);
        if (!probe) {
          probe = await probeStream(source);
          probeCache.set(source, probe);
          iptvLog("player", "probe", redactUrl(source), probe.status, probe.kind);
        }
        if (!isCurrent()) return;
        if (probe.status >= 400) {
          failCurrentRef.current(`upstream ${probe.status}`);
          return;
        }
        if (probe.ok && probe.kind !== "unknown") {
          engine = engineFromProbe(probe.kind, candidate.engine, source);
        }
        await attachEngine({ ...candidate, engine }, engine);
      } catch (err) {
        iptvWarn("player", "start failed", err);
        failCurrentRef.current(err instanceof Error ? err.message : "Could not start playback");
      }
    }

    failCurrentRef.current = (reason: string) => {
      if (!isCurrent() || tearingDownRef.current) return;
      iptvWarn("player", "candidate failed", reason, "index", attemptRef.current);
      playingRef.current = false;
      attemptRef.current += 1;
      void startPlayback();
    };

    void startPlayback();
    return () => {
      cancelled = true;
      destroyEngines();
      tearingDownRef.current = false;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    };
  }, [item.url, item.isLive, item.kind, item.urls, destroyEngines]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || item.isLive) return;
    const resume = async () => {
      const progress = await getById<WatchProgress>("progress", `${item.kind}:${item.id}`);
      if (progress && progress.position > 8 && progress.position < progress.duration * 0.95) {
        video.currentTime = progress.position;
        setCurrent(progress.position);
        if (progress.duration) setDuration(progress.duration);
      }
    };
    video.addEventListener("loadedmetadata", resume);
    return () => video.removeEventListener("loadedmetadata", resume);
  }, [item.id, item.isLive, item.kind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrent(video.currentTime);
      if (video.duration && Number.isFinite(video.duration)) setDuration(video.duration);
      if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        playingRef.current = true;
        setBuffering(false);
        setReconnecting(false);
      }
    };
    const onWait = () => {
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setBuffering(true);
    };
    const onPlay = () => {
      playingRef.current = true;
      setBuffering(false);
      setPaused(false);
      setReconnecting(false);
      setError(null);
    };
    const onPause = () => setPaused(true);
    const onErr = () => {
      if (tearingDownRef.current) return;
      const mediaError = video.error;
      const reason = mediaError ? `media error ${mediaError.code}` : "video error";
      iptvWarn("player", reason);
      failCurrentRef.current(reason);
    };
    const onTracks = () => {
      const tracks = Array.from(video.textTracks);
      setTextTracks(tracks);
      tracks.forEach((t, i) => {
        t.mode = subsOn && i === subIndex ? "showing" : "hidden";
      });
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("waiting", onWait);
    video.addEventListener("playing", onPlay);
    video.addEventListener("canplay", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onErr);
    video.addEventListener("loadedmetadata", onTime);
    video.textTracks.addEventListener("addtrack", onTracks);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("waiting", onWait);
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("canplay", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onErr);
      video.removeEventListener("loadedmetadata", onTime);
      video.textTracks.removeEventListener("addtrack", onTracks);
    };
  }, [item.isLive, subIndex, subsOn]);

  useEffect(() => {
    if (item.isLive) return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      saveProgress({
        key: `${item.kind}:${item.id}`,
        kind: item.kind,
        itemId: item.id,
        showId: item.showId,
        title: item.title,
        subtitle: item.subtitle,
        poster: item.poster,
        position: video.currentTime,
        duration: video.duration,
        url: item.url,
        updatedAt: Date.now(),
      }).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(id);
  }, [item]);


  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function leavePlayer() {
    if (item.kind === "episode" && item.showId) {
      void navigate({ to: "/shows/$showId", params: { showId: item.showId } });
      return;
    }
    if (item.kind === "live") {
      void navigate({ to: "/live" });
      return;
    }
    void navigate({ to: "/movies" });
  }

  function flashSeek(label: string) {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setSeekFlash(label);
    bumpChrome();
    flashTimer.current = window.setTimeout(() => setSeekFlash(null), 800);
  }

  function skipLive(dir: number): boolean {
    if (!item.isLive) return false;
    const next = neighborInBrowseList(item.id, dir);
    if (!next || next === item.id) return false;
    void navigate({ to: "/watch", search: { kind: "live", id: next } });
    return true;
  }

  const bottomCtrls = ["play", "rewind", "forward", "mute", "subs", "aspect", "full"];
  const topCtrls = ["back", "fav"];
  const playerCtrlRef = useRef(playerCtrl);
  playerCtrlRef.current = playerCtrl;

  useBackHandler(() => {
    if (subMenu) {
      setSubMenu(false);
      return true;
    }
    if (chromeRef.current) {
      setChrome(false);
      return true;
    }
    leavePlayer();
    return true;
  }, [subMenu, item.kind, item.showId]);

  useRemoteHandler(
    (event) => {
      const action = event.action;
      const video = videoRef.current;
      if (!video) return false;
      if (action === "back") return false;
      enableTvMode();

      const doSeek = (dir: number) => {
        if (event.repeat) seekHoldRef.current += 1;
        else seekHoldRef.current = 0;
        const step = seekStep(seekHoldRef.current) * dir;
        const ok = seekBy(step);
        if (!ok && item.isLive) {
          const skipped = skipLive(dir);
          flashSeek(skipped ? (dir > 0 ? "Next channel" : "Previous channel") : "Live");
          return;
        }
        flashSeek(`${step > 0 ? "+" : ""}${step}s`);
      };

      if (action === "rewind") {
        doSeek(-1);
        return true;
      }
      if (action === "forward") {
        doSeek(1);
        return true;
      }
      if (action === "prev") {
        if (item.isLive) {
          const skipped = skipLive(-1);
          flashSeek(skipped ? "Previous channel" : "Live");
        } else doSeek(-1);
        return true;
      }
      if (action === "next") {
        if (item.isLive) {
          const skipped = skipLive(1);
          flashSeek(skipped ? "Next channel" : "Live");
        } else doSeek(1);
        return true;
      }
      if (action === "playpause" || action === "play" || action === "pause" || action === "stop") {
        if (action === "play") void video.play();
        else if (action === "pause" || action === "stop") video.pause();
        else togglePlay();
        bumpChrome();
        return true;
      }
      if ((action === "left" || action === "right") && !chromeRef.current) {
        doSeek(action === "left" ? -1 : 1);
        return true;
      }
      if ((action === "up" || action === "down" || action === "select") && !chromeRef.current) {
        if (action === "select") togglePlay();
        bumpChrome();
        setPlayerCtrl("play");
        return true;
      }
      if (action === "left" || action === "right" || action === "up" || action === "down") {
        bumpChrome();
        const current = playerCtrlRef.current;
        const row = topCtrls.includes(current) ? topCtrls : bottomCtrls;
        const other = row === topCtrls ? bottomCtrls : topCtrls;
        if (action === "up" || action === "down") {
          setPlayerCtrl(other[0]!);
          return true;
        }
        const i = row.indexOf(current);
        const next = action === "left" ? Math.max(0, i - 1) : Math.min(row.length - 1, i + 1);
        setPlayerCtrl(row[next] ?? current);
        return true;
      }
      if (action === "select") {
        bumpChrome();
        document.querySelector<HTMLElement>(`[data-player-ctrl="${playerCtrlRef.current}"]`)?.click();
        return true;
      }
      return false;
    },
    [bumpChrome, item.isLive, item.id],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "f" && e.key !== "m") return;
      const video = videoRef.current;
      if (!video) return;
      e.preventDefault();
      if (e.key === "k") togglePlay();
      if (e.key === "f") toggleFullscreen();
      if (e.key === "m") {
        video.muted = !video.muted;
        mutedRef.current = video.muted;
        setMuted(video.muted);
      }
      bumpChrome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bumpChrome]);
  useEffect(() => {
    if (!chrome) return;
    document.querySelector<HTMLElement>(`[data-player-ctrl="${playerCtrl}"]`)?.focus();
  }, [playerCtrl, chrome]);

  function seekBy(delta: number): boolean {
    const video = videoRef.current;
    if (!video) return false;
    const ranges = video.seekable;
    let min = 0;
    let max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : video.currentTime;
    if (ranges && ranges.length > 0) {
      min = ranges.start(0);
      max = ranges.end(ranges.length - 1);
    } else if (item.isLive) {
      return false;
    }
    const next = Math.max(min, Math.min(max, video.currentTime + delta));
    if (!Number.isFinite(next)) return false;
    video.currentTime = next;
    setCurrent(next);
    return true;
  }

  function onSeek(value: number) {
    const video = videoRef.current;
    if (!video || item.isLive) return;
    video.currentTime = value;
    setCurrent(value);
  }

  function changeVolume(v: number) {
    const video = videoRef.current;
    volumeRef.current = v;
    setVolume(v);
    saveVolume(v);
    if (video) {
      video.volume = v;
      video.muted = v === 0;
      mutedRef.current = v === 0;
      setMuted(v === 0);
    }
  }

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setFullscreen(false);
    } else {
      el.requestFullscreen().catch(() => undefined);
      setFullscreen(true);
    }
  }

  function cycleAspect() {
    const i = ASPECT_MODES.findIndex((m) => m.id === aspect);
    const next = ASPECT_MODES[(i + 1) % ASPECT_MODES.length]?.id ?? "contain";
    setAspect(next);
    saveAspect(next);
  }

  function applySubs(on: boolean, index = subIndex) {
    setSubsOn(on);
    setSubIndex(index);
    textTracks.forEach((t, i) => {
      t.mode = on && i === index ? "showing" : "disabled";
    });
  }

  const fit = objectFitFor(aspect);
  const ratio = aspectRatioFor(aspect);

  return (
    <div
      ref={wrapRef}
      className="relative h-dvh w-full overflow-hidden bg-bg"
      onMouseMove={bumpChrome}
      onClick={bumpChrome}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 m-auto size-full bg-bg"
        style={{ objectFit: fit, aspectRatio: ratio }}
        playsInline
        autoPlay
        tabIndex={-1}
        preload="auto"
        onDoubleClick={toggleFullscreen}
      />

      {(buffering || reconnecting) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="size-12 animate-spin rounded-full border-2 border-fg/20 border-t-accent" />
        </div>
      )}

      {seekFlash && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-elevated px-5 py-3 font-display text-3xl font-semibold tabular-nums shadow-[var(--shadow-poster)]">
            {seekFlash}
          </span>
        </div>
      )}

      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-bg/50 transition-opacity duration-200",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex items-center gap-3 p-4 md:p-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            data-player-ctrl="back"
            onClick={() => leavePlayer()}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">{item.title}</h1>
            {item.subtitle && <p className="truncate text-sm text-muted">{item.subtitle}</p>}
          </div>
          {item.isLive && (
            <span className="rounded-sm bg-accent px-2 py-1 text-xs font-semibold tracking-wide text-accent-fg">
              LIVE
            </span>
          )}
          <Button variant="ghost" size="icon" aria-label="Favorite" data-player-ctrl="fav" onClick={toggleFav}>
            <Heart className={cn("size-5", favorited && "fill-accent text-accent")} />
          </Button>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 md:p-6">
          {!item.isLive && duration > 0 && (
            <input
              type="range"
              min={0}
              max={duration}
              step={0.25}
              value={Math.min(current, duration)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-fg/20 accent-accent"
            />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label={paused ? "Play" : "Pause"} data-player-ctrl="play" onClick={togglePlay}>
              {paused ? (
                <Play className="ml-0.5 size-5 fill-current" />
              ) : (
                <Pause className="size-5 fill-current" />
              )}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Rewind" data-player-ctrl="rewind" onClick={() => { const ok = seekBy(-10); flashSeek(ok ? "-10s" : item.isLive ? (skipLive(-1) ? "Previous channel" : "Live") : "-10s"); }}>
              <Rewind className="size-5 fill-current" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Fast forward" data-player-ctrl="forward" onClick={() => { const ok = seekBy(10); flashSeek(ok ? "+10s" : item.isLive ? (skipLive(1) ? "Next channel" : "Live") : "+10s"); }}>
              <FastForward className="size-5 fill-current" />
            </Button>
            {!item.isLive && (
              <>
                <span className="px-2 text-xs tabular-nums text-muted">
                  {formatDuration(current)} / {formatDuration(duration)}
                </span>
              </>
            )}
            <div className="ml-1 flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={muted ? "Unmute" : "Mute"}
                data-player-ctrl="mute"
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.muted = !video.muted;
                  mutedRef.current = video.muted;
                  setMuted(video.muted);
                }}
              >
                {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="hidden w-24 accent-accent sm:block"
                aria-label="Volume"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Subtitles"
                  data-player-ctrl="subs"
                  onClick={() => {
                    if (textTracks.length === 0) {
                      applySubs(!subsOn);
                      return;
                    }
                    setSubMenu((v) => !v);
                  }}
                >
                  <Subtitles className={cn("size-5", subsOn && textTracks.length > 0 && "text-accent")} />
                </Button>
                {subMenu && (
                  <div className="absolute right-0 bottom-12 w-48 rounded-md bg-elevated p-1 shadow-[var(--shadow-border)]">
                    <button
                      type="button"
                      className="flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface"
                      onClick={() => {
                        applySubs(false);
                        setSubMenu(false);
                      }}
                    >
                      Off
                    </button>
                    {textTracks.map((track, i) => (
                      <button
                        key={track.language || track.label || i}
                        type="button"
                        className={cn(
                          "flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface",
                          subsOn && subIndex === i && "text-accent",
                        )}
                        onClick={() => {
                          applySubs(true, i);
                          setSubMenu(false);
                        }}
                      >
                        {track.label || track.language || `Track ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" data-player-ctrl="aspect" onClick={cycleAspect}>
                {ASPECT_MODES.find((m) => m.id === aspect)?.label}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                data-player-ctrl="full"
                onClick={toggleFullscreen}
              >
                {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      </div>
    </div>
  );
}
