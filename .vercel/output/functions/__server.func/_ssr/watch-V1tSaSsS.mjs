import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as FastForward, D as Captions, c as Rewind, d as Play, f as Pause, h as Maximize, k as ArrowLeft, m as Minimize, n as VolumeX, r as Volume2, x as Heart } from "../_libs/lucide-react.mjs";
import { A as pickEngine, C as formatDuration, E as iptvWarn, F as redactUrl, H as unwrapProxiedUrl, K as useIsFavorite, L as resolvePlayable, M as probeStream, P as proxiedStreamUrl, R as saveProgress, T as iptvLog, V as streamUrlVariants, a as useBackHandler, b as cn, c as enableTvMode, f as seekStep, i as Route$5, k as looksHls, m as Button, n as engineForKind, o as useRemoteHandler, w as getById } from "./router-Dz9LuctB.mjs";
import { t as neighborInBrowseList } from "./browse-list-Cm4wC9Gf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watch-V1tSaSsS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ASPECT_MODES = [
	{
		id: "contain",
		label: "Fit"
	},
	{
		id: "cover",
		label: "Fill"
	},
	{
		id: "fill",
		label: "Stretch"
	},
	{
		id: "16:9",
		label: "16:9"
	},
	{
		id: "4:3",
		label: "4:3"
	}
];
function playbackCandidates(url, kind = "live", extras = []) {
	const raws = [...extras, url].filter(Boolean);
	const variants = [];
	for (const raw of raws) for (const variant of streamUrlVariants(raw, kind)) if (!variants.includes(variant)) variants.push(variant);
	const candidates = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (source, engine) => {
		const proxied = proxiedStreamUrl(source);
		const key = `${engine}:${proxied}`;
		if (seen.has(key)) return;
		seen.add(key);
		candidates.push({
			url: proxied,
			engine,
			source
		});
	};
	for (const variant of variants) {
		const engine = pickEngine(variant);
		if (kind === "live" && engine === "hls") {
			add(variant, "mpegts");
			add(variant, "hls");
			continue;
		}
		add(variant, engine);
		if (engine === "hls") add(variant, "mpegts");
		if (engine === "native" && looksHls(variant)) add(variant, "hls");
		if (kind === "live" && engine === "native") add(variant, "mpegts");
		if (kind === "live" && engine === "mpegts") add(variant, "hls");
	}
	return candidates;
}
function objectFitFor(mode) {
	if (mode === "cover") return "cover";
	if (mode === "fill") return "fill";
	return "contain";
}
function aspectRatioFor(mode) {
	if (mode === "16:9") return "16 / 9";
	if (mode === "4:3") return "4 / 3";
}
var ASPECT_LS = "vox-iptv-aspect";
var VOLUME_LS = "vox-iptv-volume";
function loadAspect() {
	if (typeof localStorage === "undefined") return "contain";
	const v = localStorage.getItem(ASPECT_LS);
	if (ASPECT_MODES.some((m) => m.id === v)) return v;
	return "contain";
}
function saveAspect(mode) {
	localStorage.setItem(ASPECT_LS, mode);
}
function loadVolume() {
	if (typeof localStorage === "undefined") return 1;
	const v = Number(localStorage.getItem(VOLUME_LS));
	return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}
function saveVolume(volume) {
	localStorage.setItem(VOLUME_LS, String(volume));
}
var LIVE_DROPOUT_RETRIES = 2;
function engineFromProbe(kind, fallback, source) {
	if (kind === "unknown") return fallback;
	return engineForKind(kind, source);
}
function VideoPlayer({ item }) {
	const navigate = useNavigate();
	const videoRef = (0, import_react.useRef)(null);
	const wrapRef = (0, import_react.useRef)(null);
	const hlsRef = (0, import_react.useRef)(null);
	const tsRef = (0, import_react.useRef)(null);
	const reconnectTimer = (0, import_react.useRef)(null);
	const hideTimer = (0, import_react.useRef)(null);
	const attemptRef = (0, import_react.useRef)(0);
	const dropoutRef = (0, import_react.useRef)(0);
	const candidatesRef = (0, import_react.useRef)([]);
	const playingRef = (0, import_react.useRef)(false);
	const tearingDownRef = (0, import_react.useRef)(false);
	const generationRef = (0, import_react.useRef)(0);
	const attachGenRef = (0, import_react.useRef)(0);
	const volumeRef = (0, import_react.useRef)(loadVolume());
	const mutedRef = (0, import_react.useRef)(false);
	const failCurrentRef = (0, import_react.useRef)(() => void 0);
	const [paused, setPaused] = (0, import_react.useState)(false);
	const [buffering, setBuffering] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [reconnecting, setReconnecting] = (0, import_react.useState)(false);
	const [current, setCurrent] = (0, import_react.useState)(0);
	const [duration, setDuration] = (0, import_react.useState)(item.duration ?? 0);
	const [volume, setVolume] = (0, import_react.useState)(volumeRef.current);
	const [muted, setMuted] = (0, import_react.useState)(false);
	const [aspect, setAspect] = (0, import_react.useState)(loadAspect);
	const [chrome, setChrome] = (0, import_react.useState)(true);
	const [fullscreen, setFullscreen] = (0, import_react.useState)(false);
	const [textTracks, setTextTracks] = (0, import_react.useState)([]);
	const [subsOn, setSubsOn] = (0, import_react.useState)(true);
	const [subIndex, setSubIndex] = (0, import_react.useState)(0);
	const [subMenu, setSubMenu] = (0, import_react.useState)(false);
	const [seekFlash, setSeekFlash] = (0, import_react.useState)(null);
	const [playerCtrl, setPlayerCtrl] = (0, import_react.useState)("play");
	const chromeRef = (0, import_react.useRef)(true);
	const seekHoldRef = (0, import_react.useRef)(0);
	const flashTimer = (0, import_react.useRef)(null);
	chromeRef.current = chrome;
	const favKind = item.kind === "live" ? "live" : item.kind === "movie" ? "movie" : "show";
	const favId = item.kind === "episode" ? item.showId || item.id : item.id;
	const [favorited, toggleFav] = useIsFavorite(favKind, favId);
	const destroyEngines = (0, import_react.useCallback)(() => {
		tearingDownRef.current = true;
		try {
			hlsRef.current?.destroy();
		} catch {}
		hlsRef.current = null;
		try {
			tsRef.current?.pause();
			tsRef.current?.unload();
			tsRef.current?.detachMediaElement();
			tsRef.current?.destroy();
		} catch {}
		tsRef.current = null;
		const video = videoRef.current;
		if (video) {
			video.pause();
			video.removeAttribute("src");
			video.srcObject = null;
		}
	}, []);
	const scheduleHide = (0, import_react.useCallback)(() => {
		if (hideTimer.current) window.clearTimeout(hideTimer.current);
		hideTimer.current = window.setTimeout(() => setChrome(false), 3200);
	}, []);
	const bumpChrome = (0, import_react.useCallback)(() => {
		setChrome(true);
		scheduleHide();
	}, [scheduleHide]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video) return;
		const session = ++generationRef.current;
		let cancelled = false;
		playingRef.current = false;
		dropoutRef.current = 0;
		candidatesRef.current = playbackCandidates(item.url, item.kind, item.urls ?? []);
		attemptRef.current = 0;
		const probeCache = /* @__PURE__ */ new Map();
		iptvLog("player", "plan", item.kind, candidatesRef.current.map((c) => `${c.engine}:${redactUrl(c.source)}`).join(" | "));
		const isCurrent = () => !cancelled && generationRef.current === session;
		async function attachEngine(candidate, engine) {
			if (!video || !isCurrent()) return;
			destroyEngines();
			const attachGen = ++attachGenRef.current;
			tearingDownRef.current = false;
			setBuffering(true);
			const url = candidate.url;
			iptvLog("player", "start", engine, redactUrl(candidate.source));
			if (engine === "hls") {
				if (video.canPlayType("application/vnd.apple.mpegurl") && !url.includes("/api/iptv/stream")) video.src = url;
				else {
					const { default: Hls } = await import("../_libs/hls.js.mjs").then((n) => n.t);
					if (!isCurrent() || attachGen !== attachGenRef.current) return;
					if (!Hls.isSupported()) video.src = url;
					else {
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
							manifestLoadingTimeOut: 15e3,
							fragLoadingTimeOut: 2e4,
							xhrSetup(xhr) {
								xhr.withCredentials = false;
							}
						});
						hlsRef.current = hls;
						hls.attachMedia(video);
						hls.loadSource(url);
						hls.on(Hls.Events.MANIFEST_PARSED, () => {
							if (!isCurrent() || attachGen !== attachGenRef.current) return;
							video.play().catch(() => void 0);
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
				const mod = await import("../_libs/mpegts.js.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
				if (!isCurrent() || attachGen !== attachGenRef.current) return;
				const mpeg = mod.default ?? mod;
				if (!mpeg.isSupported()) video.src = url;
				else {
					const player = mpeg.createPlayer({
						type: "mpegts",
						isLive: item.isLive,
						url,
						cors: true
					}, {
						enableWorker: false,
						lazyLoad: false,
						enableStashBuffer: !item.isLive,
						liveBufferLatencyChasing: item.isLive,
						liveBufferLatencyMaxLatency: 8,
						stashInitialSize: 393216,
						autoCleanupSourceBuffer: true,
						fixTimestampOverflow: true
					});
					tsRef.current = player;
					player.attachMediaElement(video);
					player.load();
					player.play();
					player.on(mpeg.Events.ERROR, (...args) => {
						if (!isCurrent() || tearingDownRef.current || attachGen !== attachGenRef.current) return;
						iptvWarn("player", "mpegts error", ...args);
						failCurrentRef.current("MPEG-TS stream error");
					});
				}
			} else video.src = url;
			video.volume = volumeRef.current;
			video.muted = mutedRef.current;
			await video.play().catch(() => void 0);
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
					const delay = Math.min(6e3, 1200 * 2 ** (dropoutRef.current - 1));
					iptvWarn("player", `live dropout retry ${dropoutRef.current}/${LIVE_DROPOUT_RETRIES} in ${delay}ms`);
					setReconnecting(true);
					setError("Connection lost. Reconnecting…");
					attemptRef.current = 0;
					if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
					reconnectTimer.current = window.setTimeout(() => {
						startPlayback();
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
				if (probe.ok && probe.kind !== "unknown") engine = engineFromProbe(probe.kind, candidate.engine, source);
				await attachEngine({
					...candidate,
					engine
				}, engine);
			} catch (err) {
				iptvWarn("player", "start failed", err);
				failCurrentRef.current(err instanceof Error ? err.message : "Could not start playback");
			}
		}
		failCurrentRef.current = (reason) => {
			if (!isCurrent() || tearingDownRef.current) return;
			iptvWarn("player", "candidate failed", reason, "index", attemptRef.current);
			playingRef.current = false;
			attemptRef.current += 1;
			startPlayback();
		};
		startPlayback();
		return () => {
			cancelled = true;
			destroyEngines();
			tearingDownRef.current = false;
			if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
		};
	}, [
		item.url,
		item.isLive,
		item.kind,
		item.urls,
		destroyEngines
	]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video || item.isLive) return;
		const resume = async () => {
			const progress = await getById("progress", `${item.kind}:${item.id}`);
			if (progress && progress.position > 8 && progress.position < progress.duration * .95) {
				video.currentTime = progress.position;
				setCurrent(progress.position);
				if (progress.duration) setDuration(progress.duration);
			}
		};
		video.addEventListener("loadedmetadata", resume);
		return () => video.removeEventListener("loadedmetadata", resume);
	}, [
		item.id,
		item.isLive,
		item.kind
	]);
	(0, import_react.useEffect)(() => {
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
	}, [
		item.isLive,
		subIndex,
		subsOn
	]);
	(0, import_react.useEffect)(() => {
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
				updatedAt: Date.now()
			}).catch(() => void 0);
		}, 5e3);
		return () => window.clearInterval(id);
	}, [item]);
	function togglePlay() {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) video.play();
		else video.pause();
	}
	function leavePlayer() {
		if (item.kind === "episode" && item.showId) {
			navigate({
				to: "/shows/$showId",
				params: { showId: item.showId }
			});
			return;
		}
		if (item.kind === "live") {
			navigate({ to: "/live" });
			return;
		}
		navigate({ to: "/movies" });
	}
	function flashSeek(label) {
		if (flashTimer.current) window.clearTimeout(flashTimer.current);
		setSeekFlash(label);
		bumpChrome();
		flashTimer.current = window.setTimeout(() => setSeekFlash(null), 800);
	}
	function skipLive(dir) {
		if (!item.isLive) return false;
		const next = neighborInBrowseList(item.id, dir);
		if (!next || next === item.id) return false;
		navigate({
			to: "/watch",
			search: {
				kind: "live",
				id: next
			}
		});
		return true;
	}
	const bottomCtrls = [
		"play",
		"rewind",
		"forward",
		"mute",
		"subs",
		"aspect",
		"full"
	];
	const topCtrls = ["back", "fav"];
	const playerCtrlRef = (0, import_react.useRef)(playerCtrl);
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
	}, [
		subMenu,
		item.kind,
		item.showId
	]);
	useRemoteHandler((event) => {
		const action = event.action;
		const video = videoRef.current;
		if (!video) return false;
		if (action === "back") return false;
		enableTvMode();
		const doSeek = (dir) => {
			if (event.repeat) seekHoldRef.current += 1;
			else seekHoldRef.current = 0;
			const step = seekStep(seekHoldRef.current) * dir;
			if (!seekBy(step) && item.isLive) {
				flashSeek(skipLive(dir) ? dir > 0 ? "Next channel" : "Previous channel" : "Live");
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
			if (item.isLive) flashSeek(skipLive(-1) ? "Previous channel" : "Live");
			else doSeek(-1);
			return true;
		}
		if (action === "next") {
			if (item.isLive) flashSeek(skipLive(1) ? "Next channel" : "Live");
			else doSeek(1);
			return true;
		}
		if (action === "playpause" || action === "play" || action === "pause" || action === "stop") {
			if (action === "play") video.play();
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
				setPlayerCtrl(other[0]);
				return true;
			}
			const i = row.indexOf(current);
			const next = action === "left" ? Math.max(0, i - 1) : Math.min(row.length - 1, i + 1);
			setPlayerCtrl(row[next] ?? current);
			return true;
		}
		if (action === "select") {
			bumpChrome();
			document.querySelector(`[data-player-ctrl="${playerCtrlRef.current}"]`)?.click();
			return true;
		}
		return false;
	}, [
		bumpChrome,
		item.isLive,
		item.id
	]);
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
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
	(0, import_react.useEffect)(() => {
		if (!chrome) return;
		document.querySelector(`[data-player-ctrl="${playerCtrl}"]`)?.focus();
	}, [playerCtrl, chrome]);
	function seekBy(delta) {
		const video = videoRef.current;
		if (!video) return false;
		const ranges = video.seekable;
		let min = 0;
		let max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : video.currentTime;
		if (ranges && ranges.length > 0) {
			min = ranges.start(0);
			max = ranges.end(ranges.length - 1);
		} else if (item.isLive) return false;
		const next = Math.max(min, Math.min(max, video.currentTime + delta));
		if (!Number.isFinite(next)) return false;
		video.currentTime = next;
		setCurrent(next);
		return true;
	}
	function onSeek(value) {
		const video = videoRef.current;
		if (!video || item.isLive) return;
		video.currentTime = value;
		setCurrent(value);
	}
	function changeVolume(v) {
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
			document.exitFullscreen();
			setFullscreen(false);
		} else {
			el.requestFullscreen().catch(() => void 0);
			setFullscreen(true);
		}
	}
	function cycleAspect() {
		const next = ASPECT_MODES[(ASPECT_MODES.findIndex((m) => m.id === aspect) + 1) % ASPECT_MODES.length]?.id ?? "contain";
		setAspect(next);
		saveAspect(next);
	}
	function applySubs(on, index = subIndex) {
		setSubsOn(on);
		setSubIndex(index);
		textTracks.forEach((t, i) => {
			t.mode = on && i === index ? "showing" : "disabled";
		});
	}
	const fit = objectFitFor(aspect);
	const ratio = aspectRatioFor(aspect);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: "relative h-dvh w-full overflow-hidden bg-bg",
		onMouseMove: bumpChrome,
		onClick: bumpChrome,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				ref: videoRef,
				className: "absolute inset-0 m-auto size-full bg-bg",
				style: {
					objectFit: fit,
					aspectRatio: ratio
				},
				playsInline: true,
				autoPlay: true,
				tabIndex: -1,
				preload: "auto",
				onDoubleClick: toggleFullscreen
			}),
			(buffering || reconnecting) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 flex items-center justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-12 animate-spin rounded-full border-2 border-fg/20 border-t-accent" })
			}),
			seekFlash && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 flex items-center justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-md bg-elevated px-5 py-3 font-display text-3xl font-semibold tabular-nums shadow-[var(--shadow-poster)]",
					children: seekFlash
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-bg/50 transition-opacity duration-200", chrome ? "opacity-100" : "pointer-events-none opacity-0"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 p-4 md:p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "Back",
							"data-player-ctrl": "back",
							onClick: () => leavePlayer(),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "truncate font-display text-lg font-semibold",
								children: item.title
							}), item.subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm text-muted",
								children: item.subtitle
							})]
						}),
						item.isLive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-sm bg-accent px-2 py-1 text-xs font-semibold tracking-wide text-accent-fg",
							children: "LIVE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "Favorite",
							"data-player-ctrl": "fav",
							onClick: toggleFav,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: cn("size-5", favorited && "fill-accent text-accent") })
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 md:p-6",
					children: [
						!item.isLive && duration > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: 0,
							max: duration,
							step: .25,
							value: Math.min(current, duration),
							onChange: (e) => onSeek(Number(e.target.value)),
							className: "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-fg/20 accent-accent"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "icon",
									"aria-label": paused ? "Play" : "Pause",
									"data-player-ctrl": "play",
									onClick: togglePlay,
									children: paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "ml-0.5 size-5 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-5 fill-current" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "icon",
									"aria-label": "Rewind",
									"data-player-ctrl": "rewind",
									onClick: () => {
										flashSeek(seekBy(-10) ? "-10s" : item.isLive ? skipLive(-1) ? "Previous channel" : "Live" : "-10s");
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rewind, { className: "size-5 fill-current" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "icon",
									"aria-label": "Fast forward",
									"data-player-ctrl": "forward",
									onClick: () => {
										flashSeek(seekBy(10) ? "+10s" : item.isLive ? skipLive(1) ? "Next channel" : "Live" : "+10s");
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FastForward, { className: "size-5 fill-current" })
								}),
								!item.isLive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "px-2 text-xs tabular-nums text-muted",
									children: [
										formatDuration(current),
										" / ",
										formatDuration(duration)
									]
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ml-1 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										size: "icon",
										"aria-label": muted ? "Unmute" : "Mute",
										"data-player-ctrl": "mute",
										onClick: () => {
											const video = videoRef.current;
											if (!video) return;
											video.muted = !video.muted;
											mutedRef.current = video.muted;
											setMuted(video.muted);
										},
										children: muted || volume === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-5" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "range",
										min: 0,
										max: 1,
										step: .02,
										value: muted ? 0 : volume,
										onChange: (e) => changeVolume(Number(e.target.value)),
										className: "hidden w-24 accent-accent sm:block",
										"aria-label": "Volume"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ml-auto flex items-center gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon",
												"aria-label": "Subtitles",
												"data-player-ctrl": "subs",
												onClick: () => {
													if (textTracks.length === 0) {
														applySubs(!subsOn);
														return;
													}
													setSubMenu((v) => !v);
												},
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Captions, { className: cn("size-5", subsOn && textTracks.length > 0 && "text-accent") })
											}), subMenu && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "absolute right-0 bottom-12 w-48 rounded-md bg-elevated p-1 shadow-[var(--shadow-border)]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: "flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface",
													onClick: () => {
														applySubs(false);
														setSubMenu(false);
													},
													children: "Off"
												}), textTracks.map((track, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: cn("flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface", subsOn && subIndex === i && "text-accent"),
													onClick: () => {
														applySubs(true, i);
														setSubMenu(false);
													},
													children: track.label || track.language || `Track ${i + 1}`
												}, track.language || track.label || i))]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "sm",
											"data-player-ctrl": "aspect",
											onClick: cycleAspect,
											children: ASPECT_MODES.find((m) => m.id === aspect)?.label
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "icon",
											"aria-label": fullscreen ? "Exit full screen" : "Full screen",
											"data-player-ctrl": "full",
											onClick: toggleFullscreen,
											children: fullscreen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize, { className: "size-5" })
										})
									]
								})
							]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-accent",
							children: error
						})
					]
				})]
			})
		]
	});
}
function WatchPage() {
	const { kind, id } = Route$5.useSearch();
	const navigate = useNavigate();
	const [item, setItem] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			const playable = await resolvePlayable(kind, id);
			if (!live) return;
			if (!playable) {
				setError("This title is no longer in your library.");
				return;
			}
			if (!playable.isLive) {
				const progress = await getById("progress", `${playable.kind}:${playable.id}`);
				if (progress && progress.position > 8) playable.duration = progress.duration;
			}
			setItem(playable);
		})().catch(() => setError("Could not load this stream."));
		return () => {
			live = false;
		};
	}, [kind, id]);
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: error
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "secondary",
			onClick: () => navigate({ to: "/" }),
			children: "Back home"
		})]
	});
	if (!item) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "flex min-h-dvh items-center justify-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-10 animate-spin rounded-full border-2 border-fg/20 border-t-accent" })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VideoPlayer, { item });
}
//#endregion
export { WatchPage as component };
