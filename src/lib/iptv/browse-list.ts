/** Last-seen catalog order so the player can skip live channels with RW/FF. */

let kind = "";
let ids: string[] = [];

export function rememberBrowseList(nextKind: string, nextIds: string[]) {
  kind = nextKind;
  ids = nextIds;
}

export function browseListKind(): string {
  return kind;
}

export function neighborInBrowseList(id: string, dir: number): string | null {
  if (!ids.length) return null;
  const index = ids.indexOf(id);
  if (index < 0) return dir > 0 ? ids[0]! : ids[ids.length - 1]!;
  const next = index + (dir < 0 ? -1 : 1);
  if (next < 0) return ids[ids.length - 1]!;
  if (next >= ids.length) return ids[0]!;
  return ids[next]!;
}
