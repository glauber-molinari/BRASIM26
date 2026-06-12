'use client';

import { MY_TEAM_ID } from '@/data/teams';
import { getTeamDisplay, sortedStandings } from '@/lib/simulator';
import { getZoneBorder } from '@/lib/helpers';
import type { ShieldConfig, Standing } from '@/lib/types';
import TeamLogo from './TeamLogo';
import ShieldSvg from './ShieldSvg';

interface StandingsTableProps {
  standings: Standing[];
  compact?: boolean;
  aroundMyTeam?: boolean;
  shieldConfig?: ShieldConfig;
}

export default function StandingsTable({
  standings,
  compact = false,
  aroundMyTeam = false,
  shieldConfig,
}: StandingsTableProps) {
  const sorted = sortedStandings(standings);

  let rows = sorted.map((s, i) => ({ ...s, pos: i + 1 }));
  if (aroundMyTeam) {
    const myIdx = sorted.findIndex((s) => s.id === MY_TEAM_ID);
    const start = Math.max(0, myIdx - 2);
    rows = rows.slice(start, start + 7);
  }

  if (compact) {
    return (
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((s) => {
            const t = getTeamDisplay(s.id);
            const isMy = s.id === MY_TEAM_ID;
            return (
              <tr key={s.id} style={{ color: isMy ? 'var(--green-light)' : 'var(--text2)' }}>
                <td className="px-1 py-0.5 text-[var(--text3)]">{s.pos}</td>
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-1">
                    {isMy && shieldConfig
                      ? <ShieldSvg config={shieldConfig} short={t.short} size={14} />
                      : <TeamLogo logo={t.logo} fallback={t.c} size={16} />}
                    {t.name}
                  </div>
                </td>
                <td className="px-1 py-0.5 text-right font-bold text-[var(--text)]">{s.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="stand-t w-full border-collapse text-sm">
        <thead>
          <tr>
            {['#', 'Time', 'P', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'PTS'].map((h, i) => (
              <th
                key={h}
                className={`border-b border-[var(--border)] px-1.5 py-1.5 font-condensed text-[10px] font-bold uppercase tracking-wide text-[var(--text3)] ${
                  i === 1 ? 'text-left' : 'text-center'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const t = getTeamDisplay(s.id);
            const isMy = s.id === MY_TEAM_ID;
            const zCls = getZoneBorder(s.pos);
            return (
              <tr
                key={s.id}
                className={isMy ? 'myr [&_td]:bg-[rgba(20,163,82,0.08)] [&_td]:text-[var(--text)]' : ''}
              >
                <td className={`border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)] ${zCls} ${isMy ? '!text-[var(--green-light)] font-bold' : ''}`}>
                  {s.pos}
                </td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-left text-[var(--text2)]">
                  <div className="flex items-center gap-1.5">
                    {isMy && shieldConfig
                      ? <ShieldSvg config={shieldConfig} short={t.short} size={18} />
                      : <TeamLogo logo={t.logo} fallback={t.c} size={20} />}
                    {t.name}
                  </div>
                </td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.played}</td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.w}</td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.d}</td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.l}</td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.gf}</td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.ga}</td>
                <td className="border-b border-[var(--border)] px-1.5 py-1 text-center text-[var(--text2)]">{s.gf - s.ga}</td>
                <td className="pts border-b border-[var(--border)] px-1.5 py-1 text-center font-bold text-[var(--text)]">
                  {s.pts}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
