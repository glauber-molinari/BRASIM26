import { TEAMS, MY_TEAM_ID, MY_TEAM_EMOJI } from '@/data/teams';
import type {
  GameStyle,
  LineupSlot,
  LineupStrength,
  MatchEvent,
  MatchResult,
  MatchSegment,
  Player,
  Standing,
  TeamData,
} from '@/lib/types';
import { rnd } from '@/lib/helpers';
import {
  getPlayerStrengthBonus,
  pickWeightedCardPlayer,
  pickWeightedScorer,
} from '@/lib/playerWeights';

export const pickScorer = pickWeightedScorer;
export const pickCardPlayer = pickWeightedCardPlayer;

function rollYellowCount(): number {
  const r = Math.random();
  if (r < 0.22) return 0;
  if (r < 0.58) return 1;
  if (r < 0.88) return 2;
  return 3;
}

function pickUniqueCardPlayer(
  squad: Player[],
  teamKey: string,
  carded: Set<string>
): Player | null {
  const pool = squad.filter((p) => !carded.has(`${teamKey}:${p.n}`));
  if (!pool.length) return null;
  return pickCardPlayer(pool);
}

function addMatchCards(
  evs: MatchEvent[],
  home: TeamData,
  away: TeamData,
  homeId: number,
  awayId: number,
  used: Set<number>
) {
  const nextMin = (): number | null => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const v = rnd(8, 92);
      if (!used.has(v)) {
        used.add(v);
        return v;
      }
    }
    return null;
  };

  const carded = new Set<string>();
  const yellowCount = rollYellowCount();

  for (let i = 0; i < yellowCount; i++) {
    const min = nextMin();
    if (min === null) break;

    const isH = Math.random() > 0.48;
    const t = isH ? home : away;
    const teamId = isH ? homeId : awayId;
    const pl = pickUniqueCardPlayer(t.squad, t.short, carded);
    if (!pl) continue;

    carded.add(`${t.short}:${pl.n}`);
    evs.push({
      min,
      type: 'yellow',
      team: isH ? 'home' : 'away',
      player: pl.n,
      tshort: t.short,
      isMy: teamId === MY_TEAM_ID,
    });
  }

  if (Math.random() < 0.035) {
    const min = nextMin();
    if (min !== null) {
      const isH = Math.random() > 0.5;
      const t = isH ? home : away;
      const teamId = isH ? homeId : awayId;
      const pl = pickUniqueCardPlayer(t.squad, t.short, carded) ?? pickCardPlayer(t.squad);
      carded.add(`${t.short}:${pl.n}`);
      evs.push({
        min,
        type: 'red',
        team: isH ? 'home' : 'away',
        player: pl.n,
        tshort: t.short,
        isMy: teamId === MY_TEAM_ID,
      });
    }
  }
}

export function getLineupStrength(lineup: LineupSlot[]): LineupStrength {
  const players = lineup.filter((s) => s.player);
  const count = players.length;
  const isComplete = count === 11;

  const sumAtt = players.reduce((a, s) => {
    const t = TEAMS.find((x) => x.id === s.player!.tid);
    return a + (t?.att ?? 60);
  }, 0);
  const sumDef = players.reduce((a, s) => {
    const t = TEAMS.find((x) => x.id === s.player!.tid);
    return a + (t?.def ?? 60);
  }, 0);

  const bonus = isComplete ? 3 : 0;
  const statBonus =
    players.reduce((a, s) => {
      return a + getPlayerStrengthBonus({ n: s.player!.n, p: s.pos });
    }, 0) / 11;

  const att = Math.round(sumAtt / 11 + bonus + statBonus * 0.35);
  const def = Math.round(sumDef / 11 + bonus + statBonus * 0.2);
  const overall = Math.round((att + def) / 2);

  return { count, att, def, overall, isComplete, bonus };
}

export function getOverallColor(overall: number): string {
  if (overall >= 80) return '#ffd54f';
  if (overall >= 70) return 'var(--green-light)';
  if (overall >= 60) return 'var(--yellow)';
  if (overall >= 50) return '#ff9800';
  return 'var(--text2)';
}

export function getMyTeamData(lineup: LineupSlot[]): TeamData {
  const players = lineup.filter((s) => s.player);
  const { att, def } = getLineupStrength(lineup);

  return {
    id: MY_TEAM_ID,
    name: _myTeamName,
    short: _myTeamShort,
    c: MY_TEAM_EMOJI,
    att,
    def,
    squad: players.map((s) => ({ n: s.player!.n, p: s.pos })),
  };
}

export function getTeamData(id: number, lineup: LineupSlot[]): TeamData {
  if (id === MY_TEAM_ID) return getMyTeamData(lineup);
  const t = TEAMS.find((x) => x.id === id)!;
  return { ...t, squad: t.squad };
}

// Poisson sampling: goals per match follow Poisson(λ) distribution
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 8));
  let p = 1;
  let k = 0;
  do { k++; p *= Math.random(); } while (p > L);
  return Math.min(k - 1, 7);
}

// Brasileirão avg ~1.25 goals per team per match; team quality shifts λ
const BASE_XG = 1.25;
const AVG_RATING = 68;
const HOME_ADV = 1.12;

function teamXG(att: number, oppDef: number, advantage = 1): number {
  return Math.max(0.3, BASE_XG * (att / AVG_RATING) / (oppDef / AVG_RATING) * advantage);
}

const STYLE_MULT: Record<GameStyle, { my: number; opp: number }> = {
  normal:       { my: 1.00, opp: 1.00 },
  contraAtaque: { my: 0.88, opp: 0.82 },
  retranca:     { my: 0.72, opp: 0.78 },
  tikaTaka:     { my: 1.10, opp: 0.90 },
};

const POSS_RANGE: Record<GameStyle, [number, number]> = {
  normal:       [42, 62],
  contraAtaque: [35, 50],
  retranca:     [30, 48],
  tikaTaka:     [55, 70],
};

// ─── Gera eventos de gol para um segmento ───
function generateGoalEvents(
  team: TeamData,
  teamId: number,
  side: 'home' | 'away',
  count: number,
  getMins: (n: number) => number[],
): MatchEvent[] {
  const scored = new Set<string>();
  return getMins(count).map((min) => {
    const sc = pickScorer(team.squad, scored);
    scored.add(sc.n);
    return {
      min,
      type: 'goal' as const,
      team: side,
      player: sc.n,
      tshort: team.short,
      isMy: teamId === MY_TEAM_ID,
    };
  });
}

// ─── Gera defesas do goleiro ───
function generateSaveEvents(
  home: TeamData,
  away: TeamData,
  homeId: number,
  awayId: number,
  count: number,
  getMins: (n: number) => number[],
): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const min of getMins(count)) {
    const isHomeGkSaving = Math.random() > 0.5;
    const savingTeam = isHomeGkSaving ? home : away;
    const savingTeamId = isHomeGkSaving ? homeId : awayId;
    const gk = savingTeam.squad.find((p) => p.p === 'GK') ?? savingTeam.squad[0];
    if (!gk) continue; // squad vazio — pula o evento
    events.push({
      min,
      type: 'save' as const,
      team: isHomeGkSaving ? 'home' : 'away',
      player: gk.n,
      tshort: savingTeam.short,
      isMy: savingTeamId === MY_TEAM_ID,
    });
  }
  return events;
}

// ─── Gera chutes na trave ───
function generatePostEvents(
  home: TeamData,
  away: TeamData,
  homeId: number,
  awayId: number,
  getMins: (n: number) => number[],
): MatchEvent[] {
  if (Math.random() >= 0.22) return [];
  const mins = getMins(1);
  if (!mins.length) return [];
  const isHome = Math.random() > 0.5;
  const t = isHome ? home : away;
  const tid = isHome ? homeId : awayId;
  const shooter = pickScorer(t.squad, new Set());
  return [{
    min: mins[0],
    type: 'post' as const,
    team: isHome ? 'home' : 'away',
    player: shooter.n,
    tshort: t.short,
    isMy: tid === MY_TEAM_ID,
  }];
}

// ─── Gera substituições ───
function generateSubEvents(
  home: TeamData,
  away: TeamData,
  homeId: number,
  awayId: number,
  fromMin: number,
  toMin: number,
  getMins: (n: number) => number[],
): MatchEvent[] {
  if (toMin < 55) return [];
  const subFromMin = Math.max(fromMin, 55);

  const evs: MatchEvent[] = [];
  [home, away].forEach((t, idx) => {
    const isHome = idx === 0;
    const tid = isHome ? homeId : awayId;
    // Substituições automáticas apenas para o adversário — Meu Time é manual
    if (tid === MY_TEAM_ID) return;
    const numSubs = rnd(1, 2);
    const nonGK = t.squad.filter((p) => p.p !== 'GK');
    if (!nonGK.length) return;
    const subMins: number[] = [];
    for (let i = 0; i < numSubs; i++) {
      subMins.push(rnd(subFromMin, Math.min(toMin - 2, 88)));
    }
    subMins.sort((a, b) => a - b);
    subMins.forEach((min) => {
      const outPlayer = nonGK[rnd(0, nonGK.length - 1)];
      const inPool = nonGK.filter((p) => p.n !== outPlayer.n);
      const inPlayer = inPool.length ? inPool[rnd(0, inPool.length - 1)] : outPlayer;
      evs.push({
        min,
        type: 'sub' as const,
        team: isHome ? 'home' : 'away',
        player: outPlayer.n,
        playerIn: inPlayer.n,
        tshort: t.short,
        isMy: tid === MY_TEAM_ID,
      });
    });
  });

  // Adiciona ao pool de minutos usados
  getMins(0);
  return evs;
}

// ─── Simula um segmento de tempo (1º ou 2º) ───
export function simMatchSegment(
  homeId: number,
  awayId: number,
  lineup: LineupSlot[],
  gameStyle: GameStyle,
  fromMin: number,
  toMin: number,
): MatchSegment {
  const home = getTeamData(homeId, lineup);
  const away = getTeamData(awayId, lineup);

  const isMyHome = homeId === MY_TEAM_ID;
  const isMyAway = awayId === MY_TEAM_ID;
  const style = (isMyHome || isMyAway) ? gameStyle : 'normal';
  const mult = STYLE_MULT[style];

  const hAttMult = isMyHome ? mult.my : isMyAway ? mult.opp : 1;
  const aAttMult = isMyAway ? mult.my : isMyHome ? mult.opp : 1;

  const timeFraction = (toMin - fromMin) / 94;
  const hXG = teamXG(home.att * hAttMult, away.def, HOME_ADV) * timeFraction;
  const aXG = teamXG(away.att * aAttMult, home.def) * timeFraction;

  const hG = poissonSample(hXG);
  const aG = poissonSample(aXG);

  const used = new Set<number>();
  const getMins = (n: number): number[] => {
    const m: number[] = [];
    let attempts = 0;
    while (m.length < n && attempts < 200) {
      const v = rnd(fromMin + 1, toMin);
      if (!used.has(v)) { used.add(v); m.push(v); }
      attempts++;
    }
    return m.sort((a, b) => a - b);
  };

  const evs: MatchEvent[] = [
    ...generateGoalEvents(home, homeId, 'home', hG, getMins),
    ...generateGoalEvents(away, awayId, 'away', aG, getMins),
    ...generateSaveEvents(home, away, homeId, awayId, rnd(1, 3), getMins),
    ...generatePostEvents(home, away, homeId, awayId, getMins),
    ...generateSubEvents(home, away, homeId, awayId, fromMin, toMin, getMins),
  ];

  addMatchCards(evs, home, away, homeId, awayId, used);

  evs.sort((a, b) => a.min - b.min);

  const segTimeFrac = timeFraction;
  const [possMin, possMax] = POSS_RANGE[style];
  const hPoss = isMyHome
    ? rnd(possMin, possMax)
    : isMyAway
    ? 100 - rnd(possMin, possMax)
    : rnd(42, 62);

  return {
    evs,
    hG,
    aG,
    hShots: rnd(Math.round(4 * segTimeFrac), Math.round(10 * segTimeFrac)),
    aShots: rnd(Math.round(3 * segTimeFrac), Math.round(8 * segTimeFrac)),
    hPoss,
  };
}

// ─── Monta MatchResult a partir dos 2 segmentos ───
export function buildMatchResult(seg1: MatchSegment, seg2: MatchSegment): MatchResult {
  return {
    seg1,
    seg2,
    hG: seg1.hG + seg2.hG,
    aG: seg1.aG + seg2.aG,
    evs: [...seg1.evs, ...seg2.evs].sort((a, b) => a.min - b.min),
    hShots: seg1.hShots + seg2.hShots,
    aShots: seg1.aShots + seg2.aShots,
    hPoss: Math.round((seg1.hPoss + seg2.hPoss) / 2),
  };
}

// ─── Compatibilidade: simula partida completa (rodadas sem Meu Time) ───
export function simMatch(
  homeId: number,
  awayId: number,
  lineup: LineupSlot[],
  gameStyle: GameStyle = 'normal',
): MatchResult {
  const seg1 = simMatchSegment(homeId, awayId, lineup, gameStyle, 0, 45);
  const seg2 = simMatchSegment(homeId, awayId, lineup, gameStyle, 46, 94);
  return buildMatchResult(seg1, seg2);
}

export function genSchedule(): [number, number][][] {
  const ids = TEAMS.map((t) => t.id);
  ids[19] = MY_TEAM_ID;

  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const n = 20;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const rounds: [number, number][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const circle = [fixed, ...rotating];
    const round: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      round.push([circle[i], circle[n - 1 - i]]);
    }
    rounds.push(round);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  const secondLeg = rounds.map((round) =>
    round.map(([h, a]) => [a, h] as [number, number])
  );

  return [...rounds, ...secondLeg];
}

export function initStandings(schedule: [number, number][][]): Standing[] {
  const ids = new Set<number>();
  schedule[0].forEach(([h, a]) => {
    ids.add(h);
    ids.add(a);
  });
  return Array.from(ids).map((id) => ({
    id,
    pts: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    played: 0,
  }));
}

export function updateStandings(
  standings: Standing[],
  homeId: number,
  awayId: number,
  homeG: number,
  awayG: number
): Standing[] {
  return standings.map((s) => {
    if (s.id === homeId) {
      const updated = { ...s, gf: s.gf + homeG, ga: s.ga + awayG, played: s.played + 1 };
      if (homeG > awayG) return { ...updated, pts: updated.pts + 3, w: updated.w + 1 };
      if (homeG < awayG) return { ...updated, l: updated.l + 1 };
      return { ...updated, pts: updated.pts + 1, d: updated.d + 1 };
    }
    if (s.id === awayId) {
      const updated = { ...s, gf: s.gf + awayG, ga: s.ga + homeG, played: s.played + 1 };
      if (awayG > homeG) return { ...updated, pts: updated.pts + 3, w: updated.w + 1 };
      if (homeG < awayG) return { ...updated, l: updated.l + 1 };
      return { ...updated, pts: updated.pts + 1, d: updated.d + 1 };
    }
    return s;
  });
}

export function sortedStandings(standings: Standing[]): Standing[] {
  return [...standings].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gf - b.ga !== a.gf - a.ga) return b.gf - b.ga - (a.gf - a.ga);
    return b.gf - a.gf;
  });
}

let _myTeamName = 'Meu Time';
let _myTeamShort = 'MEU';

export function setMyTeam(name: string, short: string) {
  _myTeamName = name;
  _myTeamShort = short;
}

export function getTeamDisplay(id: number) {
  if (id === MY_TEAM_ID) return { name: _myTeamName, short: _myTeamShort, c: MY_TEAM_EMOJI, logo: undefined, stadium: undefined };
  const t = TEAMS.find((x) => x.id === id)!;
  return { name: t.name, short: t.short, c: t.c, logo: t.logo, stadium: t.stadium };
}

export const LIVE_MINUTES = [10, 20, 30, 45, 46, 55, 65, 75, 85, 90, 91, 92, 93, 94];
