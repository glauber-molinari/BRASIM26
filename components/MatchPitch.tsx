'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchEvent } from '@/lib/types';

// Campo em unidades SVG (105 x 68 — proporções FIFA)
const W = 105;
const H = 68;
const CENTER = { x: W / 2, y: H / 2 };

const WANDER_SPEED = 26; // unidades/s — jogo corrido
const DASH_SPEED = 90; // unidades/s — arrancada para o gol
const MAX_TRAIL = 5;

export interface PitchEvent {
  ev: MatchEvent;
  id: number;
}

type Side = 'home' | 'away';

interface RibbonStatus {
  team: Side | null;
  text: string;
  goal?: boolean;
}

interface MatchPitchProps {
  homeName: string;
  awayName: string;
  hPoss: number;
  paused: boolean;
  lastEvent: PitchEvent | null;
  onTogglePause?: () => void;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function MatchPitch({
  homeName,
  awayName,
  hPoss,
  paused,
  lastEvent,
  onTogglePause,
}: MatchPitchProps) {
  const ballRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);

  // Estado do "motor" da bola — refs para não re-renderizar a cada frame
  const pos = useRef({ ...CENTER });
  const target = useRef({ ...CENTER });
  const trail = useRef<{ x: number; y: number }[]>([]);
  const poss = useRef<Side>('home');
  const mode = useRef<'wander' | 'dash' | 'hold'>('hold');
  const holdUntil = useRef(0);
  const afterHold = useRef<(() => void) | null>(null);
  const pendingEv = useRef<MatchEvent | null>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hPossRef = useRef(hPoss);
  hPossRef.current = hPoss;

  const [status, setStatus] = useState<RibbonStatus>({ team: 'home', text: 'Bola segura' });
  const statusKey = useRef('home|Bola segura|0');

  const setRibbon = useCallback((s: RibbonStatus) => {
    const key = `${s.team}|${s.text}|${s.goal ? 1 : 0}`;
    if (key === statusKey.current) return;
    statusKey.current = key;
    setStatus(s);
  }, []);

  const pushTrail = useCallback(() => {
    trail.current.push({ x: pos.current.x, y: pos.current.y });
    if (trail.current.length > MAX_TRAIL) trail.current.shift();
  }, []);

  // ── Loop de animação (rAF) ──
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    // A movimentação entre eventos é sintética: random walk puxado para o
    // lado do time com mais posse, como nos campinhos de SofaScore/FotMob.
    const pickTarget = () => {
      const keep = poss.current === 'home' ? hPossRef.current : 100 - hPossRef.current;
      if (rand(0, 100) > keep) poss.current = poss.current === 'home' ? 'away' : 'home';
      const dir = poss.current === 'home' ? 1 : -1;
      pushTrail();
      target.current = {
        x: clamp(pos.current.x + dir * rand(6, 24), 7, 98),
        y: clamp(pos.current.y + rand(-15, 15), 8, 60),
      };
      mode.current = 'wander';
      const dangerous = poss.current === 'home' ? target.current.x > 76 : target.current.x < 29;
      setRibbon({ team: poss.current, text: dangerous ? 'Ataque perigoso' : 'Bola segura' });
    };

    const resolveEvent = (now: number) => {
      const ev = pendingEv.current;
      pendingEv.current = null;
      mode.current = 'hold';
      if (!ev) {
        holdUntil.current = now + 300;
        return;
      }
      if (ev.type === 'goal') {
        setRibbon({ team: ev.team, text: '⚽ GOOOL!', goal: true });
        holdUntil.current = now + 1800;
        afterHold.current = () => {
          trail.current = [];
          pos.current = { ...CENTER };
          poss.current = ev.team === 'home' ? 'away' : 'home'; // saída de quem sofreu o gol
          pickTarget();
        };
      } else if (ev.type === 'save') {
        setRibbon({ team: ev.team, text: '🧤 Defesa do goleiro' });
        holdUntil.current = now + 1200;
        afterHold.current = () => {
          poss.current = ev.team;
          pickTarget();
        };
      } else {
        setRibbon({ team: ev.team, text: 'Na trave!' });
        holdUntil.current = now + 1200;
      }
    };

    const draw = () => {
      ballRef.current?.setAttribute('transform', `translate(${pos.current.x} ${pos.current.y})`);
      const pts = [...trail.current, pos.current].map((p) => `${p.x},${p.y}`).join(' ');
      trailRef.current?.setAttribute('points', pts);
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        if (mode.current === 'hold') {
          if (now >= holdUntil.current) {
            const fn = afterHold.current;
            afterHold.current = null;
            if (fn) fn();
            else pickTarget();
          }
        } else {
          const v = mode.current === 'dash' ? DASH_SPEED : WANDER_SPEED;
          const dx = target.current.x - pos.current.x;
          const dy = target.current.y - pos.current.y;
          const dist = Math.hypot(dx, dy);
          const stepLen = v * dt;
          if (dist <= stepLen) {
            pos.current = { ...target.current };
            if (mode.current === 'dash') resolveEvent(now);
            else {
              mode.current = 'hold';
              holdUntil.current = now + rand(120, 450);
            }
          } else {
            pos.current.x += (dx / dist) * stepLen;
            pos.current.y += (dy / dist) * stepLen;
          }
        }
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pushTrail, setRibbon]);

  // ── Reação a eventos reais da partida ──
  // seenId começa no id atual para não "replayar" eventos antigos ao montar
  // (ex.: remontagem no início do 2º tempo).
  const seenId = useRef(lastEvent?.id ?? 0);
  useEffect(() => {
    if (!lastEvent || lastEvent.id === seenId.current) return;
    seenId.current = lastEvent.id;
    const { ev } = lastEvent;
    const now = performance.now();

    if (ev.type === 'goal' || ev.type === 'save' || ev.type === 'post') {
      // Em defesas, quem ataca é o adversário do goleiro que defendeu
      const attacker: Side = ev.type === 'save' ? (ev.team === 'home' ? 'away' : 'home') : ev.team;
      poss.current = attacker;
      pushTrail();
      target.current = { x: attacker === 'home' ? 100.5 : 4.5, y: CENTER.y + rand(-4, 4) };
      pendingEv.current = ev;
      afterHold.current = null;
      mode.current = 'dash';
    } else if (ev.type === 'yellow' || ev.type === 'red') {
      setRibbon({ team: ev.team, text: ev.type === 'yellow' ? '🟨 Cartão amarelo' : '🟥 Expulsão!' });
      pendingEv.current = null;
      afterHold.current = null;
      mode.current = 'hold';
      holdUntil.current = now + 1300;
    } else if (ev.type === 'sub') {
      setRibbon({ team: ev.team, text: '🔄 Substituição' });
      pendingEv.current = null;
      afterHold.current = null;
      mode.current = 'hold';
      holdUntil.current = now + 1300;
    }
  }, [lastEvent, pushTrail, setRibbon]);

  const ribbonName = status.team === 'home' ? homeName : status.team === 'away' ? awayName : '';

  return (
    <div
      className="relative w-full cursor-pointer select-none overflow-hidden border-b border-[var(--border)]"
      style={{
        aspectRatio: '16 / 10',
        background:
          'radial-gradient(120% 90% at 50% 0%, #1c2b1e 0%, #0d130e 55%, #070a08 100%)',
      }}
      onClick={onTogglePause}
      title="Clique para pausar/retomar"
    >
      {/* Plano do gramado com perspectiva */}
      <div className="absolute inset-0" style={{ perspective: '750px' }}>
        <div
          className="absolute inset-0"
          style={{ transform: 'rotateX(30deg) scale(1.32)', transformOrigin: '50% 58%' }}
        >
          <svg viewBox="-9 -7 123 82" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* Listras do gramado */}
            {Array.from({ length: 12 }, (_, i) => (
              <rect
                key={i}
                x={-9 + i * 10.5}
                y={-7}
                width={10.5}
                height={82}
                fill={i % 2 === 0 ? '#3c9b50' : '#349046'}
              />
            ))}

            {/* Linhas do campo */}
            <g fill="none" stroke="#f5f5f5" strokeWidth={0.6} opacity={0.9}>
              <rect x={0} y={0} width={W} height={H} />
              <line x1={52.5} y1={0} x2={52.5} y2={68} />
              <circle cx={52.5} cy={34} r={9.15} />
              <rect x={0} y={13.85} width={16.5} height={40.3} />
              <rect x={88.5} y={13.85} width={16.5} height={40.3} />
              <rect x={0} y={24.85} width={5.5} height={18.3} />
              <rect x={99.5} y={24.85} width={5.5} height={18.3} />
              <path d="M 16.5 26.7 A 9.15 9.15 0 0 1 16.5 41.3" />
              <path d="M 88.5 26.7 A 9.15 9.15 0 0 0 88.5 41.3" />
              <path d="M 0 2 A 2 2 0 0 0 2 0" />
              <path d="M 103 0 A 2 2 0 0 0 105 2" />
              <path d="M 105 66 A 2 2 0 0 0 103 68" />
              <path d="M 2 68 A 2 2 0 0 0 0 66" />
            </g>
            <circle cx={52.5} cy={34} r={0.7} fill="#f5f5f5" />
            <circle cx={11} cy={34} r={0.7} fill="#f5f5f5" />
            <circle cx={94} cy={34} r={0.7} fill="#f5f5f5" />

            {/* Gols */}
            <g stroke="#fff" strokeWidth={0.5} opacity={0.8} fill="rgba(255,255,255,0.25)">
              <rect x={-2.6} y={30.3} width={2.6} height={7.4} />
              <rect x={105} y={30.3} width={2.6} height={7.4} />
            </g>

            {/* Bandeirinhas de escanteio */}
            {(
              [
                [0, 0],
                [105, 0],
                [0, 68],
                [105, 68],
              ] as const
            ).map(([cx, cy]) => (
              <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
                <line x1={0} y1={0} x2={0} y2={-3} stroke="#f5f5f5" strokeWidth={0.4} />
                <polygon points="0,-3 2.2,-2.4 0,-1.8" fill="#e53935" />
              </g>
            ))}

            {/* Rastro da bola */}
            <polyline
              ref={trailRef}
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={0.9}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Bola */}
            <g ref={ballRef} transform={`translate(${CENTER.x} ${CENTER.y})`}>
              <ellipse cy={1.6} rx={1.9} ry={0.8} fill="rgba(0,0,0,0.3)" />
              <text fontSize={5.2} textAnchor="middle" dominantBaseline="central" y={-0.4}>
                ⚽
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Flash de gol */}
      {status.goal && <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/10" />}

      {/* Indicador de pausa */}
      {paused && (
        <div className="absolute left-3 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold text-[var(--yellow)]">
          ⏸ Pausado
        </div>
      )}

      {/* Faixa de status (estilo broadcast) */}
      <div
        className="pointer-events-none absolute bottom-0 right-0 bg-[#08120a]/90 py-2 pl-10 pr-3"
        style={{ clipPath: 'polygon(22px 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div
              className={`font-condensed text-lg font-black leading-tight ${
                status.goal ? 'text-[var(--green-light)]' : 'text-white'
              }`}
            >
              {ribbonName}
            </div>
            <div className="text-sm leading-tight text-[var(--text2)]">{status.text}</div>
          </div>
          <div
            className={`h-9 w-1.5 rounded-sm ${
              status.goal ? 'bg-[var(--green-light)]' : 'bg-[var(--red)]'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
