import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  AudioLines,
  Heart,
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
  loadAspect,
  loadVolume,
  confidentEngine,
  playbackCandidates,
  saveAspect,
  saveVolume,
  videoBoxFor,
  type AspectMode,
  type Engine,
  type PlaybackCandidate,
} from "@/lib/iptv/playback";
import {
  AUDIO_DELAY_COARSE_MS,
  AUDIO_DELAY_STEP_MS,
  applyAudioDelay,
  clampAudioDelay,
  formatAudioDelay,
  resumeAudioGraph,
} from "@/lib/iptv/audio-sync";
import {
  SubtitleMenu,
  type LoadedSubtitle,
  type SubtitleOption,
} from "@/components/player/subtitle-menu";
import { releaseSubtitleUrls, subtitleQueryFor } from "@/lib/iptv/subtitles";
import { getById, saveProgress } from "@/lib/iptv/db";
import { useIsFavorite } from "@/lib/iptv/store";
import type { ContentKind, Playable, WatchProgress } from "@/lib/iptv/types";
import { cn, formatDuration } from "@/lib/utils";
import { iptvLog, iptvWarn, redactUrl } from "@/lib/iptv/log";
import { probeStream, releaseStreams } from "@/lib/iptv/proxy";
import { engineForKind, type StreamKind } from "@/lib/iptv/stream-detect";
import { unwrapProxiedUrl } from "@/lib/iptv/playback-urls";
import { enableTvMode } from "@/lib/iptv/remote";
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

/** Subset of hls.js we drive directly for subtitle rendition switching. */
interface HlsHandle {
  destroy: () => void;
  subtitleTracks?: { id: number; name?: string; lang?: string }[];
  subtitleTrack?: number;
  subtitleDisplay?: boolean;
}

interface MpegtsLib {
  isSupported: () => boolean;
  createPlayer: (media: Record<string, unknown>, config: Record<string, unknown>) => TsPlayer;
  Events: { ERROR: string };
}

const LIVE_DROPOUT_RETRIES = 2;
const SEEK_STEP = 10;
const VOLUME_STEP = 0.05;
const VOLUME_COARSE = 0.2;

function engineFromProbe(kind: StreamKind, fallback: Engine, source: string): Engine {
  if (kind === "unknown") return fallback;
  return engineForKind(kind, source);
}

export function VideoPlayer({ item }: { item: Playable }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
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
  const [subOptions, setSubOptions] = useState<SubtitleOption[]>([]);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [externalSubs, setExternalSubs] = useState<LoadedSubtitle[]>([]);
  const [subMenu, setSubMenu] = useState(false);
  const [audioDelay, setAudioDelay] = useState(0);
  const [audioSyncOpen, setAudioSyncOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [audioSyncError, setAudioSyncError] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const trackMapRef = useRef(new Map<string, TextTrack>());
  const activeSubRef = useRef<string | null>(null);
  const pendingSubRef = useRef<string | null>(null);
  const subMenuRef = useRef(false);
  const audioSyncRef = useRef(false);
  const volumeOpenRef = useRef(false);
  const audioDelayRef = useRef(0);
  subMenuRef.current = subMenu;
  audioSyncRef.current = audioSyncOpen;
  volumeOpenRef.current = volumeOpen;
  audioDelayRef.current = audioDelay;
  const [seekFlash, setSeekFlash] = useState<string | null>(null);
  const [playerCtrl, setPlayerCtrl] = useState("play");
  const chromeRef = useRef(true);
  const seekPendingRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const seekTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  chromeRef.current = chrome;
  const favKind: ContentKind =
    item.kind === "live" ? "live" : item.kind === "movie" ? "movie" : "show";
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
      // Without load() the element keeps the old request open, and providers
      // that cap concurrent connections then stall the next title.
      video.load();
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

  /**
   * HLS renditions only start downloading once hls.js is told which subtitle
   * track to fetch, so a native `mode = "showing"` alone renders nothing.
   */
  const syncHlsSubtitle = useCallback((track: TextTrack | null, external: boolean) => {
    const hls = hlsRef.current;
    if (!hls || !Array.isArray(hls.subtitleTracks) || !hls.subtitleTracks.length) return;
    if (!track || external) {
      hls.subtitleTrack = -1;
      return;
    }
    const index = hls.subtitleTracks.findIndex(
      (candidate) =>
        (candidate.name && candidate.name === track.label) ||
        (candidate.lang &&
          track.language &&
          candidate.lang.toLowerCase() === track.language.toLowerCase()),
    );
    hls.subtitleDisplay = true;
    hls.subtitleTrack = index >= 0 ? index : 0;
  }, []);

  /** Rebuilds the menu from whatever tracks the element currently exposes. */
  const refreshTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const elements = new Map<TextTrack, HTMLTrackElement>();
    video.querySelectorAll("track").forEach((el) => {
      if (el.track) elements.set(el.track, el);
    });
    const map = new Map<string, TextTrack>();
    const options: SubtitleOption[] = [];
    let embedded = 0;
    for (const track of Array.from(video.textTracks)) {
      if (track.kind && track.kind !== "subtitles" && track.kind !== "captions") continue;
      const element = elements.get(track);
      const id = element?.dataset.subId ?? `embedded:${embedded}`;
      if (!element) embedded += 1;
      map.set(id, track);
      options.push({
        id,
        label:
          element?.label ||
          track.label ||
          track.language?.toUpperCase() ||
          `Track ${options.length + 1}`,
        sublabel: element ? "OpenSubtitles" : "In stream",
      });
    }
    trackMapRef.current = map;
    setSubOptions(options);
  }, []);

  const applySub = useCallback(
    (id: string | null) => {
      const video = videoRef.current;
      activeSubRef.current = id;
      setActiveSub(id);
      const target = id ? (trackMapRef.current.get(id) ?? null) : null;
      for (const track of Array.from(video?.textTracks ?? [])) {
        track.mode = track === target ? "showing" : "disabled";
      }
      syncHlsSubtitle(target, Boolean(id && !id.startsWith("embedded:")));
    },
    [syncHlsSubtitle],
  );

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
    const probeAbort = new AbortController();
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
        if (
          video.canPlayType("application/vnd.apple.mpegurl") &&
          !url.includes("/api/iptv/stream")
        ) {
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
              if (
                !data.fatal ||
                !isCurrent() ||
                tearingDownRef.current ||
                attachGen !== attachGenRef.current
              )
                return;
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
            if (!isCurrent() || tearingDownRef.current || attachGen !== attachGenRef.current)
              return;
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
          iptvWarn(
            "player",
            `live dropout retry ${dropoutRef.current}/${LIVE_DROPOUT_RETRIES} in ${delay}ms`,
          );
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
        setError(
          "This stream could not be played. The provider may be offline or the format is not supported in this browser.",
        );
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
        const known = confidentEngine(source);
        if (known) {
          // The URL already says what this is; skip the extra round trip.
          engine = known;
        } else {
          let probe = probeCache.get(source);
          if (!probe) {
            probe = await probeStream(source, probeAbort.signal);
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
      probeAbort.abort();
      destroyEngines();
      tearingDownRef.current = false;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      releaseStreams();
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
      resumeAudioGraph(video);
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
      refreshTracks();
      // A re-attached engine recreates its tracks, so re-arm the chosen one.
      applySub(activeSubRef.current);
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("waiting", onWait);
    video.addEventListener("playing", onPlay);
    video.addEventListener("canplay", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onErr);
    video.addEventListener("loadedmetadata", onTime);
    video.addEventListener("loadedmetadata", onTracks);
    video.textTracks.addEventListener("addtrack", onTracks);
    video.textTracks.addEventListener("removetrack", onTracks);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("waiting", onWait);
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("canplay", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onErr);
      video.removeEventListener("loadedmetadata", onTime);
      video.removeEventListener("loadedmetadata", onTracks);
      video.textTracks.removeEventListener("addtrack", onTracks);
      video.textTracks.removeEventListener("removetrack", onTracks);
    };
  }, [item.isLive, refreshTracks, applySub]);

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

  // The forced aspect ratios need the real stage size, not a CSS ratio: the
  // element already has a definite width and height, which wins over one.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
    };
  }, []);

  // A downloaded subtitle becomes a <track> child; select it once it mounts.
  useEffect(() => {
    if (!externalSubs.length) return;
    refreshTracks();
    const pending = pendingSubRef.current;
    if (!pending) return;
    pendingSubRef.current = null;
    applySub(pending);
  }, [externalSubs, refreshTracks, applySub]);

  // Downloaded subtitles are object URLs; drop them when the player goes away.
  useEffect(() => releaseSubtitleUrls, []);

  // Nothing should be left ticking after the player unmounts.
  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      if (seekTimer.current) window.clearTimeout(seekTimer.current);
    },
    [],
  );

  // A queued seek belongs to the title that was playing when it was queued.
  useEffect(() => {
    return () => {
      seekPendingRef.current = null;
      if (seekTimer.current) window.clearTimeout(seekTimer.current);
      seekTimer.current = null;
    };
  }, [item.id]);

  // Sync offsets belong to one stream, never to the next thing you open.
  useEffect(() => {
    setAudioDelay(0);
    setAudioSyncError(false);
    applyAudioDelay(videoRef.current, 0);
  }, [item.id]);

  function changeAudioDelay(next: number) {
    const value = clampAudioDelay(next);
    const ok = applyAudioDelay(videoRef.current, value);
    setAudioSyncError(!ok);
    if (!ok) return;
    setAudioDelay(value);
    bumpChrome();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function leavePlayer() {
    // Two fast Back presses used to queue two navigations.
    if (leavingRef.current) return;
    leavingRef.current = true;
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

  const bottomCtrls = [
    "play",
    "rewind",
    "forward",
    "mute",
    "subs",
    ...(item.isLive ? [] : ["sync"]),
    "aspect",
    "full",
  ];
  const topCtrls = ["back", "fav"];
  const playerCtrlRef = useRef(playerCtrl);
  playerCtrlRef.current = playerCtrl;

  useBackHandler(() => {
    if (subMenu) return false;
    if (volumeOpen) {
      setVolumeOpen(false);
      return true;
    }
    if (audioSyncOpen) {
      setAudioSyncOpen(false);
      return true;
    }
    if (chromeRef.current) {
      setChrome(false);
      return true;
    }
    leavePlayer();
    return true;
  }, [subMenu, audioSyncOpen, volumeOpen, item.kind, item.showId]);

  useRemoteHandler(
    (event) => {
      const action = event.action;
      const video = videoRef.current;
      if (!video) return false;
      if (action === "back") return false;
      // The subtitle sheet registers its own handler; stay out of its way.
      if (subMenuRef.current) return false;
      enableTvMode();

      // While a popover is open the d-pad tunes its value; media keys still
      // fall through to normal playback control.
      if (volumeOpenRef.current) {
        if (action === "left") changeVolume(volumeRef.current - VOLUME_STEP);
        else if (action === "right") changeVolume(volumeRef.current + VOLUME_STEP);
        else if (action === "up") changeVolume(volumeRef.current + VOLUME_COARSE);
        else if (action === "down") changeVolume(volumeRef.current - VOLUME_COARSE);
        else if (action === "select") setVolumeOpen(false);
        if (
          action === "left" ||
          action === "right" ||
          action === "up" ||
          action === "down" ||
          action === "select"
        ) {
          return true;
        }
      }

      if (audioSyncRef.current) {
        if (action === "left") changeAudioDelay(audioDelayRef.current - AUDIO_DELAY_STEP_MS);
        else if (action === "right") changeAudioDelay(audioDelayRef.current + AUDIO_DELAY_STEP_MS);
        else if (action === "up") changeAudioDelay(audioDelayRef.current + AUDIO_DELAY_COARSE_MS);
        else if (action === "down") changeAudioDelay(audioDelayRef.current - AUDIO_DELAY_COARSE_MS);
        else if (action === "select") setAudioSyncOpen(false);
        if (
          action === "left" ||
          action === "right" ||
          action === "up" ||
          action === "down" ||
          action === "select"
        ) {
          return true;
        }
      }

      /**
       * One intentional press moves exactly SEEK_STEP seconds. Auto-repeat is
       * ignored outright: a remote key that lingers a few hundred milliseconds
       * used to stack accelerating jumps onto a single tap.
       */
      const doSeek = (dir: number) => {
        if (event.repeat) return;
        const step = SEEK_STEP * dir;
        const ok = seekBy(step);
        if (!ok && item.isLive) {
          const skipped = skipLive(dir);
          flashSeek(skipped ? (dir > 0 ? "Next channel" : "Previous channel") : "Live");
          return;
        }
        flashSeek(seekFlashLabel());
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
        document
          .querySelector<HTMLElement>(`[data-player-ctrl="${playerCtrlRef.current}"]`)
          ?.click();
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
      if (e.key === "m") toggleMute();
      bumpChrome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bumpChrome]);
  useEffect(() => {
    if (!chrome) return;
    document.querySelector<HTMLElement>(`[data-player-ctrl="${playerCtrl}"]`)?.focus();
  }, [playerCtrl, chrome]);

  function seekBounds(video: HTMLVideoElement): { min: number; max: number } | null {
    const ranges = video.seekable;
    let min = 0;
    let max =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : video.currentTime;
    if (ranges && ranges.length > 0) {
      min = ranges.start(0);
      max = ranges.end(ranges.length - 1);
    } else if (item.isLive) {
      return null;
    }
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
  }

  /**
   * Every `currentTime` write restarts the download at a new offset, so holding
   * fast-forward used to fire a request per press. Presses are accumulated and
   * committed once the user stops, while the scrubber follows immediately.
   */
  function seekBy(delta: number): boolean {
    const video = videoRef.current;
    if (!video) return false;
    const bounds = seekBounds(video);
    if (!bounds) return false;
    const base = seekPendingRef.current ?? video.currentTime;
    const next = Math.max(bounds.min, Math.min(bounds.max, base + delta));
    if (!Number.isFinite(next)) return false;
    seekPendingRef.current = next;
    setCurrent(next);
    if (seekTimer.current) window.clearTimeout(seekTimer.current);
    seekTimer.current = window.setTimeout(commitSeek, 320);
    return true;
  }

  /** How far the queued seek moves from where playback actually is. */
  function seekFlashLabel(): string {
    const video = videoRef.current;
    const target = seekPendingRef.current;
    if (!video || target === null) return "";
    const delta = Math.round(target - video.currentTime);
    return `${delta > 0 ? "+" : ""}${delta}s`;
  }

  function commitSeek() {
    const video = videoRef.current;
    const target = seekPendingRef.current;
    seekPendingRef.current = null;
    if (seekTimer.current) {
      window.clearTimeout(seekTimer.current);
      seekTimer.current = null;
    }
    if (!video || target === null) return;
    video.currentTime = target;
  }

  function onSeek(value: number) {
    const video = videoRef.current;
    if (!video || item.isLive) return;
    seekPendingRef.current = value;
    setCurrent(value);
    if (seekTimer.current) window.clearTimeout(seekTimer.current);
    seekTimer.current = window.setTimeout(commitSeek, 200);
  }

  function changeVolume(v: number) {
    const video = videoRef.current;
    const level = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
    volumeRef.current = level;
    setVolume(level);
    saveVolume(level);
    if (video) {
      video.volume = level;
      video.muted = level === 0;
      mutedRef.current = level === 0;
      setMuted(level === 0);
    }
    bumpChrome();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const next = !(video.muted || volumeRef.current === 0);
    if (!next && volumeRef.current === 0) {
      // Nothing to unmute to — put the level back to something audible.
      changeVolume(1);
      return;
    }
    video.muted = next;
    mutedRef.current = next;
    setMuted(next);
    bumpChrome();
  }

  /** Kept for the browser build; on a TV the video already fills the screen. */
  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else el.requestFullscreen().catch(() => undefined);
  }

  function cycleAspect() {
    const i = ASPECT_MODES.findIndex((m) => m.id === aspect);
    const mode = ASPECT_MODES[(i + 1) % ASPECT_MODES.length] ?? ASPECT_MODES[0]!;
    setAspect(mode.id);
    saveAspect(mode.id);
    flashSeek(mode.label);
  }

  const box = videoBoxFor(aspect, stageSize.width, stageSize.height);
  const subtitleQuery = subtitleQueryFor(item);

  return (
    <div
      ref={wrapRef}
      className="relative h-dvh w-full overflow-hidden bg-bg"
      onMouseMove={bumpChrome}
      onClick={bumpChrome}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 m-auto bg-bg"
        style={{
          width: box.width || "100%",
          height: box.height || "100%",
          objectFit: box.objectFit,
        }}
        playsInline
        autoPlay
        tabIndex={-1}
        preload="auto"
        onDoubleClick={toggleFullscreen}
      >
        {externalSubs.map((sub) => (
          <track
            key={sub.id}
            data-sub-id={sub.id}
            kind="subtitles"
            label={sub.label}
            srcLang={sub.lang === "ara" ? "ar" : "en"}
            src={sub.url}
          />
        ))}
      </video>

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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Favorite"
            data-player-ctrl="fav"
            onClick={toggleFav}
          >
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
              tabIndex={-1}
              aria-label="Seek"
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={paused ? "Play" : "Pause"}
              data-player-ctrl="play"
              onClick={togglePlay}
            >
              {paused ? (
                <Play className="ml-0.5 size-5 fill-current" />
              ) : (
                <Pause className="size-5 fill-current" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Rewind"
              data-player-ctrl="rewind"
              onClick={() => {
                const ok = seekBy(-SEEK_STEP);
                flashSeek(
                  ok
                    ? seekFlashLabel()
                    : item.isLive
                      ? skipLive(-1)
                        ? "Previous channel"
                        : "Live"
                      : `-${SEEK_STEP}s`,
                );
              }}
            >
              <Rewind className="size-5 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fast forward"
              data-player-ctrl="forward"
              onClick={() => {
                const ok = seekBy(SEEK_STEP);
                flashSeek(
                  ok
                    ? seekFlashLabel()
                    : item.isLive
                      ? skipLive(1)
                        ? "Next channel"
                        : "Live"
                      : `+${SEEK_STEP}s`,
                );
              }}
            >
              <FastForward className="size-5 fill-current" />
            </Button>
            {!item.isLive && (
              <>
                <span className="px-2 text-xs tabular-nums text-muted">
                  {formatDuration(current)} / {formatDuration(duration)}
                </span>
              </>
            )}
            <div className="relative ml-1 flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Volume"
                data-player-ctrl="volume"
                onClick={() => {
                  setAudioSyncOpen(false);
                  setVolumeOpen((open) => !open);
                }}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
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
                tabIndex={-1}
              />
              {volumeOpen && (
                <div className="absolute bottom-12 left-0 w-56 rounded-md bg-elevated p-3 shadow-[var(--shadow-poster)]">
                  <p className="text-sm font-medium">Volume</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Volume down"
                      onClick={() => changeVolume(volume - VOLUME_STEP)}
                    >
                      −
                    </Button>
                    <span className="flex-1 text-center font-display text-lg tabular-nums">
                      {muted ? "Muted" : `${Math.round(volume * 100)}%`}
                    </span>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Volume up"
                      onClick={() => changeVolume(volume + VOLUME_STEP)}
                    >
                      +
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="mt-2 h-9 w-full rounded-sm text-xs text-muted hover:bg-surface hover:text-fg"
                    onClick={toggleMute}
                  >
                    {muted || volume === 0 ? "Unmute" : "Mute"}
                  </button>
                  <p className="mt-1 text-center text-[0.7rem] leading-tight text-subtle">
                    Left / right on the remote
                  </p>
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Subtitles"
                data-player-ctrl="subs"
                onClick={() => {
                  setSubMenu(true);
                  refreshTracks();
                }}
              >
                <Subtitles className={cn("size-5", activeSub && "text-accent")} />
              </Button>
              {!item.isLive && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Audio sync"
                    data-player-ctrl="sync"
                    onClick={() => {
                      setVolumeOpen(false);
                      setAudioSyncOpen((open) => !open);
                    }}
                  >
                    <AudioLines className={cn("size-5", audioDelay > 0 && "text-accent")} />
                  </Button>
                  {audioSyncOpen && (
                    <div className="absolute right-0 bottom-12 w-64 rounded-md bg-elevated p-3 shadow-[var(--shadow-poster)]">
                      <p className="text-sm font-medium">Audio sync</p>
                      <p className="mt-0.5 text-xs text-subtle">
                        Hold the sound back until it matches the picture.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          aria-label="Less audio delay"
                          onClick={() => changeAudioDelay(audioDelay - AUDIO_DELAY_STEP_MS)}
                        >
                          −
                        </Button>
                        <span className="flex-1 text-center font-display text-lg tabular-nums">
                          {formatAudioDelay(audioDelay)}
                        </span>
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          aria-label="More audio delay"
                          onClick={() => changeAudioDelay(audioDelay + AUDIO_DELAY_STEP_MS)}
                        >
                          +
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="mt-2 h-9 w-full rounded-sm text-xs text-muted hover:bg-surface hover:text-fg"
                        onClick={() => changeAudioDelay(0)}
                      >
                        Reset
                      </button>
                      {audioSyncError && (
                        <p className="mt-1 text-xs text-accent">
                          This browser will not let the app delay the audio.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" data-player-ctrl="aspect" onClick={cycleAspect}>
                {ASPECT_MODES.find((m) => m.id === aspect)?.label}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      </div>

      {subMenu && (
        <SubtitleMenu
          open
          onClose={() => {
            setSubMenu(false);
            bumpChrome();
          }}
          options={subOptions}
          activeId={activeSub}
          onSelect={(id) => {
            applySub(id);
            setSubMenu(false);
            bumpChrome();
          }}
          onLoaded={(sub) => {
            pendingSubRef.current = sub.id;
            setExternalSubs((subs) =>
              subs.some((row) => row.id === sub.id) ? subs : [...subs, sub],
            );
          }}
          defaultQuery={subtitleQuery.query}
          season={subtitleQuery.season}
          episode={subtitleQuery.episode}
        />
      )}
    </div>
  );
}
