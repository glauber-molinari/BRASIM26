'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AD_BOARDS } from '@/data/adBoards';
import type { MatchEvent } from '@/lib/types';

// Campo em unidades SVG (105 x 68 — proporções FIFA)
const W = 105;
const H = 68;
const CENTER = { x: W / 2, y: H / 2 };

const DASH_SPEED = 90; // unidades/s — arrancada para o gol
const RETURN_SPEED = 38; // unidades/s — bola voltando ao centro após gol
const CLEAR_SPEED = 55; // unidades/s — reposição do goleiro
const MAX_TRAIL = 9;
const BALL_R = 1.25;

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

// O motor processa uma fila de ações: deslocamentos, pausas, letreiros e
// efeitos. Eventos reais da partida substituem a fila por uma sequência
// coreografada (gol → comemoração → saída de bola no centro, etc.).
// Ações "essential" pertencem à coreografia de um evento real e nunca são
// descartadas; as demais são jogo corrido e podem ser interrompidas.
//
// Deslocamentos têm easing (passes "morrem" como na bola real) e curva
// opcional (arc = curvatura perpendicular, para cruzamentos e lançamentos).
type EaseKind = 'out' | 'in' | 'linear';

type Action = (
  | { kind: 'move'; x: number; y: number; v: number; arc?: number; ease?: EaseKind; clearTrail?: boolean }
  | { kind: 'hold'; ms: number }
  | { kind: 'ribbon'; status: RibbonStatus }
  | { kind: 'do'; fn: () => void }
) & { essential?: boolean };

interface MoveState {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  cx: number;
  cy: number;
  dur: number; // segundos
  t: number;   // progresso 0..1
  ease: EaseKind;
}

const EASE: Record<EaseKind, (t: number) => number> = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
};

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
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Narração do jogo corrido, por zona do campo
const TXT_BUILD = ['Troca de passes', 'Saída de bola trabalhada', 'Posse no campo de defesa'] as const;
const TXT_MID = ['Construção de jogada', 'Domínio do meio-campo', 'Circulação de bola'] as const;
const TXT_DANGER = ['Ataque perigoso', 'Pressão no ataque', 'Jogada pelo lado do campo'] as const;

// Espaços para as placas de publicidade no perímetro do campo: faixa no lado
// de fundo (topo) e atrás dos dois gols. Os anúncios vêm de data/adBoards.ts.
interface AdSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
}

const AD_SLOTS: AdSlot[] = (() => {
  const slots: AdSlot[] = [];
  const TOP_N = 6;
  const tw = 123 / TOP_N;
  for (let i = 0; i < TOP_N; i++) slots.push({ x: -9 + i * tw, y: -7, w: tw, h: 4 });
  const SIDE_N = 4;
  const sh = H / SIDE_N;
  for (let i = 0; i < SIDE_N; i++) slots.push({ x: -9, y: i * sh, w: 3.5, h: sh, rot: -90 });
  for (let i = 0; i < SIDE_N; i++) slots.push({ x: 110.5, y: i * sh, w: 3.5, h: sh, rot: 90 });
  return slots;
})();

export default function MatchPitch({
  homeName,
  awayName,
  hPoss,
  paused,
  lastEvent,
  onTogglePause,
}: MatchPitchProps) {
  const ballRef = useRef<SVGGElement>(null);
  const ballSpinRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);

  // Estado do "motor" da bola — refs para não re-renderizar a cada frame
  const pos = useRef({ ...CENTER });
  const rot = useRef(0);
  const trail = useRef<{ x: number; y: number }[]>([]);
  const lastTrailAt = useRef(0);
  const poss = useRef<Side>('home');
  const queue = useRef<Action[]>([
    { kind: 'ribbon', status: { team: 'home', text: 'Saída de bola' } },
    { kind: 'hold', ms: 700 },
  ]);
  const activeMove = useRef<MoveState | null>(null);
  const holdUntil = useRef<number | null>(null);
  const activeIsEssential = useRef(false);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hPossRef = useRef(hPoss);
  hPossRef.current = hPoss;

  const [status, setStatus] = useState<RibbonStatus>({ team: 'home', text: 'Saída de bola' });
  const statusKey = useRef('home|Saída de bola|0');

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

    // Jogo corrido entre eventos: o time com posse troca passes curtos em
    // direção ao campo adversário (com recuos ocasionais), e de vez em quando
    // solta um lançamento longo em curva — como nos trackers de SofaScore/FotMob.
    const enqueueWanderLeg = () => {
      const keep = poss.current === 'home' ? hPossRef.current : 100 - hPossRef.current;
      if (rand(0, 100) > keep) poss.current = poss.current === 'home' ? 'away' : 'home';
      const dir = poss.current === 'home' ? 1 : -1;

      if (Math.random() < 0.16) {
        // Lançamento longo
        const tx = clamp(pos.current.x + dir * rand(28, 45), 8, 97);
        const ty = rand(10, 58);
        queue.current.push(
          { kind: 'ribbon', status: { team: poss.current, text: 'Lançamento longo' } },
          { kind: 'move', x: tx, y: ty, v: rand(48, 62), ease: 'out', arc: rand(5, 10) * (Math.random() < 0.5 ? -1 : 1) },
          { kind: 'hold', ms: rand(160, 420) },
        );
        return;
      }

      // Troca de passes: 2–4 toques curtos
      const hops = 2 + Math.floor(Math.random() * 3);
      const acts: Action[] = [];
      let px = pos.current.x;
      let py = pos.current.y;
      for (let i = 0; i < hops; i++) {
        const back = Math.random() < 0.22 ? -1 : 1; // recuo ocasional
        px = clamp(px + dir * back * rand(4, 14), 7, 98);
        py = clamp(py + rand(-12, 12), 7, 61);
        acts.push(
          { kind: 'move', x: px, y: py, v: rand(26, 42), ease: 'out' },
          { kind: 'hold', ms: rand(90, 260) },
        );
      }
      const advance = poss.current === 'home' ? px : W - px;
      const text = advance > 76 ? pick(TXT_DANGER) : advance > 42 ? pick(TXT_MID) : pick(TXT_BUILD);
      queue.current.push({ kind: 'ribbon', status: { team: poss.current, text } }, ...acts);
    };

    const draw = () => {
      ballRef.current?.setAttribute('transform', `translate(${pos.current.x} ${pos.current.y})`);
      ballSpinRef.current?.setAttribute('transform', `rotate(${rot.current})`);
      const pts = [...trail.current, pos.current].map((p) => `${p.x},${p.y}`).join(' ');
      trailRef.current?.setAttribute('points', pts);
    };

    const startMove = (next: Extract<Action, { kind: 'move' }>) => {
      if (next.clearTrail) trail.current = [];
      pushTrail();
      const fromX = pos.current.x;
      const fromY = pos.current.y;
      const dx = next.x - fromX;
      const dy = next.y - fromY;
      const dist = Math.hypot(dx, dy);
      // Ponto de controle: meio do trajeto deslocado na perpendicular (curva)
      const arc = next.arc ?? 0;
      const nx = dist > 0.01 ? -dy / dist : 0;
      const ny = dist > 0.01 ? dx / dist : 0;
      activeMove.current = {
        fromX,
        fromY,
        toX: next.x,
        toY: next.y,
        cx: (fromX + next.x) / 2 + nx * arc,
        cy: (fromY + next.y) / 2 + ny * arc,
        dur: Math.max(0.1, dist / next.v),
        t: 0,
        ease: next.ease ?? 'out',
      };
      activeIsEssential.current = !!next.essential;
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        // Consome ações instantâneas até iniciar um deslocamento ou pausa
        while (!activeMove.current && holdUntil.current === null) {
          const next = queue.current.shift();
          if (!next) {
            enqueueWanderLeg();
            continue;
          }
          if (next.kind === 'ribbon') setRibbon(next.status);
          else if (next.kind === 'do') next.fn();
          else if (next.kind === 'hold') {
            holdUntil.current = now + next.ms;
            activeIsEssential.current = !!next.essential;
          } else {
            startMove(next);
          }
        }

        if (holdUntil.current !== null) {
          if (now >= holdUntil.current) holdUntil.current = null;
        } else if (activeMove.current) {
          const mv = activeMove.current;
          mv.t = Math.min(1, mv.t + dt / mv.dur);
          const p = EASE[mv.ease](mv.t);
          const inv = 1 - p;
          const nx = inv * inv * mv.fromX + 2 * inv * p * mv.cx + p * p * mv.toX;
          const ny = inv * inv * mv.fromY + 2 * inv * p * mv.cy + p * p * mv.toY;
          // Rotação proporcional à distância rolada (bola "gira" de verdade)
          const ddist = Math.hypot(nx - pos.current.x, ny - pos.current.y);
          rot.current = (rot.current + ddist * 46 * (nx >= pos.current.x ? 1 : -1)) % 360;
          pos.current = { x: nx, y: ny };
          if (mv.t >= 1) activeMove.current = null;
          // Amostra o rastro durante o trajeto — curvas deixam rastro curvo
          if (now - lastTrailAt.current > 110) {
            lastTrailAt.current = now;
            pushTrail();
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

    // Mantém coreografias pendentes de eventos anteriores e descarta apenas o
    // jogo corrido — assim, dois gols seguidos tocam um após o outro e nenhum
    // perde a volta da bola ao centro.
    const enqueue = (seq: Action[]) => {
      queue.current = queue.current.filter((a) => a.essential);
      if (!activeIsEssential.current) {
        activeMove.current = null;
        holdUntil.current = null;
      }
      queue.current.push(...seq.map((a) => ({ ...a, essential: true })));
    };

    const setPoss = (side: Side): Action => ({ kind: 'do', fn: () => { poss.current = side; } });

    if (ev.type === 'goal') {
      const attacker = ev.team;
      const conceding: Side = attacker === 'home' ? 'away' : 'home';
      const gx = attacker === 'home' ? 102 : 3;
      const kind = ev.goalKind ?? 'normal';
      const seq: Action[] = [setPoss(attacker)];

      if (kind === 'pen') {
        const spotX = attacker === 'home' ? 94 : 11;
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: '⚠️ Pênalti!' } },
          { kind: 'move', x: spotX, y: 34, v: 40, ease: 'out', clearTrail: true },
          { kind: 'hold', ms: 1600 },
          { kind: 'move', x: gx, y: 34 + rand(-2.5, 2.5), v: 95, ease: 'linear' },
        );
      } else if (kind === 'counter') {
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: '⚡ Contra-ataque!' } },
          { kind: 'move', x: attacker === 'home' ? rand(18, 30) : rand(75, 87), y: rand(20, 48), v: 55, ease: 'out', clearTrail: true },
          { kind: 'move', x: attacker === 'home' ? 88 : 17, y: rand(22, 46), v: 72, ease: 'linear', arc: rand(-6, 6) },
          { kind: 'move', x: gx, y: CENTER.y + rand(-3, 3), v: DASH_SPEED, ease: 'in' },
        );
      } else if (kind === 'freekick') {
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: 'Falta perigosa…' } },
          { kind: 'move', x: attacker === 'home' ? rand(78, 84) : rand(21, 27), y: rand(22, 46), v: 38, ease: 'out' },
          { kind: 'hold', ms: 1200 },
          { kind: 'move', x: gx, y: 34 + rand(-2.8, 2.8), v: 72, ease: 'linear', arc: rand(4, 8) * (Math.random() < 0.5 ? -1 : 1) },
        );
      } else if (kind === 'header') {
        const flankY = Math.random() < 0.5 ? rand(6, 12) : rand(56, 62);
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: 'Cruzamento na área…' } },
          { kind: 'move', x: attacker === 'home' ? rand(88, 96) : rand(9, 17), y: flankY, v: 42, ease: 'out' },
          { kind: 'move', x: attacker === 'home' ? 97 : 8, y: 34 + rand(-3, 3), v: 60, ease: 'out', arc: (flankY < 34 ? 1 : -1) * rand(5, 9) },
          { kind: 'move', x: gx, y: 34 + rand(-2.5, 2.5), v: 85, ease: 'linear' },
        );
      } else if (kind === 'longshot') {
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: 'Arrisca de longe!' } },
          { kind: 'move', x: attacker === 'home' ? rand(72, 78) : rand(27, 33), y: rand(26, 42), v: 36, ease: 'out' },
          { kind: 'hold', ms: 300 },
          { kind: 'move', x: gx, y: 34 + rand(-3, 3), v: 92, ease: 'linear', arc: rand(-4, 4) },
        );
      } else {
        seq.push(
          { kind: 'move', x: attacker === 'home' ? rand(76, 84) : rand(21, 29), y: rand(18, 50), v: 44, ease: 'out' },
          { kind: 'move', x: gx, y: CENTER.y + rand(-3, 3), v: DASH_SPEED, ease: 'in' },
        );
      }

      seq.push(
        { kind: 'ribbon', status: { team: attacker, text: '⚽ GOOOL!', goal: true } },
        { kind: 'hold', ms: 1500 },
        // Como na vida real: a bola volta ao centro para o reinício
        { kind: 'ribbon', status: { team: conceding, text: 'Saída de bola' } },
        { kind: 'move', x: CENTER.x, y: CENTER.y, v: RETURN_SPEED, ease: 'out', clearTrail: true },
        { kind: 'hold', ms: 550 },
        setPoss(conceding),
      );
      enqueue(seq);
    } else if (ev.type === 'save') {
      const saving = ev.team;
      const attacker: Side = saving === 'home' ? 'away' : 'home';
      const gx = saving === 'home' ? 4 : 101;
      const dir = saving === 'home' ? 1 : -1;
      const seq: Action[] = [setPoss(attacker)];
      if (ev.pen) {
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: '⚠️ Pênalti!' } },
          { kind: 'move', x: saving === 'home' ? 11 : 94, y: 34, v: 40, ease: 'out', clearTrail: true },
          { kind: 'hold', ms: 1600 },
          { kind: 'move', x: gx, y: 34 + rand(-3.5, 3.5), v: 95, ease: 'linear' },
          { kind: 'ribbon', status: { team: saving, text: '🧤 DEFENDEU O PÊNALTI!' } },
          { kind: 'hold', ms: 1300 },
        );
      } else {
        seq.push(
          { kind: 'move', x: saving === 'home' ? rand(20, 28) : rand(77, 85), y: rand(18, 50), v: 46, ease: 'out' },
          { kind: 'move', x: gx, y: CENTER.y + rand(-4, 4), v: DASH_SPEED, ease: 'in' },
          { kind: 'ribbon', status: { team: saving, text: '🧤 Defesa do goleiro' } },
          { kind: 'hold', ms: 900 },
        );
      }
      seq.push(
        // Goleiro segura e repõe com um chutão
        setPoss(saving),
        { kind: 'ribbon', status: { team: saving, text: 'Reposição do goleiro' } },
        {
          kind: 'move',
          x: clamp(gx + dir * rand(28, 45), 10, 95),
          y: rand(14, 54),
          v: CLEAR_SPEED,
          ease: 'out',
          arc: rand(5, 11) * (Math.random() < 0.5 ? -1 : 1),
          clearTrail: true,
        },
        { kind: 'hold', ms: 250 },
      );
      enqueue(seq);
    } else if (ev.type === 'post') {
      const attacker = ev.team;
      const gx = attacker === 'home' ? 102 : 3;
      const dirBack = attacker === 'home' ? -1 : 1;
      enqueue([
        setPoss(attacker),
        { kind: 'move', x: attacker === 'home' ? rand(76, 84) : rand(21, 29), y: rand(20, 48), v: 44, ease: 'out' },
        { kind: 'move', x: gx, y: CENTER.y + rand(-3, 3), v: DASH_SPEED, ease: 'in' },
        { kind: 'ribbon', status: { team: attacker, text: 'Na trave!' } },
        // Rebote para fora da área
        { kind: 'move', x: gx + dirBack * rand(8, 14), y: clamp(CENTER.y + rand(-8, 8), 8, 60), v: 50, ease: 'out' },
        { kind: 'hold', ms: 600 },
        { kind: 'do', fn: () => { poss.current = Math.random() < 0.5 ? 'home' : 'away'; } },
      ]);
    } else if (ev.type === 'miss') {
      const attacker = ev.team;
      const defending: Side = attacker === 'home' ? 'away' : 'home';
      const gx = attacker === 'home' ? 106 : -1;
      const offY = Math.random() < 0.5 ? rand(22, 27.5) : rand(40.5, 46);
      const gkX = attacker === 'home' ? 99.5 : 5.5;
      const dir = attacker === 'home' ? -1 : 1;
      const seq: Action[] = [setPoss(attacker)];
      if (ev.pen) {
        seq.push(
          { kind: 'ribbon', status: { team: attacker, text: '⚠️ Pênalti!' } },
          { kind: 'move', x: attacker === 'home' ? 94 : 11, y: 34, v: 40, ease: 'out', clearTrail: true },
          { kind: 'hold', ms: 1600 },
          { kind: 'move', x: gx, y: offY, v: 92, ease: 'linear' },
          { kind: 'ribbon', status: { team: attacker, text: '❌ Pênalti pra fora!' } },
          { kind: 'hold', ms: 1200 },
        );
      } else {
        seq.push(
          { kind: 'move', x: attacker === 'home' ? rand(76, 84) : rand(21, 29), y: rand(20, 48), v: 44, ease: 'out' },
          { kind: 'move', x: gx, y: offY, v: 88, ease: 'linear' },
          { kind: 'ribbon', status: { team: attacker, text: '💨 Pra fora! Que chance!' } },
          { kind: 'hold', ms: 900 },
        );
      }
      seq.push(
        { kind: 'ribbon', status: { team: defending, text: 'Tiro de meta' } },
        { kind: 'move', x: gkX, y: 34, v: 45, ease: 'out', clearTrail: true },
        { kind: 'hold', ms: 400 },
        setPoss(defending),
        {
          kind: 'move',
          x: clamp(gkX + dir * -rand(30, 48), 10, 95),
          y: rand(14, 54),
          v: CLEAR_SPEED,
          ease: 'out',
          arc: rand(6, 12) * (Math.random() < 0.5 ? -1 : 1),
        },
      );
      enqueue(seq);
    } else if (ev.type === 'corner') {
      const attacker = ev.team;
      const cornerX = attacker === 'home' ? 104.5 : 0.5;
      const cornerY = Math.random() < 0.5 ? 0.6 : 67.4;
      enqueue([
        setPoss(attacker),
        { kind: 'ribbon', status: { team: attacker, text: '🚩 Escanteio' } },
        { kind: 'move', x: cornerX, y: cornerY, v: 46, ease: 'out', clearTrail: true },
        { kind: 'hold', ms: 850 },
        { kind: 'ribbon', status: { team: attacker, text: 'Cruzamento na área…' } },
        {
          kind: 'move',
          x: attacker === 'home' ? rand(92, 98) : rand(7, 13),
          y: rand(29, 39),
          v: 58,
          ease: 'out',
          arc: (cornerY < 34 ? 1 : -1) * rand(6, 10),
        },
        { kind: 'hold', ms: 250 },
      ]);
    } else if (ev.type === 'var') {
      const attacker = ev.team;
      const conceding: Side = attacker === 'home' ? 'away' : 'home';
      const gx = attacker === 'home' ? 102 : 3;
      enqueue([
        setPoss(attacker),
        { kind: 'move', x: attacker === 'home' ? rand(78, 86) : rand(19, 27), y: rand(20, 48), v: 46, ease: 'out' },
        { kind: 'move', x: gx, y: CENTER.y + rand(-3, 3), v: DASH_SPEED, ease: 'in' },
        { kind: 'ribbon', status: { team: attacker, text: '⚽ GOOOL!', goal: true } },
        { kind: 'hold', ms: 1100 },
        { kind: 'ribbon', status: { team: attacker, text: '📺 VAR analisando…' } },
        { kind: 'hold', ms: 1800 },
        { kind: 'ribbon', status: { team: attacker, text: '❌ Gol anulado!' } },
        { kind: 'hold', ms: 1100 },
        { kind: 'move', x: attacker === 'home' ? 80 : 25, y: rand(24, 44), v: 35, ease: 'out', clearTrail: true },
        setPoss(conceding),
      ]);
    } else if (ev.type === 'yellow' || ev.type === 'red') {
      enqueue([
        {
          kind: 'ribbon',
          status: {
            team: ev.team,
            text: ev.type === 'yellow' ? '🟨 Cartão amarelo' : ev.secondYellow ? '🟥 Expulso! (2º amarelo)' : '🟥 Expulsão!',
          },
        },
        { kind: 'hold', ms: 1300 },
      ]);
    } else if (ev.type === 'sub') {
      enqueue([
        { kind: 'ribbon', status: { team: ev.team, text: '🔄 Substituição' } },
        { kind: 'hold', ms: 1300 },
      ]);
    }
  }, [lastEvent]);

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
            <defs>
              <clipPath id="ballClip">
                <circle r={BALL_R} />
              </clipPath>
            </defs>

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

            {/* Placas de publicidade (edite os textos em data/adBoards.ts) */}
            {AD_SLOTS.map((s, i) => {
              const ad = AD_BOARDS[i % AD_BOARDS.length];
              const cx = s.x + s.w / 2;
              const cy = s.y + s.h / 2;
              const len = s.rot ? s.h : s.w;
              const fs = Math.max(
                1.1,
                Math.min(2.7, (len - 3.5) / (Math.max(ad.text.length, 1) * 0.58)),
              );
              return (
                <g key={`ad-${i}`}>
                  <rect
                    x={s.x + 0.4}
                    y={s.y + 0.4}
                    width={s.w - 0.8}
                    height={s.h - 0.8}
                    rx={0.5}
                    fill={ad.bg ?? '#0a1812'}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={0.15}
                  />
                  <text
                    x={cx}
                    y={cy}
                    transform={s.rot ? `rotate(${s.rot} ${cx} ${cy})` : undefined}
                    fontSize={fs}
                    fontWeight={700}
                    fill={ad.color ?? '#e9f4ec'}
                    textAnchor="middle"
                    dominantBaseline="central"
                    letterSpacing={0.15}
                  >
                    {ad.text}
                  </text>
                </g>
              );
            })}

            {/* Rastro da bola */}
            <polyline
              ref={trailRef}
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={0.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Bola vetorial (gira conforme rola) */}
            <g ref={ballRef} transform={`translate(${CENTER.x} ${CENTER.y})`}>
              <ellipse cy={1.55} rx={1.6} ry={0.65} fill="rgba(0,0,0,0.35)" />
              <g ref={ballSpinRef}>
                <circle r={BALL_R} fill="#fdfdfd" stroke="#b5b5b5" strokeWidth={0.07} />
                <g clipPath="url(#ballClip)" fill="#1d1d1d">
                  <polygon points="0,-0.52 0.5,-0.16 0.31,0.43 -0.31,0.43 -0.5,-0.16" />
                  <polygon points="1.02,-0.72 1.5,-0.42 1.42,0.18 0.95,0.14" />
                  <polygon points="-1.02,-0.72 -1.5,-0.42 -1.42,0.18 -0.95,0.14" />
                  <polygon points="0,1.08 0.5,1.38 -0.5,1.38" />
                  <polygon points="0,-1.36 0.42,-1.16 -0.42,-1.16" />
                </g>
              </g>
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
