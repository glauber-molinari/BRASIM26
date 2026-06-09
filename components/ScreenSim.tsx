'use client';

import { MY_TEAM_ID, MY_TEAM_EMOJI } from '@/data/teams';
import { getTeamDisplay } from '@/lib/simulator';
import { shn } from '@/lib/helpers';
import type { LineupSlot, SimSpeed, StoredMatch } from '@/lib/types';
import StandingsTable from './StandingsTable';
import TeamLogo from './TeamLogo';
import SchedulePanel from './SchedulePanel';
import type { Standing } from '@/lib/types';

interface ScreenSimProps {
  schedule: [number, number][][];
  allMatches: StoredMatch[];
  standings: Standing[];
  lineup: LineupSlot[];
  playerGoals: Record<string, number>;
  viewRound: number;
  speed: SimSpeed;
  running: boolean;
  pendingLive: boolean;
  onSpeedChange: (s: SimSpeed) => void;
  onStart: () => void;
  onBack: () => void;
  onRoundChange: (dir: number) => void;
  onResumeLive: () => void;
}

export default function ScreenSim({
  schedule,
  allMatches,
  standings,
  lineup,
  playerGoals,
  viewRound,
  speed,
  running,
  pendingLive,
  onSpeedChange,
  onStart,
  onBack,
  onRoundChange,
  onResumeLive,
}: ScreenSimProps) {
  const pairs = schedule[viewRound] ?? [];
  const results = allMatches.filter((m) => m.round === viewRound);

  return (
    <>
      {pendingLive && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--yellow)]/40 bg-[var(--yellow)]/10 px-4 py-3">
          <span className="text-sm font-medium text-[var(--yellow)]">
            ⏸ Campeonato pausado
          </span>
          <button
            type="button"
            onClick={onResumeLive}
            className="rounded-lg bg-[var(--yellow)] px-4 py-1.5 text-sm font-bold text-black transition-opacity hover:opacity-80"
          >
            Retomar →
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="section-title">BRA26</h2>
          <p className="section-sub">38 rodadas · Meu Time {MY_TEAM_EMOJI}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="text-sm text-[var(--text2)]">Velocidade</label>
          <select
            value={speed}
            disabled={running}
            onChange={(e) => onSpeedChange(Number(e.target.value) as SimSpeed)}
            className="rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value={700}>Normal</option>
            <option value={250}>Rápido</option>
            <option value={60}>Ultra</option>
          </select>
          <button type="button" onClick={onStart} disabled={running} className="btn-primary px-4 py-2 text-sm">
            ▶ Iniciar
          </button>
          <button type="button" onClick={onBack} disabled={running} className="btn-ghost">
            ← Voltar
          </button>
        </div>
      </div>

      <div className="grid gap-3.5 md:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onRoundChange(-1)}
              disabled={viewRound === 0 || running}
              className="btn-ghost disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="font-condensed text-lg font-bold uppercase text-[var(--text)]">
              Rodada {viewRound + 1} / 38
            </span>
            <button
              type="button"
              onClick={() => onRoundChange(1)}
              disabled={viewRound === 37 || running}
              className="btn-ghost disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>

          {pairs.map(([homeId, awayId]) => {
            const home = getTeamDisplay(homeId);
            const away = getTeamDisplay(awayId);
            const res = results.find((m) => m.home === homeId && m.away === awayId);
            const isMy = homeId === MY_TEAM_ID || awayId === MY_TEAM_ID;

            return (
              <div
                key={`${homeId}-${awayId}`}
                className={`mb-2 rounded-xl border-2 p-3.5 ${
                  isMy
                    ? 'border-[var(--green-light)]/50 bg-[rgba(31,196,94,0.08)]'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 flex-col items-end text-right">
                    <TeamLogo logo={home.logo} fallback={home.c} size={32} />
                    <div
                      className={`font-condensed text-base font-extrabold uppercase ${
                        homeId === MY_TEAM_ID ? 'text-[var(--green-light)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {home.short}
                    </div>
                  </div>
                  <div className="min-w-[72px] rounded-lg bg-[var(--bg3)] px-3 py-2 text-center">
                    <div className="font-condensed text-3xl font-black tracking-wide text-white">
                      {res ? (
                        <>
                          {res.hG} – {res.aG}
                        </>
                      ) : (
                        <span className="text-[var(--text3)]">– : –</span>
                      )}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text2)]">
                      {res ? 'FT' : 'Aguardando'}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col items-start text-left">
                    <TeamLogo logo={away.logo} fallback={away.c} size={32} />
                    <div
                      className={`font-condensed text-base font-extrabold uppercase ${
                        awayId === MY_TEAM_ID ? 'text-[var(--green-light)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {away.short}
                    </div>
                  </div>
                </div>
                {res && isMy && res.evs.length > 0 && (
                  <div className="mt-1.5 text-sm leading-relaxed text-[var(--text2)]">
                    {res.evs
                      .filter((e) => e.type === 'goal')
                      .map((e) => `${e.min}' ⚽ ${shn(e.player)} (${e.tshort})`)
                      .join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <div className="panel mb-3">
            <div className="panel-title">Meu time</div>
            {lineup
              .filter((s) => s.player)
              .map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 border-b border-[var(--border)] py-1.5 text-sm last:border-0"
                >
                  <span className="text-xs">{s.player!.tc}</span>
                  <span className="flex-1 text-[var(--text)]">{s.player!.n}</span>
                  <span className={`pl-pbadge pos-${s.pos} text-[9px]`}>{s.pos}</span>
                  {(playerGoals[s.player!.n] ?? 0) > 0 && (
                    <span className="text-[11px] font-semibold text-[var(--green-light)]">
                      ⚽{playerGoals[s.player!.n]}
                    </span>
                  )}
                </div>
              ))}
          </div>
          <div className="panel mb-3">
            <div className="panel-title">Classificação</div>
            <StandingsTable standings={standings} compact aroundMyTeam />
          </div>
          <SchedulePanel
            schedule={schedule}
            allMatches={allMatches}
          />
        </div>
      </div>
    </>
  );
}
