import { TEAMS, MY_TEAM_ID, MY_TEAM_EMOJI } from '@/data/teams';
import type {
  GameStyle,
  GoalKind,
  LineupSlot,
  LineupStrength,
  MatchEvent,
  MatchResult,
  MatchSegment,
  Player,
  PossSample,
  SegCarry,
  Standing,
  TeamData,
} from '@/lib/types';
import { rnd } from '@/lib/helpers';
import {
  getPlayerStrengthBonus,
  pickPenaltyTaker,
  pickWeightedAssister,
  pickWeightedCardPlayer,
  pickWeightedScorer,
} from '@/lib/playerWeights';

export const pickScorer = pickWeightedScorer;
export const pickCardPlayer = pickWeightedCardPlayer;

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

// ═══════════════════════════════════════════════════════════════════════════
// Motor de partida — simulação minuto a minuto (cadeia de lances)
//
// Em vez de sortear totais e espalhar minutos, cada minuto rola a chance de
// finalização de cada time; o lance resolve em gol / defesa / trave /
// bloqueado / pra fora. Assim TODAS as estatísticas (chutes, chutes no gol,
// defesas, escanteios) saem coerentes com os eventos por construção, e o
// estado do jogo (placar, expulsões, reta final) influencia o que acontece —
// o mesmo princípio dos engines de Football Manager e dos trackers ao vivo.
// ═══════════════════════════════════════════════════════════════════════════

// Brasileirão avg ~1.25 goals per team per match; team quality shifts λ
const BASE_XG = 1.25;
const AVG_RATING = 68;
const HOME_ADV = 1.3;            // mandante no BR vence ~50% (vantagem real é alta)
const AWAY_PEN = 0.88;           // visitante produz menos

const SHOTS_AVG = 11.4;          // finalizações por time/jogo
const GOAL_TUNE = 0.84;          // compensa a inflação de momentum/reta final no xG
const MATCH_MINUTES = 94;
const YELLOWS_PER_MATCH = 2.8;   // total dos dois times
const DIRECT_REDS_PER_MATCH = 0.07;
const PENS_PER_MATCH = 0.22;     // pênaltis por jogo (dois times)
const VAR_CANCEL_RATE = 0.045;   // gols anulados pelo VAR

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

// Volume de finalizações e perfil de gols por estilo (xG é preservado pelo
// multiplicador de ataque; aqui só muda COMO o time chega ao gol)
const STYLE_FLAVOR: Record<GameStyle, { vol: number; counter: number }> = {
  normal:       { vol: 1.0,  counter: 0.12 },
  contraAtaque: { vol: 0.85, counter: 0.34 },
  retranca:     { vol: 0.8,  counter: 0.26 },
  tikaTaka:     { vol: 1.12, counter: 0.05 },
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Gols se concentram no fim dos tempos (45', 90'+ têm pico real)
function timeWeight(min: number): number {
  if (min <= 45) {
    let w = 0.86 + 0.28 * (min / 45);
    if (min >= 44) w += 0.35;
    return w;
  }
  const m2 = min - 45;
  let w = 0.9 + 0.24 * (m2 / 49);
  if (min >= 90) w += 0.45;
  return w;
}

// Quem está perdendo se lança ao ataque; quem vence administra
function momentum(diff: number, min: number): number {
  if (diff < 0) return min >= 75 ? 1.34 : min >= 55 ? 1.2 : 1.08;
  if (diff > 0) return diff >= 2 ? 0.82 : 0.9;
  return min >= 80 ? 1.08 : 1;
}

interface SideState {
  td: TeamData;
  id: number;
  side: 'home' | 'away';
  shotPm: number;       // P(finalização) por minuto
  conv: number;         // P(gol | finalização)
  flavor: { vol: number; counter: number };
  goals: number;        // placar corrente (inclui carry do 1º tempo)
  reds: number;
  scored: Set<string>;
  shotMins: number[];
  sotMins: number[];
  cornerMins: number[];
}

function makeSide(
  td: TeamData,
  id: number,
  side: 'home' | 'away',
  att: number,
  oppDef: number,
  adv: number,
  flavor: { vol: number; counter: number },
  goals: number,
  reds: number,
): SideState {
  const ratio = (att / AVG_RATING) / (oppDef / AVG_RATING);
  const xgFull = teamXG(att, oppDef, adv);
  const expShots = SHOTS_AVG * Math.sqrt(Math.max(0.4, ratio * adv)) * flavor.vol;
  return {
    td, id, side,
    shotPm: expShots / MATCH_MINUTES,
    conv: clamp(GOAL_TUNE * xgFull / expShots, 0.055, 0.21),
    flavor,
    goals,
    reds,
    scored: new Set(),
    shotMins: [],
    sotMins: [],
    cornerMins: [],
  };
}

function findGk(squad: Player[]): Player | null {
  return squad.find((p) => p.p === 'GK') ?? squad[0] ?? null;
}

function pickGoalKind(flavor: { counter: number }, fromCorner: boolean): GoalKind {
  if (fromCorner) return Math.random() < 0.6 ? 'header' : 'normal';
  const r = Math.random();
  let acc = flavor.counter;
  if (r < acc) return 'counter';
  acc += 0.13;
  if (r < acc) return 'header';
  acc += 0.11;
  if (r < acc) return 'longshot';
  acc += 0.055;
  if (r < acc) return 'freekick';
  return 'normal';
}

// ─── Substituições da IA (Meu Time é manual) ───
function genAiSubs(st: SideState, fromMin: number, toMin: number): MatchEvent[] {
  if (st.id === MY_TEAM_ID) return [];
  const lo = Math.max(fromMin + 1, 50);
  const hi = Math.min(toMin - 2, 88);
  if (hi <= lo) return [];

  const nonGK = st.td.squad.filter((p) => p.p !== 'GK');
  if (nonGK.length < 2) return [];

  const numSubs = rnd(2, 3);
  const mins: number[] = [];
  for (let i = 0; i < numSubs; i++) {
    // Janelas realistas: poucas no início do 2º tempo, maioria entre 60–78
    const r = Math.random();
    const min = r < 0.18 ? rnd(46, 60) : r < 0.75 ? rnd(61, 78) : rnd(79, 88);
    if (min >= lo && min <= hi) mins.push(min);
  }
  mins.sort((a, b) => a - b);

  const evs: MatchEvent[] = [];
  const subbedOut = new Set<string>();
  mins.forEach((min) => {
    const outPool = nonGK.filter((p) => !subbedOut.has(p.n));
    if (!outPool.length) return;
    const outPlayer = outPool[rnd(0, outPool.length - 1)];
    const inPool = nonGK.filter((p) => p.n !== outPlayer.n && !subbedOut.has(p.n));
    const inPlayer = inPool.length ? inPool[rnd(0, inPool.length - 1)] : outPlayer;
    subbedOut.add(outPlayer.n);
    evs.push({
      min,
      type: 'sub',
      team: st.side,
      player: outPlayer.n,
      playerIn: inPlayer.n,
      tshort: st.td.short,
      isMy: false,
    });
  });
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
  carry?: SegCarry,
): MatchSegment {
  const home = getTeamData(homeId, lineup);
  const away = getTeamData(awayId, lineup);

  const isMyHome = homeId === MY_TEAM_ID;
  const isMyAway = awayId === MY_TEAM_ID;
  const style = (isMyHome || isMyAway) ? gameStyle : 'normal';
  const mult = STYLE_MULT[style];

  const hAtt = home.att * (isMyHome ? mult.my : isMyAway ? mult.opp : 1);
  const aAtt = away.att * (isMyAway ? mult.my : isMyHome ? mult.opp : 1);
  const hFlavor = STYLE_FLAVOR[isMyHome ? style : 'normal'];
  const aFlavor = STYLE_FLAVOR[isMyAway ? style : 'normal'];

  const H = makeSide(home, homeId, 'home', hAtt, away.def, HOME_ADV, hFlavor,
    carry?.hG ?? 0, carry?.hRed ?? 0);
  const A = makeSide(away, awayId, 'away', aAtt, home.def, AWAY_PEN, aFlavor,
    carry?.aG ?? 0, carry?.aRed ?? 0);

  const startHG = H.goals;
  const startAG = A.goals;

  const evs: MatchEvent[] = [];
  const booked = new Set<string>(carry?.booked ?? []);
  const penPm = PENS_PER_MATCH / 2 / MATCH_MINUTES;

  const pushEv = (ev: Omit<MatchEvent, 'isMy'> & { isMy?: boolean }, st: SideState) => {
    evs.push({ ...ev, isMy: st.id === MY_TEAM_ID });
  };

  const resolvePen = (me: SideState, opp: SideState, min: number) => {
    if (!me.td.squad.length) return;
    me.shotMins.push(min);
    const taker = pickPenaltyTaker(me.td.squad);
    const r = Math.random();
    if (r < 0.76) {
      me.sotMins.push(min);
      me.goals++;
      me.scored.add(taker.n);
      pushEv({ min, type: 'goal', team: me.side, player: taker.n, goalKind: 'pen', pen: true, tshort: me.td.short }, me);
    } else if (r < 0.93) {
      me.sotMins.push(min);
      const gk = findGk(opp.td.squad);
      if (gk) pushEv({ min, type: 'save', team: opp.side, player: gk.n, pen: true, tshort: opp.td.short }, opp);
    } else {
      pushEv({ min, type: 'miss', team: me.side, player: taker.n, pen: true, tshort: me.td.short }, me);
    }
  };

  const resolveChance = (me: SideState, opp: SideState, min: number) => {
    if (!me.td.squad.length) return;
    me.shotMins.push(min);

    // ~22% das chances nascem de escanteio (coreografado no campinho)
    const fromCorner = Math.random() < 0.22;
    if (fromCorner) {
      me.cornerMins.push(min);
      const taker = pickWeightedAssister(me.td.squad, '') ?? me.td.squad[0];
      pushEv({ min, type: 'corner', team: me.side, player: taker.n, tshort: me.td.short }, me);
    }

    const r = Math.random();
    if (r < me.conv) {
      me.sotMins.push(min);
      const scorer = pickScorer(me.td.squad, me.scored);
      // VAR anula uma pequena fração dos gols — drama sem mudar o placar
      if (Math.random() < VAR_CANCEL_RATE) {
        pushEv({ min, type: 'var', team: me.side, player: scorer.n, tshort: me.td.short }, me);
        return;
      }
      const kind = pickGoalKind(me.flavor, fromCorner);
      me.scored.add(scorer.n);
      me.goals++;
      const assister =
        kind !== 'freekick' && Math.random() < 0.74
          ? pickWeightedAssister(me.td.squad, scorer.n)
          : null;
      pushEv({
        min, type: 'goal', team: me.side, player: scorer.n,
        assist: assister?.n, goalKind: kind, tshort: me.td.short,
      }, me);
      return;
    }

    // Lance sem gol: defesa / trave / bloqueado / pra fora
    const r2 = (r - me.conv) / (1 - me.conv);
    if (r2 < 0.27) {
      me.sotMins.push(min);
      const gk = findGk(opp.td.squad);
      // Só as defesas mais difíceis viram evento; as demais contam na estatística
      if (gk && Math.random() < 0.55) {
        pushEv({ min, type: 'save', team: opp.side, player: gk.n, tshort: opp.td.short }, opp);
      }
    } else if (r2 < 0.305) {
      const shooter = pickScorer(me.td.squad, new Set());
      pushEv({ min, type: 'post', team: me.side, player: shooter.n, tshort: me.td.short }, me);
    } else if (r2 < 0.545) {
      // Bloqueado pela zaga; parte vira escanteio
      if (Math.random() < 0.55) me.cornerMins.push(min);
    } else {
      // Pra fora — só as chances incríveis perdidas viram evento
      if (Math.random() < 0.22) {
        const shooter = pickScorer(me.td.squad, new Set());
        pushEv({ min, type: 'miss', team: me.side, player: shooter.n, tshort: me.td.short }, me);
      }
    }
  };

  // ─── Posse de bola: alvo por estilo/força, com deriva e ruído ───
  let baseTarget: number;
  if (isMyHome || isMyAway) {
    const [pmin, pmax] = POSS_RANGE[style];
    const myMid = (pmin + pmax) / 2;
    baseTarget = isMyHome ? myMid : 100 - myMid;
  } else {
    baseTarget = 50 + (home.att + home.def - away.att - away.def) * 0.22;
  }
  baseTarget += 2; // mando de campo

  const possTimeline: PossSample[] = [];
  let poss = carry?.hPoss ?? 50;

  // ─── Loop principal ───
  for (let min = fromMin + 1; min <= toMin; min++) {
    const tw = timeWeight(min);

    for (const [me, opp] of [[H, A], [A, H]] as [SideState, SideState][]) {
      const mom = momentum(me.goals - opp.goals, min);
      const redAtk = Math.pow(0.66, me.reds);
      const oppRedBoost = Math.pow(1.25, opp.reds);

      if (Math.random() < penPm * tw * mom * oppRedBoost) {
        resolvePen(me, opp, min);
      }
      if (Math.random() < me.shotPm * tw * mom * redAtk * oppRedBoost) {
        resolveChance(me, opp, min);
      }
      // Escanteios que não geram finalização (só estatística)
      if (Math.random() < (1.05 / MATCH_MINUTES) * mom) {
        me.cornerMins.push(min);
      }
    }

    // Cartões: mais frequentes na reta final; lado perdedor faz mais falta
    const cardP = (YELLOWS_PER_MATCH / MATCH_MINUTES) * (min >= 60 ? 1.25 : 0.9);
    if (Math.random() < cardP) {
      const pHome = H.goals < A.goals ? 0.56 : A.goals < H.goals ? 0.44 : 0.5;
      const st = Math.random() < pHome ? H : A;
      if (st.td.squad.length) {
        let pl = pickCardPlayer(st.td.squad);
        const key = `${st.td.short}:${pl.n}`;
        if (booked.has(key) && Math.random() < 0.4) {
          // Segundo amarelo → expulsão
          st.reds++;
          pushEv({ min, type: 'red', team: st.side, player: pl.n, secondYellow: true, tshort: st.td.short }, st);
        } else {
          if (booked.has(key)) {
            const pool = st.td.squad.filter((p) => !booked.has(`${st.td.short}:${p.n}`));
            if (pool.length) pl = pickCardPlayer(pool);
          }
          booked.add(`${st.td.short}:${pl.n}`);
          pushEv({ min, type: 'yellow', team: st.side, player: pl.n, tshort: st.td.short }, st);
        }
      }
    }
    if (Math.random() < DIRECT_REDS_PER_MATCH / MATCH_MINUTES) {
      const st = Math.random() < 0.5 ? H : A;
      if (st.td.squad.length) {
        const pl = pickCardPlayer(st.td.squad);
        st.reds++;
        pushEv({ min, type: 'red', team: st.side, player: pl.n, tshort: st.td.short }, st);
      }
    }

    // Amostra de posse a cada 4'
    if ((min - fromMin) % 4 === 0 || min === toMin) {
      const target = clamp(baseTarget - H.reds * 7 + A.reds * 7, 30, 70);
      poss += (target - poss) * 0.22 + (Math.random() * 6 - 3);
      poss = clamp(poss, 28, 72);
      possTimeline.push({ min, h: Math.round(poss) });
    }
  }

  evs.push(...genAiSubs(H, fromMin, toMin), ...genAiSubs(A, fromMin, toMin));
  evs.sort((a, b) => a.min - b.min);

  return {
    evs,
    hG: H.goals - startHG,
    aG: A.goals - startAG,
    hShots: H.shotMins.length,
    aShots: A.shotMins.length,
    hPoss: possTimeline.length ? possTimeline[possTimeline.length - 1].h : Math.round(poss),
    hShotMins: H.shotMins,
    aShotMins: A.shotMins,
    hSotMins: H.sotMins,
    aSotMins: A.sotMins,
    hCornerMins: H.cornerMins,
    aCornerMins: A.cornerMins,
    possTimeline,
  };
}

// ─── Estado herdado entre tempos: placar, expulsões e amarelados ───
export function carryFromSegment(seg: MatchSegment, prev?: SegCarry): SegCarry {
  const booked = new Set<string>(prev?.booked ?? []);
  let hRed = prev?.hRed ?? 0;
  let aRed = prev?.aRed ?? 0;
  for (const ev of seg.evs) {
    if (ev.type === 'yellow') booked.add(`${ev.tshort}:${ev.player}`);
    if (ev.type === 'red') {
      if (ev.team === 'home') hRed++;
      else aRed++;
    }
  }
  return {
    hG: (prev?.hG ?? 0) + seg.hG,
    aG: (prev?.aG ?? 0) + seg.aG,
    hRed,
    aRed,
    hPoss: seg.hPoss,
    booked: Array.from(booked),
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
    hPoss: Math.round(((seg1.hPoss ?? 50) * 45 + (seg2.hPoss ?? 50) * 49) / 94),
    hSot: (seg1.hSotMins?.length ?? 0) + (seg2.hSotMins?.length ?? 0),
    aSot: (seg1.aSotMins?.length ?? 0) + (seg2.aSotMins?.length ?? 0),
    hCorners: (seg1.hCornerMins?.length ?? 0) + (seg2.hCornerMins?.length ?? 0),
    aCorners: (seg1.aCornerMins?.length ?? 0) + (seg2.aCornerMins?.length ?? 0),
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
  const seg2 = simMatchSegment(homeId, awayId, lineup, gameStyle, 46, 94, carryFromSegment(seg1));
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
