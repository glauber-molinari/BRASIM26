export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  n: string;
  p: Position;
  photo?: string;
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

/** Tipo de jogada que originou o gol — muda narração e coreografia no campinho */
export type GoalKind = 'normal' | 'header' | 'longshot' | 'counter' | 'freekick' | 'pen';

export interface MatchEvent {
  min: number;
  type: 'goal' | 'yellow' | 'red' | 'save' | 'post' | 'sub' | 'miss' | 'corner' | 'var';
  team: 'home' | 'away';
  player: string;      // jogador que sai (em subs)
  playerIn?: string;   // jogador que entra (em subs)
  assist?: string;     // garçom (em gols de jogada)
  goalKind?: GoalKind;
  pen?: boolean;       // lance de pênalti (em save/miss = pênalti desperdiçado)
  secondYellow?: boolean; // expulsão por 2º amarelo
  tshort: string;
  isMy: boolean;
}

/** Amostra de posse ao longo do tempo — permite posse "viva" no placar */
export interface PossSample {
  min: number;
  h: number;
}

export interface MatchSegment {
  evs: MatchEvent[];
  hG: number;
  aG: number;
  hShots: number;
  aShots: number;
  hPoss: number;
  /** Minutos de cada finalização — stats ao vivo 100% coerentes com os lances */
  hShotMins?: number[];
  aShotMins?: number[];
  hSotMins?: number[];
  aSotMins?: number[];
  hCornerMins?: number[];
  aCornerMins?: number[];
  possTimeline?: PossSample[];
}

export interface MatchResult {
  seg1: MatchSegment;
  seg2: MatchSegment;
  hG: number;
  aG: number;
  evs: MatchEvent[];
  hShots: number;
  aShots: number;
  hPoss: number;
  hSot?: number;
  aSot?: number;
  hCorners?: number;
  aCorners?: number;
}

/** Estado herdado do tempo anterior — placar e expulsões moldam o 2º tempo */
export interface SegCarry {
  hG: number;
  aG: number;
  hRed: number;
  aRed: number;
  hPoss?: number;
  /** "TIME:Jogador" já amarelados — risco de 2º amarelo no tempo seguinte */
  booked?: string[];
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

export type SimSpeed = 2200 | 700 | 120;

export type Screen = 'setup' | 'build' | 'sim' | 'result';

export type LivePhase = 'pre' | 'live1' | 'halftime' | 'live2' | 'post';

export type ShieldShape = 'classic' | 'modern' | 'angular' | 'round' | 'crest';
export type ShieldAdornment = 'none' | 'vstripe' | 'hstripes' | 'diag' | 'cross' | 'halves' | 'chevron';

export interface ShieldConfig {
  shape: ShieldShape;
  primary: string;
  secondary: string;
  tertiary: string;
  adornment: ShieldAdornment;
}

export const DEFAULT_SHIELD: ShieldConfig = {
  shape: 'classic',
  primary: '#1A56DB',
  secondary: '#F5F5F5',
  tertiary: '#F5F5F5',
  adornment: 'none',
};

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
