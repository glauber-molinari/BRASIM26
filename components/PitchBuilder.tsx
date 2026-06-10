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
      className="relative flex min-h-[260px] flex-col justify-between gap-0.5 rounded-lg p-1 sm:min-h-[310px] sm:p-1.5"
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
                className="flex min-w-[44px] flex-col items-center p-0.5 sm:min-w-[58px] sm:p-1"
              >
                <div
                  className={`relative flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full transition-all sm:h-[42px] sm:w-[42px] ${
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
                      {(slot.player.photo ?? getPlayerPhoto(slot.player.n)) && (
                        <img
                          src={slot.player.photo ?? getPlayerPhoto(slot.player.n)}
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
                <div className="mt-0.5 max-w-[44px] truncate text-center text-[8px] font-medium text-white sm:mt-1 sm:max-w-[58px] sm:text-[9px]">
                  {slot.player ? shn(slot.player.n) : '—'}
                </div>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
