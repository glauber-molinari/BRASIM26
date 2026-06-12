'use client';

import { useState, useEffect } from 'react';
import ShieldSvg from '@/components/ShieldSvg';
import type { ShieldConfig, ShieldShape, ShieldAdornment } from '@/lib/types';
import { DEFAULT_SHIELD } from '@/lib/types';

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

const PALETTE = [
  '#C8102E', '#0D3464', '#1A56DB', '#38A3E8',
  '#FCD116', '#FF6B00', '#1E8449', '#0A3B22',
  '#F8F8F8', '#1A1A1A', '#8B1DBA', '#CC8800',
];

const SHAPES: ShieldShape[] = ['classic', 'modern', 'angular', 'round', 'crest'];
const ADORNMENTS: ShieldAdornment[] = ['none', 'vstripe', 'hstripes', 'diag', 'cross', 'halves', 'chevron'];

const SHAPE_LABELS: Record<ShieldShape, string> = {
  classic: 'Clássico',
  modern:  'Moderno',
  angular: 'Angular',
  round:   'Redondo',
  crest:   'Crista',
};

const ADORN_LABELS: Record<ShieldAdornment, string> = {
  none:     'Nenhum',
  vstripe:  'Faixa',
  hstripes: 'Listras',
  diag:     'Diagonal',
  cross:    'Cruz',
  halves:   'Metades',
  chevron:  'Chevron',
};

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <div
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text3)' }}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="h-7 w-7 rounded-full transition-all duration-150"
            style={{
              background: c,
              border: '2px solid rgba(255,255,255,0.15)',
              outline: value === c ? '3px solid var(--green-light)' : '3px solid transparent',
              outlineOffset: '2px',
              transform: value === c ? 'scale(1.18)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface ScreenSetupProps {
  onConfirm: (name: string, short: string, shield: ShieldConfig) => void;
}

export default function ScreenSetup({ onConfirm }: ScreenSetupProps) {
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'name' | 'shield'>('name');
  const [activeTab, setActiveTab] = useState<'escudo' | 'adornos'>('escudo');
  const [shield, setShield] = useState<ShieldConfig>(DEFAULT_SHIELD);

  useEffect(() => { setMounted(true); }, []);

  const trimmed = name.trim();
  const short = trimmed.length >= 2 ? genShort(trimmed) : '---';
  const valid = trimmed.length >= 2;

  /* ── Step 1: Name ─────────────────────────────────────────────────────── */
  if (step === 'name') {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-2 sm:px-4"
        style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}
      >
        <div className="w-full max-w-md">

          {/* Badge preview */}
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
                <span className="text-4xl" style={{ filter: 'grayscale(0.3)' }}>⚽</span>
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
            style={{ background: 'var(--card)', borderColor: 'var(--border2)' }}
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

            <div className="relative mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && valid && setStep('shield')}
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

            <button
              type="button"
              disabled={!valid}
              onClick={() => setStep('shield')}
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

  /* ── Step 2: Shield customizer ────────────────────────────────────────── */
  return (
    <div
      className="flex min-h-[60vh] items-start justify-center px-2 py-4 sm:px-4"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      <div className="w-full max-w-md">

        {/* Shield preview */}
        <div className="mb-5 flex flex-col items-center gap-2">
          <ShieldSvg config={shield} short={short} size={100} />
          <div
            className="font-condensed text-sm font-bold uppercase tracking-widest"
            style={{ color: 'var(--green-light)' }}
          >
            {trimmed}
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border2)' }}
        >
          <h2
            className="font-condensed mb-4 text-center text-xl font-black uppercase leading-tight"
            style={{ color: 'var(--text)' }}
          >
            Monte o seu{' '}
            <span style={{ color: 'var(--green-light)' }}>escudo</span>
          </h2>

          {/* Tabs */}
          <div
            className="mb-5 flex gap-1 rounded-xl p-1"
            style={{ background: 'var(--bg3)' }}
          >
            {(['escudo', 'adornos'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="flex-1 rounded-lg py-2 text-sm font-bold uppercase tracking-wide transition-all duration-150"
                style={{
                  background: activeTab === tab ? 'var(--green)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text3)',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Tab: Escudo ── */}
          {activeTab === 'escudo' && (
            <div className="space-y-5">
              {/* Shape selector */}
              <div>
                <div
                  className="mb-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text3)' }}
                >
                  Forma
                </div>
                <div className="flex gap-1.5">
                  {SHAPES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShield((prev) => ({ ...prev, shape: s }))}
                      title={SHAPE_LABELS[s]}
                      className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all duration-150"
                      style={{
                        background:
                          shield.shape === s
                            ? 'rgba(31,196,94,0.12)'
                            : 'rgba(255,255,255,0.04)',
                        border: `2px solid ${shield.shape === s ? 'var(--green-light)' : 'transparent'}`,
                      }}
                    >
                      <ShieldSvg config={{ ...shield, shape: s }} size={34} />
                      <span
                        className="text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          color:
                            shield.shape === s ? 'var(--green-light)' : 'var(--text3)',
                        }}
                      >
                        {SHAPE_LABELS[s]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color pickers */}
              <ColorRow
                label="Cor primária"
                value={shield.primary}
                onChange={(c) => setShield((prev) => ({ ...prev, primary: c }))}
              />
              <ColorRow
                label="Cor secundária"
                value={shield.secondary}
                onChange={(c) => setShield((prev) => ({ ...prev, secondary: c }))}
              />
              <ColorRow
                label="Cor da sigla"
                value={shield.tertiary}
                onChange={(c) => setShield((prev) => ({ ...prev, tertiary: c }))}
              />
            </div>
          )}

          {/* ── Tab: Adornos ── */}
          {activeTab === 'adornos' && (
            <div>
              <div
                className="mb-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text3)' }}
              >
                Adorno
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ADORNMENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setShield((prev) => ({ ...prev, adornment: a }))}
                    title={ADORN_LABELS[a]}
                    className="flex flex-col items-center gap-1 rounded-xl py-2 transition-all duration-150"
                    style={{
                      background:
                        shield.adornment === a
                          ? 'rgba(31,196,94,0.12)'
                          : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${shield.adornment === a ? 'var(--green-light)' : 'transparent'}`,
                    }}
                  >
                    <ShieldSvg config={{ ...shield, adornment: a }} size={38} />
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        color:
                          shield.adornment === a
                            ? 'var(--green-light)'
                            : 'var(--text3)',
                      }}
                    >
                      {ADORN_LABELS[a]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setStep('name')}
            className="btn-secondary px-5 py-3"
          >
            ← Voltar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmed, short, shield)}
            className="btn-primary flex-1 py-3 text-base font-bold"
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
}
