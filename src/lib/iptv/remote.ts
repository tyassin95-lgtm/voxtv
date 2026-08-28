export type RemoteAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "back"
  | "playpause"
  | "play"
  | "pause"
  | "stop"
  | "rewind"
  | "forward"
  | "prev"
  | "next"
  | "menu"
  | "info"
  | "pageup"
  | "pagedown";

export type RemoteRole = "ui" | "player" | "keyboard";

export type RemoteSource = "key" | "gamepad";

export interface RemoteEvent {
  action: RemoteAction;
  repeat: boolean;
  source: RemoteSource;
  key?: string;
  keyCode?: number;
}

const KEY_TO_ACTION: Record<string, RemoteAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Up: "up",
  Down: "down",
  Left: "left",
  Right: "right",
  UIKeyInputUpArrow: "up",
  UIKeyInputDownArrow: "down",
  UIKeyInputLeftArrow: "left",
  UIKeyInputRightArrow: "right",
  Enter: "select",
  NumpadEnter: "select",
  Select: "select",
  DPAD_CENTER: "select",
  Escape: "back",
  Esc: "back",
  BrowserBack: "back",
  GoBack: "back",
  Back: "back",
  MediaPlayPause: "playpause",
  MediaPlay: "play",
  MediaPause: "pause",
  MediaStop: "stop",
  MediaRewind: "rewind",
  MediaFastForward: "forward",
  MediaTrackPrevious: "prev",
  MediaTrackNext: "next",
  MediaSkipBackward: "rewind",
  MediaSkipForward: "forward",
  Rewind: "rewind",
  FastForward: "forward",
  ChannelUp: "pageup",
  ChannelDown: "pagedown",
  PageUp: "pageup",
  PageDown: "pagedown",
  AudioVolumeMute: "playpause",
  ContextMenu: "menu",
  Info: "info",
  Guide: "info",
  F1: "info",
};

const CODE_TO_ACTION: Record<string, RemoteAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "select",
  NumpadEnter: "select",
  Escape: "back",
  PageUp: "pageup",
  PageDown: "pagedown",
  MediaPlayPause: "playpause",
  MediaPlay: "play",
  MediaPause: "pause",
  MediaStop: "stop",
  MediaRewind: "rewind",
  MediaFastForward: "forward",
  MediaTrackPrevious: "prev",
  MediaTrackNext: "next",
};

/**
 * Android / Fire TV / Chromium keyCodes seen in Silk, Android WebView, and
 * Leanback. Media keys often arrive as key="Unidentified" with only a code.
 */
const KEYCODE_TO_ACTION: Record<number, RemoteAction> = {
  4: "back",
  13: "select",
  19: "up",
  20: "down",
  21: "left",
  22: "right",
  23: "select",
  27: "back",
  33: "pageup",
  34: "pagedown",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  66: "select",
  82: "menu",
  85: "playpause",
  86: "stop",
  87: "next",
  88: "prev",
  89: "rewind",
  90: "forward",
  92: "pageup",
  93: "pagedown",
  96: "select",
  97: "back",
  102: "rewind",
  103: "forward",
  104: "rewind",
  105: "forward",
  111: "back",
  126: "play",
  127: "pause",
  166: "pageup",
  167: "pagedown",
  165: "info",
  170: "info",
  172: "info",
  175: "info",
  176: "rewind",
  177: "forward",
  178: "stop",
  179: "playpause",
  183: "rewind",
  184: "forward",
  204: "playpause",
  227: "rewind",
  228: "forward",
  272: "forward",
  273: "rewind",
  274: "forward",
  275: "rewind",
};

const GAMEPAD_BUTTON_ACTION: Record<number, RemoteAction> = {
  0: "select",
  1: "back",
  2: "info",
  3: "menu",
  4: "rewind",
  5: "forward",
  6: "rewind",
  7: "forward",
  8: "rewind",
  9: "menu",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

export interface KeyLike {
  key?: string;
  code?: string;
  keyCode?: number;
  which?: number;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const DPAD_ACTIONS = new Set<RemoteAction>(["up", "down", "left", "right", "select"]);
const MEDIA_ACTIONS = new Set<RemoteAction>([
  "playpause",
  "play",
  "pause",
  "stop",
  "rewind",
  "forward",
  "prev",
  "next",
]);

export function actionFromKey(event: KeyLike, role: RemoteRole = "ui"): RemoteAction | null {
  if (event.ctrlKey || event.metaKey) return null;
  const key = event.key ?? "";
  const code = event.code ?? "";
  const keyCode = event.keyCode || event.which || 0;

  if (role === "keyboard") {
    if (key === "Backspace" || keyCode === 8) return "back";
    if (key === "Tab") return null;
  }

  if (
    role === "player" &&
    (key === " " || key === "Spacebar" || code === "Space" || keyCode === 32)
  ) {
    return "playpause";
  }
  if (role === "ui" && (key === " " || key === "Spacebar" || code === "Space" || keyCode === 32)) {
    return "select";
  }

  if (key && key !== "Unidentified" && KEY_TO_ACTION[key]) return KEY_TO_ACTION[key];
  if (code && CODE_TO_ACTION[code]) return CODE_TO_ACTION[code];
  if (keyCode && KEYCODE_TO_ACTION[keyCode]) return KEYCODE_TO_ACTION[keyCode];
  return null;
}

export function parseRemoteEvent(
  event: KeyboardEvent,
  role: RemoteRole = "ui",
): RemoteAction | null {
  return actionFromKey(event, role);
}

export function isTvUserAgent(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
): boolean {
  return /AFT|AFTA|AFTN|AFTT|AFTM|AFTB|AFTS|AFTK|AFTKA|Silk\/|Android TV|SMART-TV|SmartTV|TV Safari|Web0S|Tizen|Bravia|CrKey|GoogleTV|HbbTV|PlayStation|Xbox|Viera|NetCast|AppleTV|Vidaa|Hisense|FireTV|FTV|BRAVIA|MiTV|Plex|Homatics|Nvidia Shield/i.test(
    ua,
  );
}

export function isTvDevice(): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("tv-mode")) {
    return true;
  }
  return isTvUserAgent();
}

export function enableTvMode() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("tv-mode");
}

export function isDpadAction(action: RemoteAction | null): boolean {
  return action !== null && DPAD_ACTIONS.has(action);
}

export function isMediaAction(action: RemoteAction | null): boolean {
  return action !== null && MEDIA_ACTIONS.has(action);
}

export function moveGridIndex(
  index: number,
  columns: number,
  count: number,
  dir: "up" | "down" | "left" | "right",
): number {
  if (count <= 0) return 0;
  const cols = Math.max(1, columns);
  const current = Math.max(0, Math.min(count - 1, index));
  const row = Math.floor(current / cols);
  const col = current % cols;
  const lastRow = Math.floor((count - 1) / cols);
  if (dir === "left") {
    if (col === 0) return current;
    return current - 1;
  }
  if (dir === "right") {
    if (current + 1 >= count) return current;
    if (col === cols - 1) return current;
    return current + 1;
  }
  if (dir === "up") {
    if (row === 0) return current;
    return (row - 1) * cols + col;
  }
  const next = (row + 1) * cols + col;
  if (row >= lastRow) return current;
  return Math.min(count - 1, next);
}

export function seekStep(repeatCount: number): number {
  if (repeatCount > 12) return 60;
  if (repeatCount > 4) return 30;
  return 10;
}

export function isPrintableKey(event: KeyLike): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key ?? "";
  if (key.length !== 1) return null;
  if (key === " ") return " ";
  return key;
}

const AXIS_DEADZONE = 0.55;

export interface GamepadHoldState {
  action: RemoteAction | null;
  since: number;
  last: number;
}

export function emptyGamepadHold(): GamepadHoldState {
  return { action: null, since: 0, last: 0 };
}

function axisAction(pad: Gamepad): RemoteAction | null {
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (Math.abs(x) < AXIS_DEADZONE && Math.abs(y) < AXIS_DEADZONE) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}

export function readGamepadAction(
  pad: Gamepad,
  prevButtons: boolean[],
  now: number,
  hold: GamepadHoldState,
): { action: RemoteAction | null; buttons: boolean[]; hold: GamepadHoldState } {
  const buttons = pad.buttons.map((button) => button.pressed || button.value > 0.5);
  let edge: RemoteAction | null = null;
  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i] && !prevButtons[i]) {
      const mapped = GAMEPAD_BUTTON_ACTION[i];
      if (mapped) {
        edge = mapped;
        break;
      }
    }
  }
  if (!edge) {
    const fromAxis = axisAction(pad);
    const axisWas =
      (prevButtons[12] && hold.action === "up") ||
      (prevButtons[13] && hold.action === "down") ||
      (prevButtons[14] && hold.action === "left") ||
      (prevButtons[15] && hold.action === "right");
    if (fromAxis && !axisWas && hold.action !== fromAxis) edge = fromAxis;
  }

  const pressed =
    edge ??
    (buttons[12]
      ? "up"
      : buttons[13]
        ? "down"
        : buttons[14]
          ? "left"
          : buttons[15]
            ? "right"
            : axisAction(pad));

  let action: RemoteAction | null = null;
  let nextHold = hold;
  if (edge) {
    action = edge;
    nextHold = { action: edge, since: now, last: now };
  } else if (pressed && isDpadAction(pressed) && hold.action === pressed) {
    const held = now - hold.since;
    if (held > 380 && now - hold.last > 85) {
      action = pressed;
      nextHold = { ...hold, last: now };
    }
  } else if (!pressed) {
    nextHold = emptyGamepadHold();
  }

  return { action, buttons, hold: nextHold };
}

export function gamepadButtonAction(index: number): RemoteAction | null {
  return GAMEPAD_BUTTON_ACTION[index] ?? null;
}

let lastAccepted = { action: "" as RemoteAction | "", at: 0 };

export function resetRemoteDedupe() {
  lastAccepted = { action: "", at: 0 };
}

export function acceptRemoteAction(
  action: RemoteAction | null,
  repeat = false,
): RemoteAction | null {
  if (!action) return null;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const minGap = repeat ? 70 : 24;
  if (lastAccepted.action === action && now - lastAccepted.at < minGap) return null;
  lastAccepted = { action, at: now };
  return action;
}

export function focusTvIndex(index: number, attempts = 10) {
  const tryFocus = (left: number) => {
    const el = document.querySelector<HTMLElement>(`[data-tv-index="${index}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    if (left > 0) requestAnimationFrame(() => tryFocus(left - 1));
  };
  tryFocus(attempts);
}

type Dir = "up" | "down" | "left" | "right";

export function findNextInDirection(
  origin: DOMRect,
  candidates: { el: HTMLElement; rect: DOMRect }[],
  dir: Dir,
): HTMLElement | null {
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const { el, rect } of candidates) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - ox;
    const dy = y - oy;
    let primary = 0;
    let secondary = 0;
    if (dir === "right") {
      if (rect.left < origin.right - 8) continue;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (dir === "left") {
      if (rect.right > origin.left + 8) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (dir === "down") {
      if (rect.top < origin.bottom - 8) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else {
      if (rect.bottom > origin.top + 8) continue;
      primary = -dy;
      secondary = Math.abs(dx);
    }
    if (primary <= 0) continue;
    const overlap =
      dir === "left" || dir === "right"
        ? Math.min(origin.bottom, rect.bottom) - Math.max(origin.top, rect.top)
        : Math.min(origin.right, rect.right) - Math.max(origin.left, rect.left);
    const aligned = overlap > 4 ? 0 : 1;
    const score = primary + secondary * (aligned ? 4 : 0.6);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Every element the d-pad may land on when a screen has no handler of its own.
 * Plain buttons and links count: the favourites tabs and the settings actions
 * are ordinary buttons, and leaving them out sent every left/right press up to
 * the header nav instead.
 */
const FOCUSABLE_SELECTOR = [
  "[data-tv-node]",
  "[data-tv-index]",
  "[data-tv-zone]",
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function spatialNavigate(dir: Dir): boolean {
  if (typeof document === "undefined") return false;
  const nodes = [...document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => {
    if (el.closest("[data-kb-root]")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // Off-screen rows of a virtualised list are not somewhere to jump to.
    return rect.bottom > -200 && rect.top < window.innerHeight + 200;
  });
  if (!nodes.length) return false;
  const active = document.activeElement as HTMLElement | null;
  const current =
    active && nodes.includes(active)
      ? active
      : (nodes.find((el) => el.tabIndex === 0) ?? nodes[0]!);
  const origin = current.getBoundingClientRect();
  const next = findNextInDirection(
    origin,
    nodes.filter((el) => el !== current).map((el) => ({ el, rect: el.getBoundingClientRect() })),
    dir,
  );
  if (!next) return false;
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}
