'use client';

import type { LineupSlot, SelectedPlayer } from '@/lib/types';
import { ini, shn } from '@/lib/helpers';
import { getPlayerPhoto } from '@/data/playerPhotos';

interface PitchBuilderProps {
  lineup: LineupSlot[];
  onSlotClick: (idx: number) => void;
  size?: 'default' | 'large';
  bench?: (SelectedPlayer | null)[];
  onBenchClick?: (idx: number) => void;
}

export default function PitchBuilder({
  lineup,
  onSlotClick,
  size = 'default',
  bench = [],
  onBenchClick,
}: PitchBuilderProps) {
  const isLarge = size === 'large';
  const showBench = isLarge && bench.length > 0;

  const rows: { pos: LineupSlot['pos'] }[] = [
    { pos: 'FW' },
    { pos: 'MF' },
    { pos: 'DF' },
    { pos: 'GK' },
  ];

  return (
    <div className="flex overflow-hidden rounded-lg">
      {/* ── Campo ── */}
      <div
        className={`relative flex flex-1 flex-col justify-between ${
          isLarge
            ? 'min-h-[420px] gap-2.5 p-3 sm:min-h-[500px] lg:min-h-[600px] lg:gap-4 lg:p-5'
            : 'min-h-[260px] gap-0.5 p-1 sm:min-h-[310px] sm:p-1.5'
        }`}
        style={{ background: 'linear-gradient(180deg, #1a5e2a, #1e7032 50%, #1a5e2a)' }}
      >
        {/* Marcações do campo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Borda externa do campo */}
          <div className="absolute inset-[7px] border border-white/20" />

          {/* Linha do meio */}
          <div className="absolute left-[8%] right-[8%] top-1/2 border border-white/15" />

          {/* Círculo central */}
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 ${
              isLarge ? 'h-[80px] w-[80px] lg:h-[100px] lg:w-[100px]' : 'h-[50px] w-[50px]'
            }`}
          />

          {/* Área superior (grande) */}
          <div
            className={`absolute left-[26%] right-[26%] top-[7px] border border-white/15 ${
              isLarge ? 'h-[60px] lg:h-[76px]' : 'h-[38px]'
            }`}
          />
          {/* Área superior (pequena) */}
          <div
            className={`absolute left-[36%] right-[36%] top-[7px] border border-white/10 ${
              isLarge ? 'h-[28px] lg:h-[36px]' : 'h-[18px]'
            }`}
          />

          {/* Área inferior (grande) */}
          <div
            className={`absolute bottom-[7px] left-[26%] right-[26%] border border-white/15 ${
              isLarge ? 'h-[60px] lg:h-[76px]' : 'h-[38px]'
            }`}
          />
          {/* Área inferior (pequena) */}
          <div
            className={`absolute bottom-[7px] left-[36%] right-[36%] border border-white/10 ${
              isLarge ? 'h-[28px] lg:h-[36px]' : 'h-[18px]'
            }`}
          />

          {/* Ponto do meio-campo */}
          <div className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20" />
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

      {/* ── Banco de Reservas (lateral direita) ── */}
      {showBench && (
        <div
          className="flex flex-col items-center justify-around border-l border-white/15 px-1.5 py-3 lg:px-2 lg:py-4"
          style={{ background: 'linear-gradient(180deg, #163d1c, #1a4d20 50%, #163d1c)', minWidth: '56px' }}
        >
          <span
            className="mb-1 text-center font-condensed text-[8px] font-bold uppercase tracking-widest text-white/40"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.2em' }}
          >
            Banco
          </span>
          {bench.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onBenchClick?.(i)}
              className="group flex flex-col items-center gap-0.5"
              title={p?.n ?? `Reserva ${i + 1}`}
            >
              <div
                className={`relative flex items-center justify-center overflow-hidden rounded-full transition-all lg:h-[42px] lg:w-[42px] ${
                  p
                    ? 'h-[34px] w-[34px] border-2 border-white/80 bg-white shadow-md group-hover:border-white'
                    : 'h-[34px] w-[34px] border-2 border-dashed border-white/30 bg-white/5 group-hover:border-white/50'
                }`}
              >
                {p ? (
                  <>
                    <span className="text-[8px] font-bold leading-none text-[#1a5e2a]">{ini(p.n)}</span>
                    {(p.photo ?? getPlayerPhoto(p.n)) && (
                      <img
                        src={p.photo ?? getPlayerPhoto(p.n)}
                        alt={p.n}
                        className="absolute inset-0 h-full w-full object-cover object-top"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </>
                ) : (
                  <span className="text-[9px] font-bold text-white/30">R{i + 1}</span>
                )}
              </div>
              <span className="max-w-[48px] truncate text-center text-[7px] leading-tight text-white/60 lg:text-[8px]">
                {p ? shn(p.n) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
