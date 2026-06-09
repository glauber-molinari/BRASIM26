import type { TacticKey } from '@/lib/types';

export const TACTICS: Record<TacticKey, { fw: number; mf: number; df: number }> = {
  '4-4-2': { fw: 2, mf: 4, df: 4 },
  '4-3-3': { fw: 3, mf: 3, df: 4 },
  '4-5-1': { fw: 1, mf: 5, df: 4 },
  '3-5-2': { fw: 2, mf: 5, df: 3 },
  '5-3-2': { fw: 2, mf: 3, df: 5 },
};

export const TACTIC_KEYS = Object.keys(TACTICS) as TacticKey[];
