import { PLAYER_STATS, PLAYER_STAT_ALIASES } from '@/data/playerStats';
import type { Player } from '@/lib/types';

const SCORER_POS: Record<string, number> = { GK: 0, DF: 4, MF: 22, FW: 74 };
const CARD_POS: Record<string, number> = { GK: 5, DF: 40, MF: 45, FW: 10 };

function norm(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function lookupPlayerStats(name: string) {
  if (PLAYER_STATS[name]) return PLAYER_STATS[name];
  const alias = PLAYER_STAT_ALIASES[name];
  if (alias && PLAYER_STATS[alias]) return PLAYER_STATS[alias];

  const n = norm(name);
  for (const [key, stats] of Object.entries(PLAYER_STATS)) {
    if (norm(key) === n) return stats;
  }
  for (const [aliasKey, target] of Object.entries(PLAYER_STAT_ALIASES)) {
    if (norm(aliasKey) === n && PLAYER_STATS[target]) return PLAYER_STATS[target];
  }
  return null;
}

/**
 * Peso relativo para ser autor de gol (0 = GK nunca marca).
 * Calibrado para artilharia ~15–22 gols/temporada; recordes ~26–28 (raros).
 */
export function getScorerWeight(player: Player): number {
  const base = SCORER_POS[player.p] ?? 0;
  if (base === 0) return 0;

  const s = lookupPlayerStats(player.n);
  if (!s) return base;

  let mult = 1;
  if (s.goals) mult += Math.min(s.goals * 0.07, 0.65);
  if (s.xg) mult += Math.min(s.xg * 0.05, 0.45);
  if (s.goalInv) mult += Math.min(s.goalInv * 0.03, 0.25);
  if (s.assists && player.p === 'MF') mult += Math.min(s.assists * 0.02, 0.15);
  if (s.goalFreq && s.goalFreq > 0) mult *= Math.min(1.85, 125 / s.goalFreq);
  if (s.shotsPg) mult += Math.min(s.shotsPg * 0.05, 0.2);
  if (s.sotPg) mult += Math.min(s.sotPg * 0.08, 0.25);
  if (s.rating) mult *= 0.9 + Math.min(0.35, (s.rating - 6.6) * 0.08);

  mult = Math.max(0.65, Math.min(3.2, mult));
  return base * mult;
}

/** Comprime diferença entre artilheiro e demais (evita 30+ gols na temporada) */
const SCORER_WEIGHT_POWER = 0.74;

/** Peso relativo para receber cartão */
export function getCardWeight(player: Player): number {
  const base = CARD_POS[player.p] ?? 10;
  const s = lookupPlayerStats(player.n);
  if (!s) return base;

  let mult = 1;
  if (s.yellowCards) mult += s.yellowCards * 0.1;
  if (s.redCards) mult += s.redCards * 0.42;

  return base * mult;
}

function weightedPick<T>(items: T[], getWeight: (item: T) => number): T {
  const weights = items.map(getWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];

  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function scoringPool(squad: Player[]): Player[] {
  const pool = squad.filter((p) => getScorerWeight(p) > 0);
  if (pool.length <= 14) return pool;
  return [...pool]
    .sort((a, b) => getScorerWeight(b) - getScorerWeight(a))
    .slice(0, 14);
}

export function pickWeightedScorer(squad: Player[], alreadyScored?: Set<string>): Player {
  const fallback =
    squad.find((p) => p.p !== 'GK') ?? squad[0] ?? ({ n: 'Jogador', p: 'FW' } as Player);

  const pool = scoringPool(squad);
  if (!pool.length) return fallback;

  const getPickWeight = (p: Player) => {
    let w = Math.pow(getScorerWeight(p), SCORER_WEIGHT_POWER);
    if (alreadyScored?.has(p.n)) w *= 0.32;
    return w;
  };

  return weightedPick(pool, getPickWeight) ?? fallback;
}

export function pickWeightedCardPlayer(squad: Player[]): Player {
  if (!squad.length) return { n: 'Jogador', p: 'MF' };
  return weightedPick(squad, getCardWeight);
}

const ASSIST_POS: Record<string, number> = { GK: 1, DF: 14, MF: 55, FW: 30 };

/** Peso relativo para dar assistência */
export function getAssistWeight(player: Player): number {
  const base = ASSIST_POS[player.p] ?? 10;
  const s = lookupPlayerStats(player.n);
  if (!s) return base;

  let mult = 1;
  if (s.assists) mult += Math.min(s.assists * 0.18, 1.2);
  if (s.keyPassesPg) mult += Math.min(s.keyPassesPg * 0.12, 0.5);
  if (s.bigChancesCreated) mult += Math.min(s.bigChancesCreated * 0.06, 0.4);
  if (s.rating) mult *= 0.9 + Math.min(0.3, (s.rating - 6.6) * 0.07);

  return base * Math.max(0.6, Math.min(3, mult));
}

export function pickWeightedAssister(squad: Player[], scorerName: string): Player | null {
  const pool = squad.filter((p) => p.n !== scorerName && p.p !== 'GK');
  if (!pool.length) return null;
  return weightedPick(pool, getAssistWeight);
}

/** Cobrador de pênalti: quem já converteu cobranças, senão o melhor finalizador */
export function pickPenaltyTaker(squad: Player[]): Player {
  const fallback = squad.find((p) => p.p !== 'GK') ?? squad[0] ?? ({ n: 'Jogador', p: 'FW' } as Player);
  const candidates = squad.filter((p) => p.p !== 'GK');
  if (!candidates.length) return fallback;

  const withPens = candidates.filter((p) => {
    const s = lookupPlayerStats(p.n);
    return s?.penaltiesScored && s.penaltiesScored > 0;
  });
  if (withPens.length) {
    return withPens.reduce((best, p) => {
      const bs = lookupPlayerStats(best.n)?.penaltiesScored ?? 0;
      const ps = lookupPlayerStats(p.n)?.penaltiesScored ?? 0;
      return ps > bs ? p : best;
    });
  }
  return candidates.reduce((best, p) =>
    getScorerWeight(p) > getScorerWeight(best) ? p : best
  );
}

/** Bônus de força individual (0–8) para compor overall do Meu Time */
export function getPlayerStrengthBonus(player: Player): number {
  const s = lookupPlayerStats(player.n);
  if (!s) return 0;
  let bonus = 0;
  if (s.rating) bonus += (s.rating - 6.8) * 2.5;
  if (s.goals) bonus += s.goals * 0.15;
  if (s.assists) bonus += s.assists * 0.1;
  return Math.max(-2, Math.min(8, bonus));
}
