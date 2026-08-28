import type { RemoteAction } from "./remote.ts";

export type KeyboardLang = "en" | "ar";

export type KeyDef =
  | { id: string; label: string; char: string; grow?: number; rtl?: boolean }
  | { id: string; label: string; action: "backspace" | "space" | "clear" | "lang" | "done" | "mode"; grow?: number };

const EN_LETTERS: KeyDef[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((c) => ({ id: c, label: c, char: c })),
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"].map((c) => ({
    id: c,
    label: c.toUpperCase(),
    char: c,
  })),
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"].map((c) => ({
    id: c,
    label: c.toUpperCase(),
    char: c,
  })),
  ["z", "x", "c", "v", "b", "n", "m"].map((c) => ({ id: c, label: c.toUpperCase(), char: c })),
];

const EN_SYMBOLS: KeyDef[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((c) => ({ id: `s${c}`, label: c, char: c })),
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'].map((c) => ({ id: c, label: c, char: c })),
  ["#", "%", "!", "?", ".", ",", "'", "*", "+", "="].map((c) => ({ id: c, label: c, char: c })),
];

const AR_LETTERS: KeyDef[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((c) => ({ id: `ar${c}`, label: c, char: c })),
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"].map((c) => ({
    id: c,
    label: c,
    char: c,
    rtl: true,
  })),
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"].map((c) => ({
    id: c,
    label: c,
    char: c,
    rtl: true,
  })),
  ["ئ", "ء", "ؤ", "ر", "لا", "ى", "ة", "و", "ز", "ظ", "ذ"].map((c) => ({
    id: c,
    label: c,
    char: c,
    rtl: true,
  })),
];

const AR_SYMBOLS: KeyDef[][] = [
  ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠"].map((c) => ({ id: `ind${c}`, label: c, char: c, rtl: true })),
  ["آ", "أ", "إ", "ة", "ى", "و", "ي", "ء", "ؤ", "ئ"].map((c) => ({ id: `ham${c}`, label: c, char: c, rtl: true })),
  ["،", "؛", "؟", "!", ".", ":", '"', "'", "-", "_"].map((c) => ({ id: `p${c}`, label: c, char: c })),
];

export const LANG_LS = "vox-iptv-kb-lang";

export function loadKeyboardLang(): KeyboardLang {
  if (typeof localStorage === "undefined") return "en";
  return localStorage.getItem(LANG_LS) === "ar" ? "ar" : "en";
}

export function saveKeyboardLang(lang: KeyboardLang) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LANG_LS, lang);
}

function actionRow(lang: KeyboardLang, mode: "letters" | "symbols"): KeyDef[] {
  return [
    { id: "mode", label: mode === "letters" ? "123" : lang === "ar" ? "أبجد" : "ABC", action: "mode", grow: 1.2 },
    {
      id: "lang",
      label: lang === "ar" ? "EN" : "العربية",
      action: "lang",
      grow: 1.5,
    },
    { id: "space", label: lang === "ar" ? "مسافة" : "Space", action: "space", grow: 3 },
    { id: "clear", label: lang === "ar" ? "مسح" : "Clear", action: "clear", grow: 1.3 },
    { id: "backspace", label: lang === "ar" ? "حذف" : "Delete", action: "backspace", grow: 1.3 },
    { id: "done", label: lang === "ar" ? "تم" : "Done", action: "done", grow: 1.4 },
  ];
}

export function buildRows(lang: KeyboardLang, mode: "letters" | "symbols"): KeyDef[][] {
  const letters = lang === "ar" ? AR_LETTERS : EN_LETTERS;
  const symbols = lang === "ar" ? AR_SYMBOLS : EN_SYMBOLS;
  return [...(mode === "symbols" ? symbols : letters), actionRow(lang, mode)];
}

function keyAt(rows: KeyDef[][], row: number, col: number): { row: number; col: number } {
  const r = Math.max(0, Math.min(rows.length - 1, row));
  const line = rows[r] ?? [];
  const c = Math.max(0, Math.min(Math.max(line.length - 1, 0), col));
  return { row: r, col: c };
}

export function moveKey(
  rows: KeyDef[][],
  row: number,
  col: number,
  dir: RemoteAction,
): { row: number; col: number } {
  if (dir !== "up" && dir !== "down" && dir !== "left" && dir !== "right") return { row, col };
  const current = rows[row] ?? [];
  if (dir === "left") return keyAt(rows, row, col - 1);
  if (dir === "right") return keyAt(rows, row, col + 1);
  const nextRow = dir === "up" ? row - 1 : row + 1;
  if (nextRow < 0 || nextRow >= rows.length) return { row, col };
  const from = current[col];
  const nextLine = rows[nextRow] ?? [];
  if (!from || !nextLine.length) return keyAt(rows, nextRow, 0);
  const fromStart = current.slice(0, col).reduce((sum, key) => sum + (key.grow ?? 1), 0);
  const fromMid = fromStart + (from.grow ?? 1) / 2;
  let acc = 0;
  let best = 0;
  let bestDist = Infinity;
  nextLine.forEach((key, index) => {
    const mid = acc + (key.grow ?? 1) / 2;
    const dist = Math.abs(mid - fromMid);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
    acc += key.grow ?? 1;
  });
  return { row: nextRow, col: best };
}
