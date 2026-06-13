'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MY_TEAM_ID, PLAYER_PHOTO_MAP } from '@/data/teams';
import { getMyTeamData, getTeamDisplay } from '@/lib/simulator';
import { shn, sleep } from '@/lib/helpers';
import { getPlayerPhoto } from '@/data/playerPhotos';
import type {
  GameStyle,
  LineupSlot,
  LivePhase,
  MatchEvent,
  MatchResult,
  MatchSegment,
  SelectedPlayer,
  ShieldConfig,
  Standing,
  StoredMatch,
} from '@/lib/types';
import MatchPitch from './MatchPitch';
import OverlayStandings from './OverlayStandings';
import TeamLogo from './TeamLogo';
import ShieldSvg from './ShieldSvg';

const LIVE_MINUTES_1 = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 45];
const LIVE_MINUTES_2 = [50, 54, 58, 62, 66, 70, 74, 78, 82, 86, 90, 92, 94];

// Modo do painel lateral
type SideMode = 'default' | 'subOut' | 'subIn';

/** Minutos de acréscimo exibidos como "90+x" (padrão broadcast) */
function fmtMin(min: number): string {
  return min > 90 ? `90+${min - 90}` : `${min}`;
}

interface LiveStatsSnapshot {
  hShots: number;
  aShots: number;
  hSot: number;
  aSot: number;
  hCorners: number;
  aCorners: number;
  hSaves: number;
  aSaves: number;
  hPoss: number;
}

const EMPTY_STATS: LiveStatsSnapshot = {
  hShots: 0, aShots: 0, hSot: 0, aSot: 0,
  hCorners: 0, aCorners: 0, hSaves: 0, aSaves: 0, hPoss: 50,
};

// Stats num dado minuto, derivadas das timelines do motor — sempre coerentes
// com os lances exibidos (chutes ≥ no gol ≥ gols; defesas = no gol − gols).
function computeStats(
  min: number,
  seg1: MatchSegment | null,
  seg2: MatchSegment | null,
): LiveStatsSnapshot {
  const count = (arr?: number[]) => (arr ? arr.filter((m) => m <= min).length : 0);
  const goals = (seg: MatchSegment | null, team: 'home' | 'away') =>
    seg ? seg.evs.filter((e) => e.type === 'goal' && e.team === team && e.min <= min).length : 0;

  const hSot = count(seg1?.hSotMins) + count(seg2?.hSotMins);
  const aSot = count(seg1?.aSotMins) + count(seg2?.aSotMins);
  const hGoals = goals(seg1, 'home') + goals(seg2, 'home');
  const aGoals = goals(seg1, 'away') + goals(seg2, 'away');

  let hPoss = 50;
  for (const s of [...(seg1?.possTimeline ?? []), ...(seg2?.possTimeline ?? [])]) {
    if (s.min <= min) hPoss = s.h;
  }

  return {
    hShots: count(seg1?.hShotMins) + count(seg2?.hShotMins),
    aShots: count(seg1?.aShotMins) + count(seg2?.aShotMins),
    hSot,
    aSot,
    hCorners: count(seg1?.hCornerMins) + count(seg2?.hCornerMins),
    aCorners: count(seg1?.aCornerMins) + count(seg2?.aCornerMins),
    hSaves: Math.max(0, aSot - aGoals),
    aSaves: Math.max(0, hSot - hGoals),
    hPoss,
  };
}

interface LiveOverlayProps {
  visible: boolean;
  phase: LivePhase;
  round: number;
  homeId: number;
  awayId: number;
  seg1: MatchSegment | null;
  seg2: MatchSegment | null;
  result: MatchResult | null;
  speed: number;
  lineup: LineupSlot[];
  bench: (SelectedPlayer | null)[];
  currentTactic: string;
  currentStyle: GameStyle;
  onPlay: () => void;
  onHalftimeReady: () => void;
  onSecondHalfStart: () => void;
  onLiveComplete: () => void;
  onContinue: () => void;
  onReset: () => void;
  onEditLineup: () => void;
  onDismiss: () => void;
  onSubstitute: (
    slotIdx: number,
    newPlayer: SelectedPlayer,
    outPlayer: SelectedPlayer,
    minute: number,
  ) => void;
  onChangeTactic: (tactic: string) => void;
  onChangeStyle: (style: GameStyle) => void;
  standings: Standing[];
  roundMatches: StoredMatch[];
  shieldConfig: ShieldConfig;
}

export default function LiveOverlay({
  visible,
  phase,
  round,
  homeId,
  awayId,
  seg1,
  seg2,
  result,
  speed,
  lineup,
  bench,
  currentTactic,
  currentStyle,
  onPlay,
  onHalftimeReady,
  onSecondHalfStart,
  onLiveComplete,
  onContinue,
  onReset,
  onEditLineup,
  onDismiss,
  onSubstitute,
  onChangeTactic,
  onChangeStyle,
  standings,
  roundMatches,
  shieldConfig,
}: LiveOverlayProps) {
  // ── Animação ──
  const [liveMin, setLiveMin] = useState(0);
  const [liveScore, setLiveScore] = useState({ h: 0, a: 0 });
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStatsSnapshot>(EMPTY_STATS);

  // ── Painel lateral ──
  const [sideMode, setSideMode] = useState<SideMode>('default');
  const [pendingSubOutIdx, setPendingSubOutIdx] = useState<number | null>(null);

  const animatingRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);
  const evsRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef({ h: 0, a: 0 });

  const home = getTeamDisplay(homeId);
  const away = getTeamDisplay(awayId);
  const myStrength = getMyTeamData(lineup);
  const isLive = phase === 'live1' || phase === 'live2';
  const canClose = phase === 'post';

  // Painel lateral visível no intervalo e na pausa
  const showSidePanel = phase === 'halftime' || (isLive && isPaused);
  const showStandings = phase === 'post' && standings.length > 0;

  // Campinho animado — só na velocidade Normal (2200ms por tick)
  const showPitch = isLive && speed === 2200;
  const lastPitchEvent =
    liveEvents.length > 0
      ? { ev: liveEvents[liveEvents.length - 1], id: liveEvents.length }
      : null;

  // ── Reset ao trocar de partida ──
  useEffect(() => {
    if (phase === 'pre') {
      setLiveMin(0);
      setLiveScore({ h: 0, a: 0 });
      setLiveEvents([]);
      setProgress(0);
      setIsPaused(false);
      setLiveStats(EMPTY_STATS);
      animatingRef.current = false;
      pausedRef.current = false;
      resumeRef.current = null;
      scoreRef.current = { h: 0, a: 0 };
    }
  }, [phase, homeId, awayId]);

  // ── Reset painel lateral ao trocar de fase ──
  useEffect(() => {
    setSideMode('default');
    setPendingSubOutIdx(null);
  }, [phase]);

  // ── Reset painel lateral ao retomar ──
  useEffect(() => {
    if (!isPaused) {
      setSideMode('default');
      setPendingSubOutIdx(null);
    }
  }, [isPaused]);

  // ── sleepOrPause ──
  const sleepOrPause = useCallback(async (ms: number) => {
    const CHUNK = 60;
    let elapsed = 0;
    while (elapsed < ms) {
      if (pausedRef.current) {
        await new Promise<void>((resolve) => { resumeRef.current = resolve; });
      }
      const wait = Math.min(CHUNK, ms - elapsed);
      await sleep(wait);
      elapsed += wait;
    }
  }, []);

  // Pausa após cada evento do feed. Na velocidade Normal (com campinho),
  // respeita a duração da coreografia da bola para a animação acompanhar.
  const pauseFor = useCallback((ev: MatchEvent) => {
    if (speed !== 2200) return speed * 0.35;
    if (ev.type === 'goal') return speed * (ev.pen || ev.goalKind === 'counter' || ev.goalKind === 'freekick' ? 2.6 : 2.2);
    if (ev.type === 'var') return speed * 2.6;
    if (ev.type === 'save' || ev.type === 'miss') return speed * (ev.pen ? 2.2 : 1.0);
    if (ev.type === 'post') return speed * 0.95;
    if (ev.type === 'corner') return speed * 0.85;
    return speed * 0.6;
  }, [speed]);

  const pauseMatch = useCallback(() => { pausedRef.current = true; setIsPaused(true); }, []);
  const resumeMatch = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
    resumeRef.current?.();
    resumeRef.current = null;
  }, []);
  const togglePause = useCallback(() => {
    if (pausedRef.current) resumeMatch(); else pauseMatch();
  }, [pauseMatch, resumeMatch]);

  // ── Animação 1º tempo ──
  useEffect(() => {
    if (phase !== 'live1' || !seg1 || animatingRef.current) return;
    animatingRef.current = true;
    (async () => {
      let hs = scoreRef.current.h;
      let as = scoreRef.current.a;
      const queue = [...seg1.evs];
      for (const min of LIVE_MINUTES_1) {
        setLiveMin(min);
        setProgress(Math.min(48, (min / 45) * 48));
        setLiveStats(computeStats(min, seg1, null));
        while (queue.length && queue[0].min <= min) {
          const ev = queue.shift()!;
          if (ev.type === 'goal') { if (ev.team === 'home') hs++; else as++; setLiveScore({ h: hs, a: as }); }
          setLiveEvents((prev) => [...prev, ev]);
          await sleepOrPause(pauseFor(ev));
        }
        await sleepOrPause(speed * 0.32);
      }
      while (queue.length) {
        const ev = queue.shift()!;
        if (ev.type === 'goal') { if (ev.team === 'home') hs++; else as++; setLiveScore({ h: hs, a: as }); }
        setLiveEvents((prev) => [...prev, ev]);
        await sleepOrPause(speed === 2200 ? pauseFor(ev) : speed * 0.2);
      }
      setLiveMin(45); setProgress(48);
      setLiveStats(computeStats(45, seg1, null));
      scoreRef.current = { h: hs, a: as };
      await sleepOrPause(speed * 0.4);
      animatingRef.current = false;
      onHalftimeReady();
    })();
  }, [phase, seg1, speed, sleepOrPause, pauseFor, onHalftimeReady]);

  // ── Animação 2º tempo ──
  useEffect(() => {
    if (phase !== 'live2' || !seg2 || animatingRef.current) return;
    animatingRef.current = true;
    (async () => {
      let hs = scoreRef.current.h;
      let as = scoreRef.current.a;
      const queue = [...seg2.evs];
      for (const min of LIVE_MINUTES_2) {
        setLiveMin(min);
        setProgress(50 + Math.min(50, ((min - 46) / 48) * 50));
        setLiveStats(computeStats(min, seg1, seg2));
        while (queue.length && queue[0].min <= min) {
          const ev = queue.shift()!;
          if (ev.type === 'goal') { if (ev.team === 'home') hs++; else as++; setLiveScore({ h: hs, a: as }); }
          setLiveEvents((prev) => [...prev, ev]);
          await sleepOrPause(pauseFor(ev));
        }
        await sleepOrPause(speed * 0.32);
      }
      while (queue.length) {
        const ev = queue.shift()!;
        if (ev.type === 'goal') { if (ev.team === 'home') hs++; else as++; setLiveScore({ h: hs, a: as }); }
        setLiveEvents((prev) => [...prev, ev]);
        await sleepOrPause(speed === 2200 ? pauseFor(ev) : speed * 0.2);
      }
      setLiveMin(94); setProgress(100);
      setLiveStats(computeStats(94, seg1, seg2));
      await sleepOrPause(speed * 0.5);
      animatingRef.current = false;
      onLiveComplete();
    })();
  }, [phase, seg1, seg2, speed, sleepOrPause, pauseFor, onLiveComplete]);

  // ── Auto-scroll feed ──
  useEffect(() => {
    if (evsRef.current) evsRef.current.scrollTop = evsRef.current.scrollHeight;
  }, [liveEvents]);

  // ── ESPAÇO para pausar ──
  useEffect(() => {
    if (!isLive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLive, togglePause]);

  if (!visible) return null;

  // ── Substituição via painel lateral ──
  const getFilledSlots = () =>
    lineup.map((s, i) => ({ ...s, idx: i })).filter((s) => s.player && s.pos !== 'GK');

  const getAvailableSubs = () => {
    const usedNames = new Set(lineup.filter((s) => s.player).map((s) => s.player!.n));
    return bench.filter((p): p is SelectedPlayer => p !== null && !usedNames.has(p.n));
  };

  const handleSubTrigger = () => setSideMode('subOut');
  const handleSubOut = (idx: number) => { setPendingSubOutIdx(idx); setSideMode('subIn'); };
  const handleSubIn = (player: SelectedPlayer) => {
    if (pendingSubOutIdx === null) return;
    const outPlayer = lineup[pendingSubOutIdx]?.player;
    if (!outPlayer) return;

    const min = phase === 'halftime' ? 46 : liveMin;
    const isMyHome = homeId === MY_TEAM_ID;
    const subEv: MatchEvent = {
      min,
      type: 'sub',
      team: isMyHome ? 'home' : 'away',
      player: outPlayer.n,
      playerIn: player.n,
      tshort: outPlayer.ts,
      isMy: true,
    };

    onSubstitute(pendingSubOutIdx, player, outPlayer, min);
    setLiveEvents((prev) => [...prev, subEv].sort((a, b) => a.min - b.min));
    setPendingSubOutIdx(null);
    setSideMode('default');
  };
  const handleSubBack = () => {
    if (sideMode === 'subIn') setSideMode('subOut');
    else setSideMode('default');
  };

  // ── Helpers de display ──
  const getOutcome = () => {
    if (!result) return { label: '', color: '' };
    const isHome = homeId === MY_TEAM_ID;
    const myG = isHome ? result.hG : result.aG;
    const oppG = isHome ? result.aG : result.hG;
    if (myG > oppG) return { label: 'VITÓRIA', color: 'var(--green-light)' };
    if (myG < oppG) return { label: 'DERROTA', color: 'var(--red)' };
    return { label: 'EMPATE', color: 'var(--yellow)' };
  };
  const outcome = getOutcome();

  const timelineScore = (ev: MatchEvent) => {
    if (ev.type !== 'goal' || !result) return null;
    let h = 0; let a = 0;
    for (const e of result.evs) {
      if (e.type === 'goal') { if (e.team === 'home') h++; else a++; }
      if (e === ev) break;
    }
    return `${h} – ${a}`;
  };

  const scoreDisplay = () => {
    if (phase === 'pre') return '– — –';
    if (phase === 'post' && result) return `${result.hG} — ${result.aG}`;
    return `${liveScore.h} — ${liveScore.a}`;
  };
  const timeDisplay = () => {
    if (phase === 'pre') return 'EM BREVE';
    if (phase === 'halftime') return 'INT';
    if (phase === 'post') return 'FT';
    return `${fmtMin(liveMin)}'`;
  };

  const finalStats: LiveStatsSnapshot = result
    ? {
        hShots: result.hShots,
        aShots: result.aShots,
        hSot: result.hSot ?? 0,
        aSot: result.aSot ?? 0,
        hCorners: result.hCorners ?? 0,
        aCorners: result.aCorners ?? 0,
        hSaves: Math.max(0, (result.aSot ?? 0) - result.aG),
        aSaves: Math.max(0, (result.hSot ?? 0) - result.hG),
        hPoss: result.hPoss,
      }
    : EMPTY_STATS;

  const TACTICS = ['4-4-2', '4-3-3', '4-5-1', '3-5-2', '5-3-2'] as const;
  const STYLES = [
    { key: 'normal' as GameStyle,       label: '⚖️ Normal' },
    { key: 'contraAtaque' as GameStyle, label: '⚡ Contra-ataque' },
    { key: 'retranca' as GameStyle,     label: '🛡️ Retranca' },
    { key: 'tikaTaka' as GameStyle,     label: '🎯 Tiki-taka' },
  ];

  const subIsActive = sideMode === 'subOut' || sideMode === 'subIn';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`flex w-full overflow-hidden rounded-2xl border-2 border-[var(--border2)] bg-[var(--bg2)] shadow-2xl ${
          showStandings
            ? 'max-w-[920px] flex-col lg:flex-row'
            : showPitch
            ? 'max-w-[900px] flex-col sm:flex-row'
            : showSidePanel
            ? 'max-w-[860px] flex-col sm:flex-row'
            : 'max-w-[520px] flex-col'
        }`}
      >
        {/* ══════════════ COLUNA PRINCIPAL ══════════════ */}
        <div
          className={`relative min-w-0 ${
            showStandings
              ? 'flex-1'
              : showPitch
              ? 'sm:w-[520px] sm:flex-shrink-0'
              : showSidePanel
              ? 'sm:w-[370px] sm:flex-shrink-0'
              : 'w-full'
          }`}
        >
          {/* ── HEADER ── */}
          <div
            className="flex items-center justify-between px-4 py-3 sm:px-5"
            style={{ background: 'linear-gradient(135deg, var(--green-dark), var(--bg2))' }}
          >
            <span className="text-sm font-medium uppercase tracking-wide text-[var(--text2)]">
              Rodada {round}{phase === 'pre' && ' · Próxima partida'}
            </span>
            <div className="flex items-center gap-2">
              {isLive && (
                <>
                  {isPaused
                    ? <span className="text-sm font-bold text-[var(--yellow)]">⏸ PAUSADO</span>
                    : <span className="live-pulse text-sm font-bold text-[var(--yellow)]">● AO VIVO</span>
                  }
                  <button
                    type="button"
                    onClick={togglePause}
                    title="Pausar/Retomar (Espaço)"
                    className="rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-2.5 py-1 text-xs font-bold text-[var(--text2)] transition-all hover:text-[var(--text)]"
                  >
                    {isPaused ? '▶ Retomar' : '⏸ Pausar'}
                  </button>
                </>
              )}
              {phase === 'halftime' && (
                <span className="text-sm font-bold text-[var(--text2)]">INTERVALO</span>
              )}
              {phase === 'post' && (
                <span className="text-sm font-bold text-[var(--text)]">FIM DE JOGO</span>
              )}
              {phase === 'pre' && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text2)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
                >
                  ← Voltar
                </button>
              )}
              {canClose && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border2)] bg-[var(--bg3)] text-lg text-[var(--text2)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
                  aria-label="Fechar overlay"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* ── PLACAR ── */}
          <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex flex-1 flex-col items-center gap-1.5 sm:gap-2">
                {homeId === MY_TEAM_ID
                  ? <ShieldSvg config={shieldConfig} short={home.short} size={46} />
                  : <>
                      <TeamLogo logo={home.logo} fallback={home.c} size={40} className="sm:hidden" />
                      <TeamLogo logo={home.logo} fallback={home.c} size={56} className="hidden sm:block" />
                    </>}
                <div className={`font-condensed text-xs font-extrabold uppercase leading-tight text-center sm:text-base ${homeId === MY_TEAM_ID ? 'text-[var(--green-light)]' : 'text-[var(--text)]'}`}>
                  <span className="sm:hidden">{home.short}</span>
                  <span className="hidden sm:inline">{home.name}</span>
                </div>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2">
                <div className="font-condensed text-4xl font-black tracking-wider text-white sm:text-5xl">
                  {scoreDisplay()}
                </div>
                <div className="font-condensed text-sm font-bold text-[var(--green-light)]">
                  {timeDisplay()}
                </div>
              </div>
              <div className="flex flex-1 flex-col items-center gap-1.5 sm:gap-2">
                {awayId === MY_TEAM_ID
                  ? <ShieldSvg config={shieldConfig} short={away.short} size={46} />
                  : <>
                      <TeamLogo logo={away.logo} fallback={away.c} size={40} className="sm:hidden" />
                      <TeamLogo logo={away.logo} fallback={away.c} size={56} className="hidden sm:block" />
                    </>}
                <div className={`font-condensed text-xs font-extrabold uppercase leading-tight text-center sm:text-base ${awayId === MY_TEAM_ID ? 'text-[var(--green-light)]' : 'text-[var(--text)]'}`}>
                  <span className="sm:hidden">{away.short}</span>
                  <span className="hidden sm:inline">{away.name}</span>
                </div>
              </div>
            </div>
            {home.stadium && (
              <div className="mt-3 flex justify-center">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-[var(--text2)]">
                  📍 {home.stadium}
                </div>
              </div>
            )}
          </div>

          {/* ── PRE ── */}
          {phase === 'pre' && (
            <div className="px-4 py-5 text-center sm:px-5 sm:py-6">
              <div className="mb-5 text-base text-[var(--text2)]">
                Força do Meu Time — Ataque:{' '}
                <strong className="text-[var(--text)]">{Math.round(myStrength.att)}</strong> · Defesa:{' '}
                <strong className="text-[var(--text)]">{Math.round(myStrength.def)}</strong>
              </div>
              <button type="button" onClick={onPlay} className="btn-primary w-full py-3.5">
                ▶ Jogar Partida
              </button>
            </div>
          )}

          {/* ── LIVE ── */}
          {isLive && (
            <>
              {showPitch && (
                <MatchPitch
                  homeName={home.name}
                  awayName={away.name}
                  hPoss={liveStats.hPoss}
                  paused={isPaused}
                  lastEvent={lastPitchEvent}
                  onTogglePause={togglePause}
                />
              )}
              {/* Feed embutido só sem o campinho — com ele, a timeline vira card lateral */}
              {!showPitch && (
                <div
                  ref={evsRef}
                  className="flex h-[160px] flex-col gap-1 overflow-y-auto bg-[var(--bg)] px-4 py-3 sm:h-[200px] sm:px-5"
                >
                  {liveEvents.filter((e) => e.type !== 'corner').map((ev, i) => (
                    <LiveEventRow key={i} ev={ev} homeId={homeId} awayId={awayId} />
                  ))}
                </div>
              )}

              {/* Stats em tempo real — estilo broadcast */}
              <StatsPanel
                stats={liveStats}
                homeShort={home.short}
                awayShort={away.short}
                className="border-t border-[var(--border)] px-4 py-2.5 sm:px-5"
              />

              {/* Barra de progresso */}
              <div className="border-t border-[var(--border)] px-5 py-3">
                <div className="mb-1.5 flex justify-between text-xs text-[var(--text3)]">
                  <span>{fmtMin(liveMin)}&apos;</span>
                  <span className="font-bold text-[var(--text2)]">
                    {liveMin <= 45 ? '1º Tempo' : '2º Tempo'}
                  </span>
                  <span>94&apos;</span>
                </div>
                <div className="relative h-2 rounded-full bg-[var(--bg3)]">
                  <div
                    className={`h-2 rounded-full transition-[width] duration-500 ${
                      isPaused ? 'bg-[var(--yellow)] opacity-70' : 'bg-[var(--green-light)]'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                  <div className="absolute top-0 h-2 w-px bg-white/30" style={{ left: '48%' }} />
                </div>
              </div>

              {/* Indicador de pausa (sem overlay, a aba lateral abre automaticamente) */}
              {isPaused && (
                <div className="flex items-center justify-center gap-2 border-t border-[var(--yellow)]/30 bg-[var(--yellow)]/5 px-4 py-2 text-xs font-bold text-[var(--yellow)]">
                  ⏸ Jogo pausado — ajuste sua equipe na aba ao lado
                </div>
              )}
            </>
          )}

          {/* ── INTERVALO (coluna esquerda — controles) ── */}
          {phase === 'halftime' && (
            <div className="flex flex-col gap-3 px-4 py-5 sm:px-5">
              <div className="text-center">
                <div className="font-condensed text-xl font-black uppercase text-[var(--text2)]">
                  ⏱ Intervalo
                </div>
                <div className="mt-1 text-sm text-[var(--text3)]">
                  Ajuste sua equipe para o 2º tempo
                </div>
              </div>

              {/* Botão substituição → abre painel lateral */}
              <button
                type="button"
                onClick={handleSubTrigger}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm font-bold transition-all ${
                  subIsActive
                    ? 'border-[var(--green-light)] bg-[var(--green-dark)] text-[var(--green-light)]'
                    : 'border-[var(--border2)] bg-[var(--bg3)] text-[var(--text2)] hover:border-[var(--border)] hover:text-[var(--text)]'
                }`}
              >
                <span>🔄 Fazer substituição</span>
                <span className="text-xs opacity-70">
                  {subIsActive ? '✓ ativo' : '→ ver elenco'}
                </span>
              </button>

              <TacticPanel
                label="Formação para o 2º tempo"
                tactics={TACTICS}
                currentTactic={currentTactic}
                onChangeTactic={onChangeTactic}
              />
              <StylePanel styles={STYLES} currentStyle={currentStyle} onChangeStyle={onChangeStyle} />

              <button
                type="button"
                onClick={onSecondHalfStart}
                className="btn-primary w-full py-3.5 text-base"
              >
                ▶ Iniciar 2º Tempo
              </button>
            </div>
          )}

          {/* ── POST ── */}
          {phase === 'post' && result && (
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <div
                className="mb-4 text-center font-condensed text-3xl font-black uppercase"
                style={{ color: outcome.color }}
              >
                {outcome.label}
              </div>

              <div className="mb-4 max-h-[180px] overflow-y-auto rounded-lg bg-[var(--bg)] p-3">
                {result.evs.filter((e) => e.type !== 'corner').map((ev, i) => {
                  const d = describeEvent(ev);
                  return (
                    <div key={i} className="mb-1.5 flex items-center gap-2.5 text-sm text-[var(--text2)]">
                      <span className="min-w-[38px] rounded-md bg-[var(--bg3)] px-1.5 py-0.5 text-center text-xs font-bold text-[var(--text)]">
                        {fmtMin(ev.min)}&apos;
                      </span>
                      {(ev.type === 'goal' || ev.type === 'yellow' || ev.type === 'red') && (
                        <PlayerAvatar name={ev.player} />
                      )}
                      <span className="text-base leading-none">{d.icon}</span>
                      <span className="flex-1 text-[var(--text)]">{d.txt}</span>
                      {ev.type === 'goal' && (
                        <span className="font-bold text-[var(--text)]">{timelineScore(ev)}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <StatsPanel
                stats={finalStats}
                homeShort={home.short}
                awayShort={away.short}
                className="mb-5 rounded-lg bg-[var(--bg3)] px-3 py-2.5"
              />

              {roundMatches.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text3)]">
                    Outros resultados da rodada
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {roundMatches.map((m, i) => {
                      const mHome = getTeamDisplay(m.home);
                      const mAway = getTeamDisplay(m.away);
                      return (
                        <div key={i} className="flex items-center gap-1.5 rounded-lg bg-[var(--bg3)] px-2.5 py-1.5 text-xs">
                          <TeamLogo logo={mHome.logo} fallback={mHome.c} size={14} />
                          <span className="text-[var(--text2)]">{mHome.short}</span>
                          <span className="flex-1 text-center font-bold text-[var(--text)]">{m.hG}–{m.aG}</span>
                          <span className="text-[var(--text2)]">{mAway.short}</span>
                          <TeamLogo logo={mAway.logo} fallback={mAway.c} size={14} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={onContinue} className="btn-primary w-full py-3.5">
                  Continuar campeonato →
                </button>
                <button type="button" onClick={onEditLineup} className="btn-secondary w-full py-3">
                  ✏️ Alterar Escalação
                </button>
                <button type="button" onClick={onReset} className="btn-secondary w-full py-3 opacity-60">
                  ✕ Fechar e reiniciar jogo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════ TIMELINE LATERAL (campinho ativo) ══════════════ */}
        {showPitch && !showSidePanel && (
          <div className="flex flex-1 flex-col border-t border-[var(--border)] sm:border-l sm:border-t-0">
            <div
              className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5"
              style={{ background: 'linear-gradient(135deg, var(--green-dark), var(--bg2))' }}
            >
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text2)]">
                📅 Timeline da partida
              </span>
            </div>
            <div
              ref={evsRef}
              className="flex max-h-[240px] min-h-0 flex-1 flex-col gap-1 overflow-y-auto bg-[var(--bg)] p-3 sm:max-h-none"
            >
              {liveEvents.length === 0 ? (
                <div className="py-4 text-center text-xs text-[var(--text3)]">
                  Nenhum evento ainda
                </div>
              ) : (
                liveEvents.filter((e) => e.type !== 'corner').map((ev, i) => (
                  <LiveEventRow key={i} ev={ev} homeId={homeId} awayId={awayId} />
                ))
              )}
            </div>
          </div>
        )}

        {/* ══════════════ PAINEL LATERAL (intervalo / pausa) ══════════════ */}
        {showSidePanel && (
          <div className="flex flex-1 flex-col border-t border-[var(--border)] sm:border-l sm:border-t-0">
            {/* Header do painel lateral */}
            <div
              className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5"
              style={{ background: 'linear-gradient(135deg, var(--green-dark), var(--bg2))' }}
            >
              {sideMode !== 'default' ? (
                <>
                  <button
                    type="button"
                    onClick={handleSubBack}
                    className="flex items-center gap-1 text-xs text-[var(--text2)] hover:text-[var(--text)]"
                  >
                    ← Voltar
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text)]">
                    {sideMode === 'subOut' ? '🔄 Quem sai?' : '🔄 Quem entra?'}
                  </span>
                </>
              ) : (
                <>
                  {/* Tabs: Timeline / Controles */}
                  {phase === 'halftime' ? (
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--text2)]">
                      📅 Timeline do 1º Tempo
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--yellow)]">
                      ⏸ Controles de Pausa
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Conteúdo do painel lateral */}
            <div className="flex flex-1 flex-col overflow-hidden">

              {/* ── SUBSTITUIÇÃO — quem sai ── */}
              {sideMode === 'subOut' && (
                <div className="flex flex-col gap-1 overflow-y-auto p-3">
                  <p className="mb-1 text-xs text-[var(--text3)]">
                    Selecione o jogador que vai sair:
                  </p>
                  {getFilledSlots().length === 0 ? (
                    <p className="text-xs text-[var(--text3)]">Nenhum jogador de campo disponível.</p>
                  ) : (
                    getFilledSlots().map((s) => (
                      <button
                        key={s.idx}
                        type="button"
                        onClick={() => handleSubOut(s.idx)}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] transition-all hover:border-[var(--green-light)] hover:bg-[var(--green-dark)]"
                      >
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold pos-${s.pos}`}>
                          {s.pos}
                        </span>
                        <span className="flex-1 text-left">{s.player!.n}</span>
                        <span className="text-xs text-[var(--text3)]">{s.player!.ts}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* ── SUBSTITUIÇÃO — quem entra ── */}
              {sideMode === 'subIn' && pendingSubOutIdx !== null && (
                <div className="flex flex-col gap-1 overflow-y-auto p-3">
                  <p className="mb-1 text-xs text-[var(--text3)]">
                    Sai: <strong className="text-[var(--text)]">
                      {lineup[pendingSubOutIdx]?.player?.n}
                    </strong>
                    {' '}· Escolha quem entra:
                  </p>
                  {getAvailableSubs().length === 0 ? (
                    <p className="text-xs text-[var(--text3)]">
                      Nenhum reserva disponível no banco.
                    </p>
                  ) : (
                    getAvailableSubs().map((p) => (
                      <button
                        key={p.n}
                        type="button"
                        onClick={() => handleSubIn(p)}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] transition-all hover:border-[var(--green-light)] hover:bg-[var(--green-dark)]"
                      >
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold pos-${p.p}`}>
                          {p.p}
                        </span>
                        <span className="flex-1 text-left">{p.n}</span>
                        <span className="text-xs text-[var(--text3)]">{p.ts}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* ── DEFAULT: Timeline (halftime) ── */}
              {sideMode === 'default' && phase === 'halftime' && (
                <>
                  {/* Stats do 1º tempo */}
                  <StatsPanel
                    stats={liveStats}
                    homeShort={home.short}
                    awayShort={away.short}
                    className="border-b border-[var(--border)] p-3"
                  />

                  {/* Eventos do 1º tempo */}
                  <div className="flex flex-1 flex-col gap-1 overflow-y-auto bg-[var(--bg)] p-3">
                    {liveEvents.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[var(--text3)]">
                        Nenhum evento no 1º tempo
                      </div>
                    ) : (
                      liveEvents.filter((e) => e.type !== 'corner').map((ev, i) => (
                        <LiveEventRow key={i} ev={ev} homeId={homeId} awayId={awayId} />
                      ))
                    )}
                  </div>
                </>
              )}

              {/* ── DEFAULT: Controles de pausa (live) ── */}
              {sideMode === 'default' && isLive && isPaused && (
                <div className="flex flex-col gap-3 overflow-y-auto p-3">
                  <div className="text-center">
                    <div className="font-condensed text-lg font-black uppercase text-[var(--yellow)]">
                      ⏸ Jogo Pausado
                    </div>
                    <div className="text-xs text-[var(--text3)]">
                      {liveMin}&apos; · {liveScore.h} — {liveScore.a}
                    </div>
                  </div>

                  {/* Sub trigger */}
                  <button
                    type="button"
                    onClick={handleSubTrigger}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--border2)] bg-[var(--bg3)] px-3 py-3 text-sm font-bold text-[var(--text2)] transition-all hover:border-[var(--border)] hover:text-[var(--text)]"
                  >
                    <span>🔄 Fazer substituição</span>
                    <span className="text-xs opacity-60">→ ver elenco</span>
                  </button>

                  <TacticPanel
                    label="Formação"
                    tactics={TACTICS}
                    currentTactic={currentTactic}
                    onChangeTactic={onChangeTactic}
                  />
                  <StylePanel styles={STYLES} currentStyle={currentStyle} onChangeStyle={onChangeStyle} />

                  <button type="button" onClick={resumeMatch} className="btn-primary w-full py-3 text-base">
                    ▶ Retomar partida
                  </button>
                  <div className="text-center text-xs text-[var(--text3)]">ou pressione Espaço</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ TABELA LATERAL (post) ══════════════ */}
        {showStandings && (
          <div className="max-h-[50vh] w-full border-t border-[var(--border)] sm:max-h-[70vh] lg:max-h-none lg:w-[340px] lg:border-l lg:border-t-0">
            <OverlayStandings standings={standings} shieldConfig={shieldConfig} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatSubText(ev: MatchEvent): string {
  const out = shn(ev.player);
  if (ev.playerIn) {
    return `Substituição — ${out} sai · ${shn(ev.playerIn)} entra (${ev.tshort})`;
  }
  return `Substituição — ${out} sai (${ev.tshort})`;
}

// Narração única do evento — usada no feed ao vivo e na timeline pós-jogo
function describeEvent(ev: MatchEvent): { icon: string; txt: string } {
  switch (ev.type) {
    case 'goal': {
      const name = shn(ev.player);
      const base =
        ev.goalKind === 'pen' ? `Gol de pênalti — ${name}`
        : ev.goalKind === 'counter' ? `Gol em contra-ataque — ${name}`
        : ev.goalKind === 'header' ? `Gol de cabeça — ${name}`
        : ev.goalKind === 'longshot' ? `Golaço de fora da área — ${name}`
        : ev.goalKind === 'freekick' ? `Gol de falta — ${name}`
        : name;
      const assist = ev.assist ? ` · assist. ${shn(ev.assist)}` : '';
      return { icon: '⚽', txt: `${base} (${ev.tshort})${assist}` };
    }
    case 'yellow':
      return { icon: '🟨', txt: `${shn(ev.player)} (${ev.tshort})` };
    case 'red':
      return {
        icon: '🟥',
        txt: `${ev.secondYellow ? 'Expulso (2º amarelo)' : 'Expulso'} — ${shn(ev.player)} (${ev.tshort})`,
      };
    case 'save':
      return {
        icon: '🧤',
        txt: ev.pen
          ? `Pênalti defendido por ${shn(ev.player)}! (${ev.tshort})`
          : `Defesa de ${shn(ev.player)} (${ev.tshort})`,
      };
    case 'post':
      return { icon: '🥅', txt: `Na trave! ${shn(ev.player)} (${ev.tshort})` };
    case 'miss':
      return {
        icon: ev.pen ? '❌' : '💨',
        txt: ev.pen
          ? `Pênalti desperdiçado — ${shn(ev.player)} (${ev.tshort})`
          : `Perdeu chance incrível! ${shn(ev.player)} (${ev.tshort})`,
      };
    case 'var':
      return { icon: '📺', txt: `VAR anula gol de ${shn(ev.player)} (${ev.tshort})` };
    case 'corner':
      return { icon: '🚩', txt: `Escanteio (${ev.tshort})` };
    case 'sub':
      return { icon: '🔄', txt: formatSubText(ev) };
  }
}

// ─── Painel de estatísticas estilo broadcast ─────────────────────────────────

function StatRow({ h, a, label }: { h: number; a: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-sm">
      <span className={`min-w-[26px] font-condensed text-base font-bold ${h >= a ? 'text-[var(--text)]' : 'text-[var(--text3)]'}`}>
        {h}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-[var(--text3)]">{label}</span>
      <span className={`min-w-[26px] text-right font-condensed text-base font-bold ${a >= h ? 'text-[var(--text)]' : 'text-[var(--text3)]'}`}>
        {a}
      </span>
    </div>
  );
}

function StatsPanel({
  stats,
  homeShort,
  awayShort,
  className,
}: {
  stats: LiveStatsSnapshot;
  homeShort: string;
  awayShort: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]">
        <span>{homeShort} {stats.hPoss}%</span>
        <span className="text-[var(--text3)]">Posse de bola</span>
        <span>{100 - stats.hPoss}% {awayShort}</span>
      </div>
      <div className="mb-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="rounded-l-full bg-[var(--green-light)] transition-all duration-700"
          style={{ width: `${stats.hPoss}%` }}
        />
        <div
          className="flex-1 rounded-r-full bg-[var(--red)]/60 transition-all duration-700"
        />
      </div>
      <div className="grid grid-cols-2 gap-x-6">
        <StatRow h={stats.hShots} a={stats.aShots} label="Finalizações" />
        <StatRow h={stats.hSot} a={stats.aSot} label="No gol" />
        <StatRow h={stats.hCorners} a={stats.aCorners} label="Escanteios" />
        <StatRow h={stats.hSaves} a={stats.aSaves} label="Defesas" />
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TacticPanel({
  label, tactics, currentTactic, onChangeTactic,
}: { label: string; tactics: readonly string[]; currentTactic: string; onChangeTactic: (t: string) => void }) {
  return (
    <div className="rounded-xl border border-[var(--border2)] bg-[var(--bg3)] p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text3)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {tactics.map((t) => (
          <button key={t} type="button" onClick={() => onChangeTactic(t)}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-all ${
              currentTactic === t
                ? 'border-[var(--green-light)] bg-[var(--green-dark)] text-[var(--green-light)]'
                : 'border-[var(--border2)] text-[var(--text2)] hover:text-[var(--text)]'
            }`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function StylePanel({
  styles, currentStyle, onChangeStyle,
}: { styles: { key: GameStyle; label: string }[]; currentStyle: GameStyle; onChangeStyle: (s: GameStyle) => void }) {
  return (
    <div className="rounded-xl border border-[var(--border2)] bg-[var(--bg3)] p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text3)]">Estilo de jogo</div>
      <div className="flex flex-wrap gap-2">
        {styles.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => onChangeStyle(key)}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-all ${
              currentStyle === key
                ? 'border-[var(--green-light)] bg-[var(--green-dark)] text-[var(--green-light)]'
                : 'border-[var(--border2)] text-[var(--text2)] hover:text-[var(--text)]'
            }`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerAvatar({ name }: { name: string }) {
  const photo = PLAYER_PHOTO_MAP[name] ?? getPlayerPhoto(name);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[9px] font-bold text-white">
      <span>{initials}</span>
      {photo && (
        <img src={photo} alt={name}
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

const EVENT_BG: Record<MatchEvent['type'], string> = {
  goal: '',  // depende de quem marcou
  yellow: ' bg-[rgba(255,202,40,0.15)]',
  red: ' bg-[rgba(255,82,82,0.18)]',
  save: ' bg-[rgba(255,255,255,0.06)]',
  post: ' bg-[rgba(255,165,0,0.10)]',
  miss: ' bg-[rgba(255,140,60,0.10)]',
  var: ' bg-[rgba(186,104,200,0.14)]',
  corner: ' bg-[rgba(255,255,255,0.04)]',
  sub: ' bg-[rgba(100,160,255,0.10)]',
};

function LiveEventRow({ ev, homeId, awayId }: { ev: MatchEvent; homeId: number; awayId: number }) {
  const isMy = (ev.team === 'home' && homeId === MY_TEAM_ID) || (ev.team === 'away' && awayId === MY_TEAM_ID);

  let cls = 'ev-slide flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm';
  cls += ev.type === 'goal'
    ? isMy ? ' bg-[rgba(31,196,94,0.2)]' : ' bg-[rgba(255,82,82,0.15)]'
    : EVENT_BG[ev.type];

  const { icon, txt } = describeEvent(ev);
  const showAvatar = ev.type === 'goal' || ev.type === 'yellow' || ev.type === 'red';
  return (
    <div className={cls}>
      <span className="min-w-[36px] text-sm font-bold text-[var(--text2)]">{fmtMin(ev.min)}&apos;</span>
      {showAvatar && <PlayerAvatar name={ev.player} />}
      <span className="min-w-5 text-base leading-none">{icon}</span>
      <span className="text-[var(--text)]">{txt}</span>
    </div>
  );
}
