export interface Progress {
  version: 1;
  chapter: number;
  talked: boolean;
  clueRead: boolean;
  collected: string[];
  done: boolean;
  recorded: boolean;
  finished: boolean;
  visited: number[];
  seconds: number;
}
export const SAVE_KEY = 'friend-song-game:save:v1';
export function freshProgress(): Progress {
  return { version: 1, chapter: 0, talked: false, clueRead: false, collected: [], done: false, recorded: false, finished: false, visited: [], seconds: 0 };
}
export function readProgress(raw: string | null): Progress | null {
  try {
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== 1 || !Number.isInteger(p.chapter) || p.chapter < 0 || p.chapter > 7) return null;
    if (['talked', 'clueRead', 'done', 'recorded', 'finished'].some(k => typeof p[k] !== 'boolean')) return null;
    if (!Array.isArray(p.collected) || !p.collected.every((x: unknown) => typeof x === 'string')) return null;
    if (!Array.isArray(p.visited) || !p.visited.every((n: unknown) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 7)) return null;
    if (!Number.isFinite(p.seconds) || p.seconds < 0) return null;
    return { ...freshProgress(), ...p, collected: [...new Set<string>(p.collected)], visited: [...new Set<number>(p.visited)] };
  } catch { return null; }
}
export function completeChapter(p: Progress): Progress {
  return { ...p, done: true, visited: p.chapter > 0 ? [...new Set([...p.visited, p.chapter])] : p.visited };
}
export function advanceChapter(p: Progress): Progress {
  if (!p.done || p.chapter === 7) return p;
  return { ...freshProgress(), chapter: p.chapter + 1, seconds: p.seconds, visited: [...p.visited] };
}
export const ERRAND_ITEM = 'bohem-no4';
export function purchaseErrand(p: Progress): Progress {
  if (p.chapter !== 1 || !p.talked || p.done || p.collected.includes(ERRAND_ITEM)) return p;
  return { ...p, collected: [...p.collected, ERRAND_ITEM] };
}
export function canDeliverErrand(p: Progress): boolean {
  return p.chapter === 1 && p.talked && !p.done && p.collected.includes(ERRAND_ITEM);
}
export function matchOrder(actual: readonly (string | number)[], expected: readonly (string | number)[]): boolean {
  return actual.length === expected.length && actual.every((x, i) => x === expected[i]);
}
export function validMix(levels: number[], target: number[]): boolean {
  return levels.length === target.length && levels.every((v, i) => Number.isFinite(v) && Math.abs(v - target[i]) <= 8);
}
export function rhythmWindow(failures: number): number { return Math.min(0.38, 0.19 + failures * 0.065); }
