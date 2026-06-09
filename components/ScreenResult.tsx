'use client';

import { MY_TEAM_ID } from '@/data/teams';
import { getTeamDisplay, sortedStandings } from '@/lib/simulator';
import { getZone, getZoneBorder } from '@/lib/helpers';
import type { LineupSlot, MatchHistoryEntry, Standing } from '@/lib/types';
import TeamLogo from './TeamLogo';

interface ScreenResultProps {
  standings: Standing[];
  lineup: LineupSlot[];
  playerGoals: Record<string, number>;
  matchHistory: MatchHistoryEntry[];
  onRestart: () => void;
}

const RESULT_COLOR = { W: 'var(--green-light)', D: 'var(--yellow)', L: 'var(--red)' } as const;
const RESULT_BG = { W: 'rgba(20,163,82,0.15)', D: 'rgba(255,193,7,0.15)', L: 'rgba(255,82,82,0.15)' } as const;

export default function ScreenResult({
  standings,
  lineup,
  playerGoals,
  matchHistory,
  onRestart,
}: ScreenResultProps) {
  const sorted = sortedStandings(standings);
  const myPos = sorted.findIndex((s) => s.id === MY_TEAM_ID) + 1;
  const myS = sorted.find((s) => s.id === MY_TEAM_ID)!;
  const zone = getZone(myPos);
  const myTeam = getTeamDisplay(MY_TEAM_ID);

  const zoneColor =
    zone.cls === 'zl' ? '#42a5f5' : zone.cls === 'zs' ? '#26a69a' : zone.cls === 'zr' ? 'var(--red)' : 'var(--green-light)';

  const scorers = lineup
    .filter((s) => s.player && (playerGoals[s.player.n] ?? 0) > 0)
    .sort((a, b) => (playerGoals[b.player!.n] ?? 0) - (playerGoals[a.player!.n] ?? 0));

  const allPlayers = lineup.filter((s) => s.player);

  const stats = [
    { v: myS.pts, l: 'Pontos' },
    { v: myS.w, l: 'Vitórias' },
    { v: myS.d, l: 'Empates' },
    { v: myS.l, l: 'Derrotas' },
    { v: myS.gf, l: 'Gols pró' },
    { v: myS.ga, l: 'Gols contra' },
  ];

  return (
    <div className="space-y-5">

      {/* ── HERO ── */}
      <div
        className="overflow-hidden rounded-2xl border border-[var(--border2)]"
        style={{ background: 'linear-gradient(135deg, var(--green-dark) 0%, var(--bg2) 100%)' }}
      >
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <div
            className="font-condensed text-[88px] font-black leading-none"
            style={{ color: zoneColor, textShadow: `0 0 40px ${zoneColor}44` }}
          >
            {myPos}º
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo logo={myTeam.logo} fallback={myTeam.c} size={28} />
            <span className="font-condensed text-xl font-extrabold uppercase tracking-wide text-white">
              {myTeam.name}
            </span>
          </div>
          <div
            className="rounded-full px-4 py-1 text-sm font-bold uppercase tracking-widest"
            style={{ background: `${zoneColor}22`, color: zoneColor, border: `1px solid ${zoneColor}44` }}
          >
            {zone.label}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-6 divide-x divide-[var(--border)] border-t border-[var(--border)] bg-[var(--bg2)]/60">
          {stats.map(({ v, l }) => (
            <div key={l} className="py-3 text-center">
              <div className="font-condensed text-2xl font-black text-white">{v}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text3)]">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY GRID ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

        {/* LEFT — Standings */}
        <div>
          <h3 className="section-title mb-3">Classificação Final</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['#', 'Time', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'PTS'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 font-condensed text-xs font-bold uppercase tracking-wide text-[var(--text3)] ${i === 1 ? 'text-left' : 'text-center'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const pos = i + 1;
                  const t = getTeamDisplay(s.id);
                  const isMy = s.id === MY_TEAM_ID;
                  const zCls = getZoneBorder(pos);
                  return (
                    <tr
                      key={s.id}
                      className={isMy ? 'bg-[rgba(20,163,82,0.08)]' : ''}
                    >
                      <td className={`border-b border-[var(--border)] px-3 py-2 text-center text-sm font-bold ${zCls} ${isMy ? 'text-[var(--green-light)]' : 'text-[var(--text2)]'}`}>
                        {pos}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <TeamLogo logo={t.logo} fallback={t.c} size={20} />
                          <span className={`text-sm ${isMy ? 'font-bold text-[var(--green-light)]' : 'text-[var(--text2)]'}`}>
                            {t.name}
                          </span>
                        </div>
                      </td>
                      {[s.played, s.w, s.d, s.l, s.gf, s.ga, s.gf - s.ga].map((val, vi) => (
                        <td key={vi} className="border-b border-[var(--border)] px-3 py-2 text-center text-sm text-[var(--text2)]">
                          {val}
                        </td>
                      ))}
                      <td className="border-b border-[var(--border)] px-3 py-2 text-center text-sm font-bold text-[var(--text)]">
                        {s.pts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — scorers + history + button */}
        <div className="space-y-4">

          <button type="button" onClick={onRestart} className="btn-primary w-full py-3.5 text-base">
            ↺ Jogar novamente
          </button>

          {/* Artilheiros */}
          <div className="panel">
            <div className="panel-title mb-3">⚽ Artilheiros do meu time</div>
            {scorers.length === 0 ? (
              <p className="text-sm text-[var(--text3)]">Nenhum gol marcado.</p>
            ) : (
              scorers.map((s, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-[var(--border)] py-2 last:border-0">
                  <span className="font-condensed w-5 text-center text-base font-black text-[var(--text3)]">{i + 1}</span>
                  <TeamLogo logo={s.player!.tl} fallback={s.player!.tc} size={18} />
                  <span className="flex-1 text-sm text-[var(--text)]">{s.player!.n}</span>
                  <span className="font-condensed text-base font-extrabold text-[var(--green-light)]">
                    {playerGoals[s.player!.n]}
                  </span>
                </div>
              ))
            )}
            {/* jogadores sem gol */}
            {allPlayers.filter(s => !(playerGoals[s.player!.n] > 0)).map((s, i) => (
              <div key={`ng-${i}`} className="flex items-center gap-2 border-b border-[var(--border)] py-2 last:border-0 opacity-40">
                <span className="font-condensed w-5 text-center text-base font-black text-[var(--text3)]">—</span>
                <TeamLogo logo={s.player!.tl} fallback={s.player!.tc} size={18} />
                <span className="flex-1 text-sm text-[var(--text)]">{s.player!.n}</span>
                <span className="text-sm text-[var(--text3)]">0</span>
              </div>
            ))}
          </div>

          {/* Histórico */}
          <div className="panel">
            <div className="panel-title mb-3">📋 Histórico de partidas</div>
            <div className="space-y-1">
              {matchHistory.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{ background: RESULT_BG[m.result] }}
                >
                  <span
                    className="font-condensed w-5 text-center text-sm font-black"
                    style={{ color: RESULT_COLOR[m.result] }}
                  >
                    {m.result}
                  </span>
                  <span className="text-[var(--text3)] text-xs w-6">R{m.round}</span>
                  <span className="flex-1 text-sm text-[var(--text2)]">
                    {m.home} vs {m.away}
                  </span>
                  <span className="font-condensed text-sm font-bold text-[var(--text)]">
                    {m.hG}–{m.aG}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
