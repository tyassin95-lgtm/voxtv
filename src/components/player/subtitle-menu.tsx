import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Globe, LoaderCircle, Search, X } from "lucide-react";
import { SearchKeyboard } from "@/components/search-keyboard";
import { useBackHandler, useRemoteHandler } from "@/components/remote-root";
import {
  loadSubtitleTrackUrl,
  searchSubtitles,
  SubtitleLookupError,
  SUBTITLE_LANGS,
  type SubtitleHit,
  type SubtitleLang,
} from "@/lib/iptv/subtitles";
import { cn } from "@/lib/utils";

export interface SubtitleOption {
  id: string;
  label: string;
  sublabel?: string;
}

export interface LoadedSubtitle {
  id: string;
  label: string;
  lang: SubtitleLang;
  url: string;
}

type View = "tracks" | "search";

export function SubtitleMenu({
  open,
  onClose,
  options,
  activeId,
  onSelect,
  onLoaded,
  defaultQuery,
  season,
  episode,
}: {
  open: boolean;
  onClose: () => void;
  options: SubtitleOption[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onLoaded: (sub: LoadedSubtitle) => void;
  defaultQuery: string;
  season?: number;
  episode?: number;
}) {
  const [view, setView] = useState<View>("tracks");
  const [cursor, setCursor] = useState(0);
  const [query, setQuery] = useState(defaultQuery);
  const [lang, setLang] = useState<SubtitleLang>("eng");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [results, setResults] = useState<SubtitleHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(
    async (nextQuery: string, nextLang: SubtitleLang) => {
      const trimmed = nextQuery.trim();
      if (!trimmed) {
        setResults([]);
        setMessage("Type something to search for.");
        return;
      }
      setSearching(true);
      setMessage(null);
      setFailed(false);
      try {
        const hits = await searchSubtitles({ query: trimmed, langs: [nextLang], season, episode });
        setResults(hits);
        setMessage(hits.length ? null : "No subtitles found for that search.");
      } catch (err) {
        setResults([]);
        setMessage(err instanceof Error ? err.message : "Subtitle search failed.");
        // A lookup that failed is worth offering again; "nothing found" is not.
        setFailed(err instanceof SubtitleLookupError ? err.retryable : true);
      } finally {
        setSearching(false);
      }
    },
    [season, episode],
  );

  useEffect(() => {
    if (!open) return;
    setView(options.length ? "tracks" : "search");
    setCursor(0);
    setQuery(defaultQuery);
  }, [open, defaultQuery]);

  // Opening straight into search (no embedded tracks) looks for matches at once.
  useEffect(() => {
    if (!open || view !== "search" || results.length || searching || message) return;
    void runSearch(query, lang);
  }, [open, view]);

  const download = useCallback(
    async (hit: SubtitleHit) => {
      setDownloading(hit.id);
      setMessage(null);
      try {
        const url = await loadSubtitleTrackUrl(hit);
        onLoaded({
          id: `os:${hit.id}`,
          label: `${hit.langLabel} · ${hit.name}`,
          lang: hit.lang,
          url,
        });
        onClose();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not load that subtitle.");
      } finally {
        setDownloading(null);
      }
    },
    [onLoaded, onClose],
  );

  type Row = { key: string; run: () => void };
  const rows = useMemo<Row[]>(() => {
    if (view === "tracks") {
      return [
        { key: "off", run: () => onSelect(null) },
        ...options.map((option) => ({ key: option.id, run: () => onSelect(option.id) })),
        { key: "search", run: () => setView("search") },
      ];
    }
    return [
      { key: "query", run: () => setKeyboardOpen(true) },
      {
        key: "lang",
        run: () => {
          const next: SubtitleLang = lang === "eng" ? "ara" : "eng";
          setLang(next);
          void runSearch(query, next);
        },
      },
      { key: "run", run: () => void runSearch(query, lang) },
      ...results.map((hit) => ({ key: hit.id, run: () => void download(hit) })),
    ];
  }, [view, options, results, lang, query, onSelect, runSearch, download]);

  useEffect(() => {
    setCursor((index) => Math.max(0, Math.min(rows.length - 1, index)));
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    // Row buttons render in the same order as `rows`, so the cursor indexes both.
    const el = listRef.current?.querySelectorAll<HTMLElement>("[data-sub-row]")[cursor];
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, [open, cursor, rows]);

  useBackHandler(() => {
    if (!open) return false;
    if (keyboardOpen) {
      setKeyboardOpen(false);
      return true;
    }
    if (view === "search" && options.length) {
      setView("tracks");
      return true;
    }
    onClose();
    return true;
  }, [open, keyboardOpen, view, options.length, onClose]);

  useRemoteHandler(
    (event) => {
      if (!open || keyboardOpen) return false;
      const action = event.action;
      if (action === "up" || action === "pageup") {
        setCursor((index) => Math.max(0, index - 1));
        return true;
      }
      if (action === "down" || action === "pagedown") {
        setCursor((index) => Math.min(rows.length - 1, index + 1));
        return true;
      }
      if (action === "select") {
        rows[cursor]?.run();
        return true;
      }
      if (action === "left" || action === "right") return true;
      return false;
    },
    [open, keyboardOpen, rows, cursor],
  );

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close subtitles"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-[var(--shadow-poster)]"
        role="dialog"
        aria-label="Subtitles"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <p className="min-w-0 flex-1 truncate font-display text-base font-semibold">
            {view === "tracks" ? "Subtitles" : "Search OpenSubtitles"}
          </p>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
            aria-label="Close subtitles"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {view === "tracks" ? (
            <>
              <Row rowKey="off" active={activeId === null} onClick={() => onSelect(null)}>
                Off
              </Row>
              {options.map((option) => (
                <Row
                  key={option.id}
                  rowKey={option.id}
                  active={activeId === option.id}
                  sublabel={option.sublabel}
                  onClick={() => onSelect(option.id)}
                >
                  {option.label}
                </Row>
              ))}
              <Row
                rowKey="search"
                icon={<Search className="size-4 text-muted" />}
                onClick={() => setView("search")}
              >
                Search OpenSubtitles…
              </Row>
              {options.length === 0 && (
                <p className="px-3 py-2 text-xs leading-relaxed text-subtle">
                  This stream carries no subtitle track. Search OpenSubtitles for an English or
                  Arabic file instead.
                </p>
              )}
            </>
          ) : (
            <>
              <Row
                rowKey="query"
                icon={<Search className="size-4 text-muted" />}
                onClick={() => setKeyboardOpen(true)}
              >
                <span className="truncate" dir="auto">
                  {query || "Type a title…"}
                </span>
              </Row>
              <Row
                rowKey="lang"
                icon={<Globe className="size-4 text-muted" />}
                onClick={() => {
                  const next: SubtitleLang = lang === "eng" ? "ara" : "eng";
                  setLang(next);
                  void runSearch(query, next);
                }}
              >
                {SUBTITLE_LANGS.find((entry) => entry.id === lang)?.label ?? lang}
              </Row>
              <Row
                rowKey="run"
                icon={
                  searching ? (
                    <LoaderCircle className="size-4 animate-spin text-muted" />
                  ) : (
                    <Download className="size-4 text-muted" />
                  )
                }
                onClick={() => void runSearch(query, lang)}
              >
                {searching ? "Searching…" : failed ? "Try again" : "Search"}
              </Row>
              {message && (
                <p
                  className={cn(
                    "px-3 py-2 text-xs leading-relaxed",
                    failed ? "text-accent" : "text-muted",
                  )}
                >
                  {message}
                </p>
              )}
              {results.map((hit) => (
                <Row
                  key={hit.id}
                  rowKey={hit.id}
                  sublabel={`${hit.langLabel} · ${hit.downloads.toLocaleString()} downloads`}
                  icon={
                    downloading === hit.id ? (
                      <LoaderCircle className="size-4 animate-spin text-muted" />
                    ) : undefined
                  }
                  onClick={() => void download(hit)}
                  rtl={hit.lang === "ara"}
                >
                  {hit.name}
                </Row>
              ))}
            </>
          )}
        </div>

        {view === "search" && options.length > 0 && (
          <button
            type="button"
            className="h-12 shrink-0 border-t border-border text-sm text-muted hover:text-fg"
            onClick={() => setView("tracks")}
          >
            Back to tracks
          </button>
        )}
      </aside>

      {keyboardOpen && (
        <div className="absolute inset-0 z-10">
          <SearchKeyboard
            open
            value={query}
            onChange={setQuery}
            onClose={() => {
              setKeyboardOpen(false);
              void runSearch(query, lang);
            }}
            placeholder="Search subtitles"
          />
        </div>
      )}
    </div>
  );
}

function Row({
  rowKey,
  children,
  sublabel,
  active,
  icon,
  rtl,
  onClick,
}: {
  rowKey: string;
  children: React.ReactNode;
  sublabel?: string;
  active?: boolean;
  icon?: React.ReactNode;
  rtl?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-sub-row={rowKey}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
        "focus-visible:outline-none focus:bg-elevated focus-visible:ring-2 focus-visible:ring-accent hover:bg-elevated",
        active && "text-accent",
      )}
    >
      {icon}
      <span className={cn("min-w-0 flex-1", rtl && "font-arabic")} dir={rtl ? "rtl" : "auto"}>
        <span className="block truncate">{children}</span>
        {sublabel && <span className="block truncate text-xs text-subtle">{sublabel}</span>}
      </span>
      {active && <Check className="size-4 shrink-0 text-accent" />}
    </button>
  );
}
