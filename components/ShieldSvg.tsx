'use client';

import { useId } from 'react';
import type { ShieldConfig } from '@/lib/types';

export const SHIELD_PATHS: Record<string, string> = {
  classic: 'M50,6 L94,20 L94,70 C94,92 50,116 50,116 C50,116 6,92 6,70 L6,20 Z',
  modern:  'M14,8 Q50,4 86,8 L88,65 Q88,96 50,113 Q12,96 12,65 Z',
  angular: 'M6,6 L94,6 L94,78 L50,115 L6,78 Z',
  round:   'M50,6 C76,6 95,26 95,52 C95,82 75,107 50,115 C25,107 5,82 5,52 C5,26 24,6 50,6 Z',
  crest:   'M6,20 Q6,6 20,6 L80,6 Q94,6 94,20 L94,78 L50,115 L6,78 Z',
};

export const ADORNMENT_PATHS: Record<string, string[]> = {
  none:     [],
  vstripe:  ['M36,0 L64,0 L64,120 L36,120 Z'],
  hstripes: ['M0,22 L100,22 L100,42 L0,42 Z', 'M0,62 L100,62 L100,82 L0,82 Z'],
  diag:     ['M-10,72 L78,-10 L112,20 L22,110 Z'],
  cross:    ['M40,0 L60,0 L60,120 L40,120 Z', 'M0,45 L100,45 L100,65 L0,65 Z'],
  halves:   ['M0,0 L50,0 L50,120 L0,120 Z'],
  chevron:  ['M0,30 L50,72 L100,30 L100,54 L50,96 L0,54 Z'],
};

interface Props {
  config: ShieldConfig;
  short?: string;
  size?: number;
}

export default function ShieldSvg({ config, short, size = 80 }: Props) {
  const rawId = useId();
  const clipId = `sc${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const { shape, primary, secondary, tertiary, adornment } = config;
  const shieldPath = SHIELD_PATHS[shape] ?? SHIELD_PATHS.classic;
  const adornPaths = ADORNMENT_PATHS[adornment] ?? [];
  const h = Math.round(size * 1.2);

  return (
    <svg viewBox="0 0 100 120" width={size} height={h} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <path d={shieldPath} />
        </clipPath>
      </defs>
      {/* Background */}
      <path d={shieldPath} fill={primary} />
      {/* Adornments clipped to shield shape */}
      {adornPaths.map((p, i) => (
        <path key={i} d={p} fill={secondary} clipPath={`url(#${clipId})`} />
      ))}
      {/* Outer border */}
      <path d={shieldPath} fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth={3.5} />
      {/* Inner highlight */}
      <path d={shieldPath} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} />
      {/* Sigla */}
      {short && (
        <text
          x="50"
          y="67"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight="900"
          fontFamily="'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
          fill={tertiary}
          letterSpacing="2"
        >
          {short}
        </text>
      )}
    </svg>
  );
}
