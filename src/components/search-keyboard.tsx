import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Delete, Languages, Space } from "lucide-react";
import { useRemoteHandler } from "@/components/remote-root";
import { actionFromKey, isPrintableKey } from "@/lib/iptv/remote";
import {
  buildRows,
  loadKeyboardLang,
  moveKey,
  saveKeyboardLang,
  type KeyDef,
  type KeyboardLang,
} from "@/lib/iptv/keyboard-layout";
import { cn } from "@/lib/utils";

export type { KeyboardLang };

export function SearchKeyboard({
  open,
  value,
  onChange,
  onClose,
  placeholder,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder: string;
}) {
  const [lang, setLang] = useState<KeyboardLang>(loadKeyboardLang);
  const [mode, setMode] = useState<"letters" | "symbols">("letters");
  const [cursor, setCursor] = useState({ row: 1, col: 0 });
  const rows = useMemo(() => buildRows(lang, mode), [lang, mode]);

  useEffect(() => {
    if (!open) return;
    setCursor({ row: 1, col: 0 });
  }, [open, lang, mode]);

  useRemoteHandler(
    (event) => {
      if (!open) return false;
      const { action, key } = event;
      if (action === "up" || action === "down" || action === "left" || action === "right") {
        setCursor((cur) => moveKey(rows, cur.row, cur.col, action));
        return true;
      }
      if (action === "select") {
        if (key === " " || key === "Spacebar") {
          onChange(value + " ");
          return true;
        }
        const current = rows[cursor.row]?.[cursor.col];
        if (current) applyKey(current);
        return true;
      }
      return false;
    },
    [open, rows, cursor, value, onChange, lang],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const printable = isPrintableKey(event);
      if (printable) {
        event.preventDefault();
        event.stopPropagation();
        onChange(value + printable);
        return;
      }
      const action = actionFromKey(event, "keyboard");
      if (action === "back" && (event.key === "Backspace" || event.keyCode === 8)) {
        event.preventDefault();
        event.stopPropagation();
        onChange(value.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, value, onChange]);

  function applyKey(key: KeyDef) {
    if ("char" in key) {
      onChange(value + key.char);
      return;
    }
    if (key.action === "space") onChange(value + " ");
    else if (key.action === "backspace") onChange(value.slice(0, -1));
    else if (key.action === "clear") onChange("");
    else if (key.action === "done") onClose();
    else if (key.action === "lang") {
      const next = lang === "en" ? "ar" : "en";
      setLang(next);
      saveKeyboardLang(next);
      setMode("letters");
    } else if (key.action === "mode") {
      setMode((current) => (current === "letters" ? "symbols" : "letters"));
    }
  }

  if (!open) return null;

  const rtl = lang === "ar";

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col justify-end" data-kb-root="true">
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 bg-overlay"
        aria-label="Close keyboard"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={lang === "ar" ? "لوحة المفاتيح" : "Search keyboard"}
        aria-modal="true"
        className={cn(
          "pointer-events-auto relative border-t border-border bg-surface px-3 pb-5 pt-3 shadow-[var(--shadow-poster)] md:px-6",
          rtl && "font-arabic",
        )}
        dir={rtl ? "rtl" : "ltr"}
      >
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:text-fg"
            aria-label="Close keyboard"
            onClick={onClose}
          >
            <ArrowLeft className="size-5" />
          </button>
          <p
            className={cn(
              "min-h-12 min-w-0 flex-1 truncate rounded-md bg-elevated px-3 py-2 text-lg shadow-[var(--shadow-border)]",
              rtl && "font-arabic",
              !value && "text-subtle",
            )}
            dir="auto"
          >
            {value || placeholder}
            <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-accent align-middle" />
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.map((line, rowIndex) => (
            <div key={rowIndex} className="flex gap-1.5">
              {line.map((key, colIndex) => {
                const focused = cursor.row === rowIndex && cursor.col === colIndex;
                const grow = key.grow ?? 1;
                const arabic = "rtl" in key && key.rtl;
                return (
                  <button
                    key={key.id}
                    type="button"
                    data-kb-row={rowIndex}
                    data-kb-col={colIndex}
                    onMouseEnter={() => setCursor({ row: rowIndex, col: colIndex })}
                    onClick={() => applyKey(key)}
                    style={{ flexGrow: grow, flexBasis: 0 }}
                    className={cn(
                      "tv-key flex min-h-12 items-center justify-center rounded-md px-1 text-sm font-medium whitespace-nowrap shadow-[var(--shadow-border)] transition-colors duration-150",
                      focused ? "bg-accent text-accent-fg" : "bg-elevated text-fg hover:bg-elevated/80",
                      arabic && "font-arabic text-lg",
                    )}
                  >
                    {"action" in key && key.action === "backspace" ? (
                      <Delete className="size-4" />
                    ) : "action" in key && key.action === "space" ? (
                      <span className="flex items-center gap-1">
                        {!rtl && <Space className="size-4" />}
                        <span>{key.label}</span>
                      </span>
                    ) : "action" in key && key.action === "lang" ? (
                      <span className={cn("flex items-center gap-1", lang === "en" && "font-arabic")}>
                        <Languages className="size-3.5" />
                        {key.label}
                      </span>
                    ) : "action" in key && key.action === "done" ? (
                      <span className="flex items-center gap-1">
                        <Check className="size-3.5" />
                        {key.label}
                      </span>
                    ) : (
                      key.label
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
