import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { neighborInBrowseList, rememberBrowseList } from "./browse-list.ts";
import {
  acceptRemoteAction,
  actionFromKey,
  findNextInDirection,
  gamepadButtonAction,
  isTvUserAgent,
  moveGridIndex,
  resetRemoteDedupe,
  seekStep,
} from "./remote.ts";
import { buildRows, moveKey } from "./keyboard-layout.ts";

describe("remote key mapping", () => {
  it("maps arrow keys and Fire TV d-pad keyCodes", () => {
    assert.equal(actionFromKey({ key: "ArrowDown" }), "down");
    assert.equal(actionFromKey({ key: "Down" }), "down");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 20 }), "down");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 19 }), "up");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 21 }), "left");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 22 }), "right");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 23 }), "select");
    assert.equal(actionFromKey({ keyCode: 4 }), "back");
    assert.equal(actionFromKey({ key: "Enter" }), "select");
  });

  it("maps Silk media keys that arrive as Unidentified", () => {
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 89 }), "rewind");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 90 }), "forward");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 227 }), "rewind");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 228 }), "forward");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 179 }), "playpause");
    assert.equal(actionFromKey({ key: "Unidentified", keyCode: 85 }), "playpause");
    assert.equal(actionFromKey({ key: "MediaRewind" }), "rewind");
    assert.equal(actionFromKey({ key: "MediaFastForward" }), "forward");
  });

  it("does not treat Backspace as back in the ui role", () => {
    assert.equal(actionFromKey({ key: "Backspace", keyCode: 8 }, "ui"), null);
    assert.equal(actionFromKey({ key: "Backspace", keyCode: 8 }, "keyboard"), "back");
  });

  it("maps space by role", () => {
    assert.equal(actionFromKey({ key: " " }, "ui"), "select");
    assert.equal(actionFromKey({ key: " " }, "player"), "playpause");
  });

  it("ignores modifier shortcuts", () => {
    assert.equal(actionFromKey({ key: "ArrowDown", ctrlKey: true }), null);
    assert.equal(actionFromKey({ key: "ArrowDown", metaKey: true }), null);
  });
});

describe("grid movement", () => {
  it("stays at edges and wraps within a row", () => {
    assert.equal(moveGridIndex(0, 4, 10, "left"), 0);
    assert.equal(moveGridIndex(0, 4, 10, "up"), 0);
    assert.equal(moveGridIndex(0, 4, 10, "right"), 1);
    assert.equal(moveGridIndex(3, 4, 10, "right"), 3);
    assert.equal(moveGridIndex(1, 4, 10, "down"), 5);
    assert.equal(moveGridIndex(9, 4, 10, "down"), 9);
    assert.equal(moveGridIndex(8, 4, 10, "right"), 9);
  });
});

describe("seek acceleration", () => {
  it("steps 10 then 30 then 60", () => {
    assert.equal(seekStep(0), 10);
    assert.equal(seekStep(5), 30);
    assert.equal(seekStep(13), 60);
  });
});

describe("tv detection", () => {
  it("recognizes Fire Stick and Android TV user agents", () => {
    assert.equal(
      isTvUserAgent(
        "Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233) AppleWebKit/537.36 (KHTML, like Gecko) Silk/44.1.54 like Chrome/44.0.2403.63 Safari/537.36",
      ),
      true,
    );
    assert.equal(isTvUserAgent("Mozilla/5.0 (Linux; Android 11; SHIELD Android TV)"), true);
    assert.equal(isTvUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"), false);
  });
});

describe("gamepad mapping", () => {
  it("maps standard TV remote buttons", () => {
    assert.equal(gamepadButtonAction(0), "select");
    assert.equal(gamepadButtonAction(1), "back");
    assert.equal(gamepadButtonAction(12), "up");
    assert.equal(gamepadButtonAction(13), "down");
    assert.equal(gamepadButtonAction(6), "rewind");
    assert.equal(gamepadButtonAction(7), "forward");
  });
});

describe("action dedupe", () => {
  it("drops duplicate presses in the same frame", () => {
    resetRemoteDedupe();
    assert.equal(acceptRemoteAction("down", false), "down");
    assert.equal(acceptRemoteAction("down", false), null);
    resetRemoteDedupe();
    assert.equal(acceptRemoteAction("down", false), "down");
    assert.equal(acceptRemoteAction("right", false), "right");
  });
});

describe("spatial search", () => {
  it("picks the nearest candidate in that direction", () => {
    const origin = { left: 0, right: 40, top: 0, bottom: 40, width: 40, height: 40 } as DOMRect;
    const right = { el: { id: "r" } as unknown as HTMLElement, rect: { left: 80, right: 120, top: 0, bottom: 40, width: 40, height: 40 } as DOMRect };
    const down = { el: { id: "d" } as unknown as HTMLElement, rect: { left: 0, right: 40, top: 80, bottom: 120, width: 40, height: 40 } as DOMRect };
    assert.equal(findNextInDirection(origin, [right, down], "right")?.id, "r");
    assert.equal(findNextInDirection(origin, [right, down], "down")?.id, "d");
    assert.equal(findNextInDirection(origin, [right, down], "left"), null);
  });
});

describe("browse list neighbors", () => {
  it("wraps live channel skip", () => {
    rememberBrowseList("live", ["a", "b", "c"]);
    assert.equal(neighborInBrowseList("b", 1), "c");
    assert.equal(neighborInBrowseList("c", 1), "a");
    assert.equal(neighborInBrowseList("a", -1), "c");
  });
});

describe("on-screen keyboard", () => {
  it("moves between weighted action keys", () => {
    const rows = [
      [{ id: "q", label: "Q", char: "q" }, { id: "w", label: "W", char: "w" }, { id: "e", label: "E", char: "e" }],
      [
        { id: "mode", label: "123", action: "mode" as const, grow: 1 },
        { id: "space", label: "Space", action: "space" as const, grow: 3 },
        { id: "done", label: "Done", action: "done" as const, grow: 1 },
      ],
    ];
    assert.deepEqual(moveKey(rows, 0, 1, "down"), { row: 1, col: 0 });
    assert.deepEqual(moveKey(rows, 0, 2, "down"), { row: 1, col: 1 });
    assert.deepEqual(moveKey(rows, 1, 1, "left"), { row: 1, col: 0 });
    assert.deepEqual(moveKey(rows, 0, 0, "left"), { row: 0, col: 0 });
  });

  it("includes English, Arabic, and symbol pages", () => {
    const en = buildRows("en", "letters");
    const ar = buildRows("ar", "letters");
    const arSym = buildRows("ar", "symbols");
    assert.ok(en[1]?.some((key) => "char" in key && key.char === "q"));
    assert.ok(ar[1]?.some((key) => "char" in key && key.char === "ض"));
    assert.ok(ar[1]?.some((key) => "char" in key && key.char === "د"));
    assert.ok(ar[3]?.some((key) => "char" in key && key.char === "ذ"));
    assert.ok(arSym[0]?.some((key) => "char" in key && key.char === "١"));
    assert.ok(arSym[2]?.some((key) => "char" in key && key.char === "،"));
  });
});
