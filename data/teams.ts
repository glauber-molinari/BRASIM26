import type { Team } from '@/lib/types';
import { SPORTSDB_TEAM_LOGOS, SPORTSDB_TEAM_STADIUMS } from './sportsdb';
import playersData from '../players.json';

export const MY_TEAM_ID = 20;
export const MY_TEAM_EMOJI = '⚽';

const _TEAMS: Team[] = (playersData as Array<{
  id: number;
  name: string;
  short: string;
  c: string;
  att: number;
  def: number;
  squad: Array<{ n: string; p: string; photo?: string; number?: number; age?: number }>;
}>).map((t) => ({
  id: t.id,
  name: t.name,
  short: t.short,
  c: t.c,
  att: t.att,
  def: t.def,
  squad: t.squad.map((p) => ({
    n: p.n,
    p: p.p as 'GK' | 'DF' | 'MF' | 'FW',
    photo: p.photo,
  })),
}));

export const TEAMS: Team[] = _TEAMS.map((t) => ({
  ...t,
  logo: SPORTSDB_TEAM_LOGOS[t.short],
  stadium: SPORTSDB_TEAM_STADIUMS[t.short],
}));

/** Mapa nome → foto (da api-sports.io) para lookup em eventos ao vivo */
export const PLAYER_PHOTO_MAP: Record<string, string> = {};
for (const team of TEAMS) {
  for (const player of team.squad) {
    if (player.photo && !PLAYER_PHOTO_MAP[player.n]) {
      PLAYER_PHOTO_MAP[player.n] = player.photo;
    }
  }
}
