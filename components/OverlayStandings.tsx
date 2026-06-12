'use client';

import { MY_TEAM_ID } from '@/data/teams';
import { getTeamDisplay, sortedStandings } from '@/lib/simulator';
import { getZone, getZoneBorder } from '@/lib/helpers';
import type { ShieldConfig, Standing } from '@/lib/types';
import TeamLogo from './TeamLogo';
import ShieldSvg from './ShieldSvg';

interface OverlayStandingsProps {
  standings: Standing[];
  shieldConfig?: ShieldConfig;
}

export default function OverlayStandings({ standings, shieldConfig }: OverlayStandingsProps) {
  const sorted = sortedStandings(standings);
  const myPos = sorted.findIndex((s) => s.id === MY_TEAM_ID) + 1;
  const myStanding = sorted.find((s) => s.id === MY_TEAM_ID);
  const zone = getZone(myPos);

  return (
    <div className="flex h-full flex-col bg-[var(--card)] p-4">
      <div className="mb-3 border-b border-[var(--border)] pb-3 text-center">
        <div className="font-condensed text-xs font-bold uppercase tracking-wider text-[var(--text2)]">
          Classificação atualizada
        </div>
        <div
          className="font-condensed text-5xl font-black leading-none"
          style={{
            color:
              zone.cls === 'zl'
                ? '#42a5f5'
                : zone.cls === 'zs'
                  ? '#26a69a'
                  : zone.cls === 'zr'
                    ? 'var(--red)'
                    : 'var(--green-light)',
          }}
        >
          {myPos}º
        </div>
        <div className="mt-1 text-sm font-medium text-[var(--text2)]">{zone.label}</div>
        {myStanding && (
          <div className="mt-2 flex justify-center gap-3 text-xs text-[var(--text2)]">
            <span>
              <strong className="text-[var(--text)]">{myStanding.pts}</strong> pts
            </span>
            <span>
              <strong className="text-[var(--text)]">{myStanding.w}</strong>V
            </span>
            <span>
              <strong className="text-[var(--text)]">{myStanding.d}</strong>E
            </span>
            <span>
              <strong className="text-[var(--text)]">{myStanding.l}</strong>D
            </span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--card)]">
            <tr>
              {['#', 'Time', 'J', 'PTS'].map((h, i) => (
                <th
                  key={h}
                  className={`border-b border-[var(--border)] px-2 py-1.5 font-condensed text-xs font-bold uppercase text-[var(--text2)] ${
                    i === 1 ? 'text-left' : 'text-center'
                  }`}
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
                  className={
                    isMy
                      ? 'bg-[rgba(31,196,94,0.15)] font-semibold text-[var(--text)]'
                      : 'text-[var(--text2)]'
                  }
                >
                  <td
                    className={`border-b border-[var(--border)] px-2 py-1.5 text-center ${zCls} ${
                      isMy ? 'font-bold text-[var(--green-light)]' : ''
                    }`}
                  >
                    {pos}
                  </td>
                  <td className="border-b border-[var(--border)] px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      {isMy && shieldConfig
                        ? <ShieldSvg config={shieldConfig} short={t.short} size={14} />
                        : <TeamLogo logo={t.logo} fallback={t.c} size={16} />}
                      <span className={isMy ? 'text-[var(--green-light)]' : ''}>{t.short}</span>
                    </div>
                  </td>
                  <td className="border-b border-[var(--border)] px-2 py-1.5 text-center">
                    {s.played}
                  </td>
                  <td
                    className={`border-b border-[var(--border)] px-2 py-1.5 text-center font-bold ${
                      isMy ? 'text-[var(--green-light)]' : 'text-[var(--text)]'
                    }`}
                  >
                    {s.pts}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
