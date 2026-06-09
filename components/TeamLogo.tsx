'use client';

import { useState } from 'react';

interface TeamLogoProps {
  logo?: string;
  fallback: string;
  size?: number;
  className?: string;
}

export default function TeamLogo({ logo, fallback, size = 32, className = '' }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.72) }}
      aria-hidden
    >
      {fallback}
    </span>
  );
}
