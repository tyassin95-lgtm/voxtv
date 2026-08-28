/** Shared subtitle vocabulary for both the browser and the server route. */
export type SubtitleLang = "eng" | "ara";

export const SUBTITLE_LANGS: { id: SubtitleLang; label: string }[] = [
  { id: "eng", label: "English" },
  { id: "ara", label: "العربية" },
];

export interface SubtitleHit {
  id: string;
  name: string;
  lang: SubtitleLang;
  langLabel: string;
  format: string;
  downloads: number;
  rating: number;
  downloadUrl: string;
  release?: string;
}

export function isSubtitleLang(value: string): value is SubtitleLang {
  return value === "eng" || value === "ara";
}

export function langLabel(lang: SubtitleLang): string {
  return SUBTITLE_LANGS.find((entry) => entry.id === lang)?.label ?? lang;
}
