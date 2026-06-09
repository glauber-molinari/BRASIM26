'use client';

import type { LineupSlot } from '@/lib/types';
import { ini, shn } from '@/lib/helpers';
import { getPlayerPhoto } from '@/data/playerPhotos';

interface PitchBuilderProps {
  lineup: LineupSlot[];
  onSlotClick: (idx: number) => void;
}

export default function PitchBuilder({ lineup, onSlotClick }: PitchBuilderProps) {
  const rows: { id: string; pos: LineupSlot['pos'] }[] = [
    { id: 'fw', pos: 'FW' },
    { id: 'mf', pos: 'MF' },
    { id: 'df', pos: 'DF' },
    { id: 'gk', pos: 'GK' },
  ];

  return (
    <div
      className="relative flex min-h-[310px] flex-col justify-between gap-0.5 rounded-lg p-1.5"
      style={{
        background: 'linear-gradient(180deg, #1a5e2a, #1e7032 50%, #1a5e2a)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute left-[8%] right-[8%] top-1/2 border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-[26%] right-[26%] top-[7px] h-[38px] border border-white/10" />
        <div className="absolute bottom-[7px] left-[26%] right-[26%] h-[38px] border border-white/10" />
      </div>

      {rows.map(({ pos }) => (
        <div key={pos} className="relative z-[1] flex justify-center gap-1">
          {lineup
            .map((slot, idx) => ({ slot, idx }))
            .filter(({ slot }) => slot.pos === pos)
            .map(({ slot, idx }) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSlotClick(idx)}
                className="flex min-w-[58px] flex-col items-center p-1"
              >
                <div
                  className={`relative flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full transition-all ${
                    slot.player
                      ? 'border-2 border-white bg-white shadow-md'
                      : 'border-2 border-dashed border-white/40 bg-white/10'
                  }`}
                >
                  {slot.player ? (
                    <>
                      <span className="text-[9px] font-bold leading-none text-[#1a5e2a]">
                        {ini(slot.player.n)}
                      </span>
                      {getPlayerPhoto(slot.player.n) && (
                        <img
                          src={getPlayerPhoto(slot.player.n)}
                          alt={slot.player.n}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </>
                  ) : (
                    <span className="font-condensed text-[11px] font-bold leading-none text-white/90">
                      {slot.pos}
                    </span>
                  )}
                </div>
                <div className="mt-1 max-w-[58px] truncate text-center text-[9px] font-medium text-white">
                  {slot.player ? shn(slot.player.n) : '—'}
                </div>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
