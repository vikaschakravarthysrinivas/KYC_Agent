export function norm(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normId(s: string | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function nameTokens(name: string): Set<string> {
  return new Set(norm(name).split(/\s+/).filter((t) => t.length > 1));
}

export function nameOverlapScore(a: string, b: string): number {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const t of A) {
    if (B.has(t)) hit += 1;
  }
  return hit / Math.max(A.size, B.size);
}

/** Parse common Indian / ISO date strings to YYYY-MM-DD when possible. */
export function normalizeDobToIso(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  const dmyShort = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShort) {
    const [, d, m, y2] = dmyShort;
    const y = Number(y2) > 30 ? `19${y2}` : `20${y2}`;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  return null;
}

export function dobsEquivalent(a: string | undefined, b: string | undefined): boolean {
  const ia = normalizeDobToIso(a);
  const ib = normalizeDobToIso(b);
  if (ia && ib) return ia === ib;
  return norm(a) === norm(b) && norm(a).length > 0;
}
