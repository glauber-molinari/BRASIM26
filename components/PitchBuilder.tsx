'use client';

import type { LineupSlot } from '@/lib/types';
import { ini, shn } from '@/lib/helpers';
import { getPlayerPhoto } from '@/data/playerPhotos';

interface PitchBuilderProps {
  lineup: LineupSlot[];
  onSlotClick: (idx: number) => void;
  size?: 'default' | 'large';
}

export default function PitchBuilder({ lineup, onSlotClick, size = 'default' }: PitchBuilderProps) {
  const isLarge = size === 'large';
  const rows: { id: string; pos: LineupSlot['pos'] }[] = [
    { id: 'fw', pos: 'FW' },
    { id: 'mf', pos: 'MF' },
    { id: 'df', pos: 'DF' },
    { id: 'gk', pos: 'GK' },
  ];

  return (
    <div
      className={`relative flex flex-col justify-between rounded-lg ${
        isLarge
          ? 'min-h-[420px] gap-2.5 p-3 sm:min-h-[500px] lg:min-h-[600px] lg:gap-4 lg:p-5'
          : 'min-h-[260px] gap-0.5 p-1 sm:min-h-[310px] sm:p-1.5'
      }`}
      style={{
        background: 'linear-gradient(180deg, #1a5e2a, #1e7032 50%, #1a5e2a)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute left-[8%] right-[8%] top-1/2 border border-white/10" />
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 ${
            isLarge ? 'h-[80px] w-[80px] lg:h-[100px] lg:w-[100px]' : 'h-[50px] w-[50px]'
          }`}
        />
        <div
          className={`absolute left-[26%] right-[26%] top-[7px] border border-white/10 ${
            isLarge ? 'h-[60px] lg:h-[76px]' : 'h-[38px]'
          }`}
        />
        <div
          className={`absolute bottom-[7px] left-[26%] right-[26%] border border-white/10 ${
            isLarge ? 'h-[60px] lg:h-[76px]' : 'h-[38px]'
          }`}
        />
      </div>

      {rows.map(({ pos }) => (
        <div
          key={pos}
          className={`relative z-[1] flex justify-center ${isLarge ? 'gap-2 lg:gap-3' : 'gap-1'}`}
        >
          {lineup
            .map((slot, idx) => ({ slot, idx }))
            .filter(({ slot }) => slot.pos === pos)
            .map(({ slot, idx }) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSlotClick(idx)}
                className={`flex flex-col items-center ${
                  isLarge ? 'min-w-[48px] p-1 sm:min-w-[54px] lg:min-w-[60px] lg:p-1' : 'min-w-[44px] p-0.5 sm:min-w-[58px] sm:p-1'
                }`}
              >
                <div
                  className={`relative flex items-center justify-center overflow-hidden rounded-full transition-all ${
                    isLarge
                      ? 'h-[36px] w-[36px] sm:h-[40px] sm:w-[40px] lg:h-[46px] lg:w-[46px]'
                      : 'h-[34px] w-[34px] sm:h-[42px] sm:w-[42px]'
                  } ${
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
                    <span
                      className={`font-condensed font-bold leading-none text-white/90 ${
                        isLarge ? 'text-[10px] lg:text-xs' : 'text-[11px]'
                      }`}
                    >
                      {slot.pos}
                    </span>
                  )}
                </div>
                <div
                  className={`truncate text-center font-medium text-white ${
                    isLarge
                      ? 'mt-1 max-w-[48px] text-[8px] sm:max-w-[54px] sm:text-[9px] lg:max-w-[60px]'
                      : 'mt-0.5 max-w-[44px] text-[8px] sm:mt-1 sm:max-w-[58px] sm:text-[9px]'
                  }`}
                >
                  {slot.player ? shn(slot.player.n) : '—'}
                </div>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
