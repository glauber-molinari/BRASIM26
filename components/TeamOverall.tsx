'use client';

import { getLineupStrength, getOverallColor } from '@/lib/simulator';
import type { LineupSlot } from '@/lib/types';

interface TeamOverallProps {
  lineup: LineupSlot[];
}

function StatBar({ label, value, max = 90 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-xs font-bold uppercase text-[var(--text2)]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg)]">
        <div
          className="h-full rounded-full bg-[var(--green-light)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-sm font-bold text-[var(--text)]">{value}</span>
    </div>
  );
}

export default function TeamOverall({ lineup }: TeamOverallProps) {
  const strength = getLineupStrength(lineup);
  const { count, att, def, overall, isComplete, bonus } = strength;
  const ovrColor = count > 0 ? getOverallColor(overall) : 'var(--text3)';

  if (count === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border2)] bg-[var(--bg3)] px-4 py-5 text-center">
        <div className="font-condensed text-sm font-bold uppercase tracking-wide text-[var(--text2)]">
          Overall do time
        </div>
        <p className="mt-1 text-sm text-[var(--text3)]">Escale jogadores para ver a força do time</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 px-4 py-4 transition-all duration-300 ${
        isComplete
          ? 'border-[var(--green-light)] bg-[rgba(31,196,94,0.1)] shadow-[0_0_20px_rgba(31,196,94,0.15)]'
          : 'border-[var(--border2)] bg-[var(--bg3)]'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-condensed text-xs font-bold uppercase tracking-wider text-[var(--text2)]">
            {isComplete ? 'Overall total' : 'Overall em formação'}
          </div>
          <div className="text-sm text-[var(--text2)]">
            {count}/11 titulares
            {isComplete && bonus > 0 && (
              <span className="ml-1 text-[var(--green-light)]">· +{bonus} bônus</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div
            className="font-condensed text-4xl font-black leading-none transition-colors duration-300"
            style={{ color: ovrColor }}
          >
            {overall}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text2)]">
            OVR
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <StatBar label="ATK" value={att} />
        <StatBar label="DEF" value={def} />
      </div>

      {isComplete ? (
        <div className="mt-3 rounded-lg bg-[rgba(31,196,94,0.15)] px-3 py-2 text-center text-sm font-semibold text-[var(--green-light)]">
          Time completo — pronto para simular!
        </div>
      ) : (
        <div className="mt-3 text-center text-xs text-[var(--text3)]">
          Faltam {11 - count} jogador{11 - count !== 1 ? 'es' : ''} para o overall final
        </div>
      )}
    </div>
  );
}
