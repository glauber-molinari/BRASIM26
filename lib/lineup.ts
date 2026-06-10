import { TEAMS } from '@/data/teams';
import { TACTICS } from '@/data/tactics';
import type { LineupSlot, Position, SelectedPlayer, TacticKey } from '@/lib/types';
import { rnd } from '@/lib/helpers';

export function buildLineupFromTactic(tactic: TacticKey): LineupSlot[] {
  const t = TACTICS[tactic];
  const slots: LineupSlot[] = [{ pos: 'GK', player: null }];
  for (let i = 0; i < t.df; i++) slots.push({ pos: 'DF', player: null });
  for (let i = 0; i < t.mf; i++) slots.push({ pos: 'MF', player: null });
  for (let i = 0; i < t.fw; i++) slots.push({ pos: 'FW', player: null });
  return slots;
}

export function applyTactic(
  tactic: TacticKey,
  currentLineup: LineupSlot[]
): { lineup: LineupSlot[]; teamUsage: Record<number, number> } {
  const newLU = buildLineupFromTactic(tactic);
  const old: Partial<Record<Position, SelectedPlayer[]>> = {};

  currentLineup.forEach((s) => {
    if (s.player) {
      if (!old[s.pos]) old[s.pos] = [];
      old[s.pos]!.push(s.player);
    }
  });

  newLU.forEach((s) => {
    if (old[s.pos]?.length) {
      s.player = old[s.pos]!.shift() ?? null;
    }
  });

  const teamUsage: Record<number, number> = {};
  newLU.forEach((s) => {
    if (s.player) {
      teamUsage[s.player.tid] = (teamUsage[s.player.tid] || 0) + 1;
    }
  });

  return { lineup: newLU, teamUsage };
}

export function rollRandomLineup(): {
  tactic: TacticKey;
  lineup: LineupSlot[];
  bench: (SelectedPlayer | null)[];
  teamUsage: Record<number, number>;
  firstTeamTab: number;
} {
  const tacticKeys = Object.keys(TACTICS) as TacticKey[];
  const tactic = tacticKeys[rnd(0, tacticKeys.length - 1)];
  const lineup = buildLineupFromTactic(tactic);
  const teamUsage: Record<number, number> = {};
  let firstTeamTab = 0;

  // Roll 11 starters
  lineup.forEach((slot, i) => {
    const candidates: { team: (typeof TEAMS)[0]; player: (typeof TEAMS)[0]['squad'][0] }[] = [];
    TEAMS.forEach((team) => {
      team.squad
        .filter((p) => p.p === slot.pos)
        .forEach((player) => candidates.push({ team, player }));
    });

    let attempts = 0;
    while (attempts < 200) {
      const pick = candidates[rnd(0, candidates.length - 1)];
      const used = teamUsage[pick.team.id] || 0;
      const alreadyIn = lineup.some(
        (s) => s.player?.n === pick.player.n && s.player?.tid === pick.team.id
      );
      if (used < 3 && !alreadyIn) {
        slot.player = {
          n: pick.player.n,
          p: slot.pos,
          photo: pick.player.photo,
          tid: pick.team.id,
          tc: pick.team.c,
          tl: pick.team.logo,
          tn: pick.team.name,
          ts: pick.team.short,
        };
        teamUsage[pick.team.id] = used + 1;
        if (i === 0) firstTeamTab = pick.team.id;
        break;
      }
      attempts++;
    }
  });

  // Roll 5 bench players: 1 GK, 1 DF, 1 MF, 1 MF, 1 FW
  const benchPositions: Position[] = ['GK', 'DF', 'MF', 'MF', 'FW'];
  const benchPlayers: SelectedPlayer[] = [];

  benchPositions.forEach((pos) => {
    const candidates: { team: (typeof TEAMS)[0]; player: (typeof TEAMS)[0]['squad'][0] }[] = [];
    TEAMS.forEach((team) => {
      team.squad
        .filter((p) => p.p === pos)
        .forEach((player) => candidates.push({ team, player }));
    });

    let attempts = 0;
    while (attempts < 200) {
      const pick = candidates[rnd(0, candidates.length - 1)];
      const used = teamUsage[pick.team.id] || 0;
      const alreadyInLineup = lineup.some(
        (s) => s.player?.n === pick.player.n && s.player?.tid === pick.team.id
      );
      const alreadyInBench = benchPlayers.some(
        (p) => p.n === pick.player.n && p.tid === pick.team.id
      );
      if (used < 3 && !alreadyInLineup && !alreadyInBench) {
        benchPlayers.push({
          n: pick.player.n,
          p: pos,
          photo: pick.player.photo,
          tid: pick.team.id,
          tc: pick.team.c,
          tl: pick.team.logo,
          tn: pick.team.name,
          ts: pick.team.short,
        });
        teamUsage[pick.team.id] = used + 1;
        break;
      }
      attempts++;
    }
  });

  // Pad to 5 slots with null if needed
  const bench: (SelectedPlayer | null)[] = [...benchPlayers];
  while (bench.length < 5) bench.push(null);

  return { tactic, lineup, bench, teamUsage, firstTeamTab };
}
