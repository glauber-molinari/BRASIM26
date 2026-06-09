'use client';

import { MY_TEAM_ID } from '@/data/teams';
import { getTeamDisplay } from '@/lib/simulator';
import type { StoredMatch } from '@/lib/types';
import TeamLogo from './TeamLogo';

interface SchedulePanelProps {
  schedule: [number, number][][];
  allMatches: StoredMatch[];
}

const RESULT_COLOR = { W: 'var(--green-light)', D: 'var(--yellow)', L: 'var(--red)' } as const;
const RESULT_BG = {
  W: 'rgba(20,163,82,0.15)',
  D: 'rgba(255,193,7,0.12)',
  L: 'rgba(255,82,82,0.12)',
} as const;
const RESULT_LABEL = { W: 'V', D: 'E', L: 'D' } as const;

export default function SchedulePanel({ schedule, allMatches }: SchedulePanelProps) {
  if (!schedule.length) return null;

  type MatchEntry = {
    round: number;
    homeId: number;
    awayId: number;
    isHome: boolean;
    hG: number | null;
    aG: number | null;
    result: 'W' | 'D' | 'L' | null;
  };

  const mySchedule: MatchEntry[] = schedule
    .map((round, r) => {
      const pair = round.find(([h, a]) => h === MY_TEAM_ID || a === MY_TEAM_ID);
      if (!pair) return null;
      const [homeId, awayId] = pair;
      const stored = allMatches.find(
        (m) => m.round === r && m.home === homeId && m.away === awayId
      );
      const isHome = homeId === MY_TEAM_ID;
      let result: 'W' | 'D' | 'L' | null = null;
      if (stored) {
        const myG = isHome ? stored.hG : stored.aG;
        const oppG = isHome ? stored.aG : stored.hG;
        result = myG > oppG ? 'W' : myG < oppG ? 'L' : 'D';
      }
      return {
        round: r + 1,
        homeId,
        awayId,
        isHome,
        hG: stored?.hG ?? null,
        aG: stored?.aG ?? null,
        result,
      };
    })
    .filter(Boolean) as MatchEntry[];

  const nextMatchRound = mySchedule.find((m) => !m.result)?.round ?? null;

  return (
    <div className="panel">
      <div className="panel-title mb-2">Calendário — Meu Time</div>
      <div className="max-h-[420px] overflow-y-auto space-y-0.5 pr-0.5">
        {mySchedule.map((m, i) => {
          const oppId = m.isHome ? m.awayId : m.homeId;
          const opp = getTeamDisplay(oppId);
          const isNext = m.round === nextMatchRound;
          const isPast = m.result !== null;

          const showSep = i === 19;

          return (
            <div key={m.round}>
              {showSep && (
                <div className="my-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)]">
                    2º Turno
                  </span>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
              )}
              <div
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                  isNext
                    ? 'border border-[var(--green-light)]/50 bg-[rgba(31,196,94,0.08)]'
                    : isPast
                      ? ''
                      : 'opacity-60'
                }`}
                style={isPast && m.result ? { background: RESULT_BG[m.result] } : undefined}
              >
                <span className="w-6 text-right font-condensed text-xs font-bold text-[var(--text3)]">
                  {m.round}
                </span>

                <span className="text-[10px] font-semibold text-[var(--text3)] w-4 text-center">
                  {m.isHome ? 'C' : 'F'}
                </span>

                <TeamLogo logo={opp.logo} fallback={opp.c} size={18} />

                <span className="flex-1 text-xs text-[var(--text2)]">{opp.short}</span>

                {isNext && (
                  <span className="rounded-full bg-[var(--green-light)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                    Próx
                  </span>
                )}

                {isPast && m.result ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-condensed text-sm font-bold text-[var(--text)]">
                      {m.hG}–{m.aG}
                    </span>
                    <span
                      className="font-condensed w-4 text-center text-xs font-black"
                      style={{ color: RESULT_COLOR[m.result] }}
                    >
                      {RESULT_LABEL[m.result]}
                    </span>
                  </div>
                ) : !isNext ? (
                  <span className="text-xs text-[var(--text3)]">– : –</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-[var(--text3)]">
        <span><strong className="text-[var(--text2)]">C</strong> = Casa</span>
        <span><strong className="text-[var(--text2)]">F</strong> = Fora</span>
        <span style={{ color: 'var(--green-light)' }}>V</span>
        <span style={{ color: 'var(--yellow)' }}>E</span>
        <span style={{ color: 'var(--red)' }}>D</span>
      </div>
    </div>
  );
}
