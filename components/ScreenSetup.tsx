'use client';

import { useState, useEffect } from 'react';

function genShort(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return '---';
  if (words.length === 1) {
    const w = words[0];
    return w.slice(0, 3).padEnd(3, w[0]);
  }
  if (words.length === 2) {
    return (words[0].slice(0, 2) + words[1][0]).slice(0, 3);
  }
  return words.slice(0, 3).map((w) => w[0]).join('');
}

interface ScreenSetupProps {
  onConfirm: (name: string, short: string) => void;
}

export default function ScreenSetup({ onConfirm }: ScreenSetupProps) {
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const trimmed = name.trim();
  const short = trimmed.length >= 2 ? genShort(trimmed) : '---';
  const valid = trimmed.length >= 2;

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-2 sm:px-4"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      <div className="w-full max-w-md">

        {/* Badge preview — above the card, centered */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 transition-all duration-300"
            style={{
              borderColor: valid ? 'var(--green-light)' : 'var(--border2)',
              background: valid
                ? 'radial-gradient(circle at 40% 35%, rgba(20,163,82,0.18), rgba(20,163,82,0.04))'
                : 'var(--card)',
              boxShadow: valid ? '0 0 32px rgba(20,163,82,0.15)' : 'none',
            }}
          >
            {valid ? (
              <span
                className="font-condensed text-2xl font-black tracking-widest"
                style={{ color: 'var(--green-light)' }}
              >
                {short}
              </span>
            ) : (
              <span className="text-4xl" style={{ filter: 'grayscale(0.3)' }}>
                ⚽
              </span>
            )}
          </div>

          <div
            className="font-condensed text-sm font-bold uppercase tracking-widest transition-all duration-300"
            style={{ color: valid ? 'var(--green-light)' : 'var(--text3)' }}
          >
            {valid ? trimmed : 'Seu Time'}
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-5 sm:p-8"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border2)',
          }}
        >
          <h2
            className="font-condensed mb-1 text-center text-2xl font-black uppercase leading-tight sm:text-3xl"
            style={{ color: 'var(--text)' }}
          >
            Qual é o nome
            <br />
            <span style={{ color: 'var(--green-light)' }}>do seu time?</span>
          </h2>
          <p
            className="mb-6 text-center text-sm leading-relaxed"
            style={{ color: 'var(--text2)' }}
          >
            Escolha bem — esse será seu time durante todo o BRA26
          </p>

          {/* Input */}
          <div className="relative mb-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && valid && onConfirm(trimmed, short)}
              placeholder="Ex: Trovões do Norte"
              maxLength={32}
              autoFocus
              className="w-full rounded-xl px-4 py-3.5 text-base font-medium outline-none transition-all duration-200 placeholder:font-normal"
              style={{
                background: 'var(--bg3)',
                color: 'var(--text)',
                border: `2px solid ${focused ? 'var(--green-light)' : 'var(--border2)'}`,
                caretColor: 'var(--green-light)',
              }}
            />
            {name.length > 0 && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: 'var(--text3)' }}
              >
                {name.length}/32
              </span>
            )}
          </div>

          {/* Sigla row */}
          <div className="mb-6 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Sigla:
            </span>
            <span
              className="rounded-full px-3 py-0.5 font-mono text-sm font-bold tracking-widest transition-all duration-200"
              style={{
                background: valid ? 'rgba(20,163,82,0.15)' : 'rgba(255,255,255,0.06)',
                color: valid ? 'var(--green-light)' : 'var(--text3)',
              }}
            >
              {short}
            </span>
            {valid && (
              <span className="text-xs" style={{ color: 'var(--text3)' }}>
                gerada automaticamente
              </span>
            )}
          </div>

          {/* Button */}
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(trimmed, short)}
            className="btn-primary w-full py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-30"
          >
            Continuar →
          </button>
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--text3)' }}>
          BRA26 · 20 times · 38 rodadas
        </p>
      </div>
    </div>
  );
}
