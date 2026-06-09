'use client';

import { useEffect, useRef, useState } from 'react';
import { MY_TEAM_ID } from '@/data/teams';
import { LIVE_MINUTES, getMyTeamData, getTeamDisplay } from '@/lib/simulator';
import { shn, sleep } from '@/lib/helpers';
import type { LineupSlot, LivePhase, MatchEvent, MatchResult, Standing, StoredMatch } from '@/lib/types';
import OverlayStandings from './OverlayStandings';
import TeamLogo from './TeamLogo';

interface LiveOverlayProps {
  visible: boolean;
  phase: LivePhase;
  round: number;
  homeId: number;
  awayId: number;
  result: MatchResult | null;
  speed: number;
  lineup: LineupSlot[];
  onPlay: () => void;
  onLiveComplete: () => void;
  onContinue: () => void;
  onReset: () => void;
  onEditLineup: () => void;
  onDismiss: () => void;
  standings: Standing[];
  roundMatches: StoredMatch[];
}

export default function LiveOverlay({
  visible,
  phase,
  round,
  homeId,
  awayId,
  result,
  speed,
  lineup,
  onPlay,
  onLiveComplete,
  onContinue,
  onReset,
  onEditLineup,
  onDismiss,
  standings,
  roundMatches,
}: LiveOverlayProps) {
  const [liveMin, setLiveMin] = useState(0);
  const [liveScore, setLiveScore] = useState({ h: 0, a: 0 });
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const evsRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);

  const home = getTeamDisplay(homeId);
  const away = getTeamDisplay(awayId);
  const myStrength = getMyTeamData(lineup);
  const canClose = phase === 'post';

  useEffect(() => {
    if (phase === 'pre') {
      setLiveMin(0);
      setLiveScore({ h: 0, a: 0 });
      setLiveEvents([]);
      setProgress(0);
      animatingRef.current = false;
    }
  }, [phase, homeId, awayId]);

  useEffect(() => {
    if (phase !== 'live' || !result || animatingRef.current) return;

    animatingRef.current = true;
    let hs = 0;
    let as = 0;
    const queue = [...result.evs];

    (async () => {
      for (const min of LIVE_MINUTES) {
        setLiveMin(min);
        setProgress(Math.min(100, (min / 94) * 100));

        while (queue.length && queue[0].min <= min) {
          const ev = queue.shift()!;
          if (ev.type === 'goal') {
            if (ev.team === 'home') hs++;
            else as++;
            setLiveScore({ h: hs, a: as });
          }
          setLiveEvents((prev) => [...prev, ev]);
          await sleep(speed * 0.35);
        }
        await sleep(speed * 0.6);
      }

      while (queue.length) {
        const ev = queue.shift()!;
        if (ev.type === 'goal') {
          if (ev.team === 'home') hs++;
          else as++;
          setLiveScore({ h: hs, a: as });
        }
        setLiveEvents((prev) => [...prev, ev]);
        await sleep(speed * 0.2);
      }

      setLiveMin(94);
      setProgress(100);
      await sleep(speed * 0.5);
      onLiveComplete();
    })();
  }, [phase, result, speed, onLiveComplete]);

  useEffect(() => {
    if (evsRef.current) {
      evsRef.current.scrollTop = evsRef.current.scrollHeight;
    }
  }, [liveEvents]);

  if (!visible) return null;

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

  const timelineScore = (ev: MatchEvent, idx: number) => {
    if (ev.type !== 'goal' || !result) return null;
    let h = 0;
    let a = 0;
    for (let i = 0; i <= idx; i++) {
      const e = result.evs[i];
      if (e.type === 'goal') {
        if (e.team === 'home') h++;
        else a++;
      }
    }
    return `${h} – ${a}`;
  };

  const showStandings = phase === 'post' && standings.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        className={`flex w-full overflow-hidden rounded-2xl border-2 border-[var(--border2)] bg-[var(--bg2)] shadow-2xl ${
          showStandings ? 'max-w-[920px] flex-col lg:flex-row' : 'max-w-[520px] flex-col'
        }`}
      >
        <div className={`min-w-0 ${showStandings ? 'flex-1' : 'w-full'}`}>
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: 'linear-gradient(135deg, var(--green-dark), var(--bg2))' }}
        >
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--text2)]">
            Rodada {round}
            {phase === 'pre' && ' · Próxima partida'}
          </span>
          <div className="flex items-center gap-3">
            {phase === 'live' && (
              <span className="live-pulse text-sm font-bold text-[var(--yellow)]">● AO VIVO</span>
            )}
            {phase === 'post' && (
              <span className="text-sm font-bold text-[var(--text)]">FIM DE JOGO</span>
            )}
            {phase === 'pre' && (
              <button
                type="button"
                onClick={onDismiss}
                title="Minimizar e voltar à simulação"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text2)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
              >
                ← Voltar
              </button>
            )}
            {canClose && (
              <button
                type="button"
                onClick={onDismiss}
                title="Minimizar resultado"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border2)] bg-[var(--bg3)] text-lg text-[var(--text2)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
                aria-label="Fechar overlay"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="border-b border-[var(--border)] bg-[var(--card)] px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 flex-col items-center gap-2">
              <TeamLogo logo={home.logo} fallback={home.c} size={56} />
              <div
                className={`font-condensed text-base font-extrabold uppercase leading-tight text-center ${
                  homeId === MY_TEAM_ID ? 'text-[var(--green-light)]' : 'text-[var(--text)]'
                }`}
              >
                {home.name}
              </div>
            </div>

            <div className="flex flex-col items-center px-2">
              <div className="font-condensed text-5xl font-black tracking-wider text-white">
                {phase === 'pre'
                  ? '– — –'
                  : phase === 'live'
                    ? `${liveScore.h} — ${liveScore.a}`
                    : `${result?.hG ?? 0} — ${result?.aG ?? 0}`}
              </div>
              <div className="font-condensed text-sm font-bold text-[var(--green-light)]">
                {phase === 'pre' ? 'EM BREVE' : phase === 'live' ? `${liveMin}'` : 'FT'}
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center gap-2">
              <TeamLogo logo={away.logo} fallback={away.c} size={56} />
              <div
                className={`font-condensed text-base font-extrabold uppercase leading-tight text-center ${
                  awayId === MY_TEAM_ID ? 'text-[var(--green-light)]' : 'text-[var(--text)]'
                }`}
              >
                {away.name}
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

        {phase === 'pre' && (
          <div className="px-5 py-6 text-center">
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

        {phase === 'live' && (
          <>
            <div
              ref={evsRef}
              className="flex h-[220px] flex-col gap-1 overflow-y-auto bg-[var(--bg)] px-5 py-3"
            >
              {liveEvents.map((ev, i) => (
                <LiveEventRow key={i} ev={ev} homeId={homeId} awayId={awayId} />
              ))}
            </div>
            <div className="border-t border-[var(--border)] px-5 py-3">
              <div className="h-1.5 rounded-full bg-[var(--bg3)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--green-light)] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'post' && result && (
          <div className="px-5 py-5">
            <div
              className="mb-4 text-center font-condensed text-3xl font-black uppercase"
              style={{ color: outcome.color }}
            >
              {outcome.label}
            </div>

            <div className="mb-4 max-h-[180px] overflow-y-auto rounded-lg bg-[var(--bg)] p-3">
              {result.evs.map((ev, i) => (
                <div
                  key={i}
                  className="mb-1.5 flex items-center gap-2.5 text-sm text-[var(--text2)]"
                >
                  <span className="min-w-[32px] rounded-md bg-[var(--bg3)] px-1.5 py-0.5 text-center text-xs font-bold text-[var(--text)]">
                    {ev.min}&apos;
                  </span>
                  <span className="text-base">
                    {ev.type === 'goal' ? '⚽' : ev.type === 'yellow' ? '🟨' : '🟥'}
                  </span>
                  <span className="flex-1 text-[var(--text)]">
                    {shn(ev.player)} ({ev.tshort})
                  </span>
                  {ev.type === 'goal' && (
                    <span className="font-bold text-[var(--text)]">{timelineScore(ev, i)}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2.5 text-center text-xs text-[var(--text2)]">
              <div className="rounded-lg bg-[var(--bg3)] p-3">
                <div className="text-lg font-bold text-[var(--text)]">{result.hShots}</div>
                Chutes a gol
              </div>
              <div className="rounded-lg bg-[var(--bg3)] p-3">
                <div className="text-lg font-bold text-[var(--text)]">{result.hPoss}%</div>
                Posse de bola
              </div>
              <div className="rounded-lg bg-[var(--bg3)] p-3">
                <div className="text-lg font-bold text-[var(--text)]">{result.aShots}</div>
                Chutes adversário
              </div>
            </div>

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
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--bg3)] px-2.5 py-1.5 text-xs"
                      >
                        <TeamLogo logo={mHome.logo} fallback={mHome.c} size={14} />
                        <span className="text-[var(--text2)]">{mHome.short}</span>
                        <span className="flex-1 text-center font-bold text-[var(--text)]">
                          {m.hG}–{m.aG}
                        </span>
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

        {showStandings && (
          <div className="max-h-[70vh] w-full border-t border-[var(--border)] lg:max-h-none lg:w-[340px] lg:border-l lg:border-t-0">
            <OverlayStandings standings={standings} />
          </div>
        )}
      </div>
    </div>
  );
}

function LiveEventRow({
  ev,
  homeId,
  awayId,
}: {
  ev: MatchEvent;
  homeId: number;
  awayId: number;
}) {
  const isMy =
    (ev.team === 'home' && homeId === MY_TEAM_ID) ||
    (ev.team === 'away' && awayId === MY_TEAM_ID);

  let cls = 'ev-slide flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm';
  let icon = '';
  let txt = '';

  if (ev.type === 'goal') {
    cls += isMy ? ' bg-[rgba(31,196,94,0.2)]' : ' bg-[rgba(255,82,82,0.15)]';
    icon = '⚽';
    txt = `${shn(ev.player)} (${ev.tshort})`;
  } else if (ev.type === 'yellow') {
    cls += ' bg-[rgba(255,202,40,0.15)]';
    icon = '🟨';
    txt = `${shn(ev.player)} (${ev.tshort})`;
  } else {
    cls += ' bg-[rgba(255,82,82,0.18)]';
    icon = '🟥';
    txt = `Expulso — ${shn(ev.player)} (${ev.tshort})`;
  }

  return (
    <div className={cls}>
      <span className="min-w-[30px] text-sm font-bold text-[var(--text2)]">{ev.min}&apos;</span>
      <span className="min-w-5 text-base">{icon}</span>
      <span className="text-[var(--text)]">{txt}</span>
    </div>
  );
}
