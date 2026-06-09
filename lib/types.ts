export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  n: string;
  p: Position;
}

export interface Team {
  id: number;
  name: string;
  short: string;
  c: string;
  logo?: string;
  stadium?: string;
  att: number;
  def: number;
  squad: Player[];
}

export interface SelectedPlayer extends Player {
  tid: number;
  tc: string;
  tl?: string;
  tn: string;
  ts: string;
}

export interface LineupSlot {
  pos: Position;
  player: SelectedPlayer | null;
}

export interface MatchEvent {
  min: number;
  type: 'goal' | 'yellow' | 'red';
  team: 'home' | 'away';
  player: string;
  tshort: string;
  isMy: boolean;
}

export interface MatchResult {
  hG: number;
  aG: number;
  evs: MatchEvent[];
  hShots: number;
  aShots: number;
  hPoss: number;
}

export interface Standing {
  id: number;
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  played: number;
}

export interface StoredMatch {
  round: number;
  home: number;
  away: number;
  hG: number;
  aG: number;
  evs: MatchEvent[];
}

export interface MatchHistoryEntry {
  round: number;
  home: string;
  away: string;
  hG: number;
  aG: number;
  result: 'W' | 'D' | 'L';
}

export type TacticKey = '4-4-2' | '4-3-3' | '4-5-1' | '3-5-2' | '5-3-2';

export type GameStyle = 'normal' | 'contraAtaque' | 'retranca' | 'tikaTaka';

export type SimSpeed = 700 | 250 | 60;

export type Screen = 'setup' | 'build' | 'sim' | 'result';

export type LivePhase = 'pre' | 'live' | 'post';

export interface TeamData {
  id: number;
  name: string;
  short: string;
  c: string;
  logo?: string;
  stadium?: string;
  att: number;
  def: number;
  squad: Player[];
}

export interface LineupStrength {
  count: number;
  att: number;
  def: number;
  overall: number;
  isComplete: boolean;
  bonus: number;
}
