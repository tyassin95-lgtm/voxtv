import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import {
  acceptRemoteAction,
  actionFromKey,
  enableTvMode,
  emptyGamepadHold,
  isDpadAction,
  isMediaAction,
  isTvUserAgent,
  readGamepadAction,
  spatialNavigate,
  type GamepadHoldState,
  type RemoteAction,
  type RemoteEvent,
} from "@/lib/iptv/remote";

type BackHandler = () => boolean;
type RemoteHandler = (event: RemoteEvent) => boolean;

const BackContext = createContext<(handler: BackHandler) => () => void>(() => () => undefined);
const RemoteContext = createContext<(handler: RemoteHandler) => () => void>(() => () => undefined);

export function useBackHandler(handler: BackHandler, deps: unknown[] = []) {
  const register = useContext(BackContext);
  useEffect(() => register(handler), [register, ...deps]);
}

export function useRemoteHandler(handler: RemoteHandler, deps: unknown[] = []) {
  const register = useContext(RemoteContext);
  useEffect(() => register(handler), [register, ...deps]);
}

export function RemoteRoot({ children }: { children: React.ReactNode }) {
  const backHandlers = useRef<BackHandler[]>([]);
  const remoteHandlers = useRef<RemoteHandler[]>([]);
  const armed = useRef(false);
  const downActions = useRef(new Set<RemoteAction>());
  const padButtons = useRef<boolean[][]>([]);
  const padHold = useRef<GamepadHoldState[]>([]);

  const registerBack = useCallback((handler: BackHandler) => {
    backHandlers.current.push(handler);
    return () => {
      backHandlers.current = backHandlers.current.filter((entry) => entry !== handler);
    };
  }, []);

  const registerRemote = useCallback((handler: RemoteHandler) => {
    remoteHandlers.current.push(handler);
    return () => {
      remoteHandlers.current = remoteHandlers.current.filter((entry) => entry !== handler);
    };
  }, []);

  const dispatchBack = useCallback(() => {
    const stack = backHandlers.current;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]?.()) return true;
    }
    return false;
  }, []);

  const dispatchRemote = useCallback((event: RemoteEvent, original?: KeyboardEvent) => {
    const action = acceptRemoteAction(event.action, event.repeat);
    if (!action) return false;
    const payload = { ...event, action };
    for (let i = remoteHandlers.current.length - 1; i >= 0; i--) {
      if (remoteHandlers.current[i]?.(payload)) {
        original?.preventDefault();
        original?.stopPropagation();
        return true;
      }
    }
    if (action === "up" || action === "down" || action === "left" || action === "right") {
      const moved = spatialNavigate(action);
      if (moved) {
        original?.preventDefault();
        original?.stopPropagation();
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    if (isTvUserAgent()) enableTvMode();
    const arm = () => {
      if (armed.current || typeof history === "undefined") return;
      try {
        history.pushState({ voxRemote: 1 }, "", window.location.href);
        armed.current = true;
      } catch {
        /* ignore */
      }
    };
    arm();

    const onPop = () => {
      armed.current = false;
      const consumed = dispatchBack();
      arm();
      if (consumed) return;
    };

    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const action = actionFromKey(event, "ui");
      if (!action) return;
      if (isDpadAction(action) || isMediaAction(action)) enableTvMode();
      downActions.current.add(action);
      if (action === "back") {
        if (isEditable(event.target)) return;
        event.preventDefault();
        if (dispatchBack()) event.stopPropagation();
        return;
      }
      if (isEditable(event.target) && !isMediaAction(action)) return;
      dispatchRemote(
        { action, repeat: event.repeat, source: "key", key: event.key, keyCode: event.keyCode || event.which },
        event,
      );
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const action = actionFromKey(event, "ui");
      if (!action) return;
      const seen = downActions.current.has(action);
      downActions.current.delete(action);
      if (seen || event.isComposing) return;
      if (isEditable(event.target) && !isMediaAction(action)) return;
      if (action === "back") {
        event.preventDefault();
        if (dispatchBack()) event.stopPropagation();
        return;
      }
      dispatchRemote(
        { action, repeat: false, source: "key", key: event.key, keyCode: event.keyCode || event.which },
        event,
      );
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [dispatchBack, dispatchRemote]);

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
      const now = performance.now();
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!pad) continue;
        const prev = padButtons.current[i] ?? [];
        const hold = padHold.current[i] ?? emptyGamepadHold();
        const result = readGamepadAction(pad, prev, now, hold);
        padButtons.current[i] = result.buttons;
        padHold.current[i] = result.hold;
        if (!result.action) continue;
        enableTvMode();
        if (result.action === "back") {
          dispatchBack();
          continue;
        }
        dispatchRemote({
          action: result.action,
          repeat: result.hold.last !== result.hold.since && result.hold.action === result.action,
          source: "gamepad",
        });
      }
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(poll);
    };
    window.addEventListener("gamepadconnected", start);
    start();
    return () => {
      window.removeEventListener("gamepadconnected", start);
      cancelAnimationFrame(raf);
    };
  }, [dispatchBack, dispatchRemote]);

  return (
    <BackContext.Provider value={registerBack}>
      <RemoteContext.Provider value={registerRemote}>{children}</RemoteContext.Provider>
    </BackContext.Provider>
  );
}
