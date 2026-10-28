export type SudokuLevel = 'easy' | 'medium' | 'hard';

const CLUES: Record<SudokuLevel, number> = { easy: 40, medium: 32, hard: 26 };

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlace(grid: number[], idx: number, n: number): boolean {
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  for (let k = 0; k < 9; k++) {
    if (grid[r * 9 + k] === n || grid[k * 9 + c] === n) return false;
  }
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[(br + i) * 9 + bc + j] === n) return false;
    }
  }
  return true;
}

function fill(grid: number[], rand: () => number): boolean {
  const idx = grid.indexOf(0);
  if (idx === -1) return true;
  for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)) {
    if (canPlace(grid, idx, n)) {
      grid[idx] = n;
      if (fill(grid, rand)) return true;
      grid[idx] = 0;
    }
  }
  return false;
}

function countSolutions(grid: number[], limit = 2): number {
  const idx = grid.indexOf(0);
  if (idx === -1) return 1;
  let count = 0;
  for (let n = 1; n <= 9 && count < limit; n++) {
    if (canPlace(grid, idx, n)) {
      grid[idx] = n;
      count += countSolutions(grid, limit - count);
      grid[idx] = 0;
    }
  }
  return count;
}

const cache = new Map<string, { puzzle: number[]; solution: number[] }>();

export function dailySudoku(day: string, level: SudokuLevel) {
  const key = `${day}:${level}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = rng(`sudoku:${key}`);
  const solution = Array<number>(81).fill(0);
  fill(solution, rand);
  const puzzle = [...solution];
  let filled = 81;
  for (const idx of shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rand,
  )) {
    if (filled <= CLUES[level]) break;
    const keep = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions([...puzzle]) !== 1) {
      puzzle[idx] = keep;
    } else {
      filled--;
    }
  }
  const result = { puzzle, solution };
  if (cache.size > 30) cache.clear();
  cache.set(key, result);
  return result;
}

export function dailyIndex(day: string, size: number): number {
  const rand = rng(`termo:${day}`);
  return Math.floor(rand() * size);
}
