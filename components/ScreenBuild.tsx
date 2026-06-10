'use client';

import { useEffect, useState } from 'react';
import { TEAMS } from '@/data/teams';
import { TACTIC_KEYS } from '@/data/tactics';
import type { GameStyle, LineupSlot, Position, SelectedPlayer, TacticKey } from '@/lib/types';
import PitchBuilder from './PitchBuilder';
import SlotPicker from './SlotPicker';
import TeamLogo from './TeamLogo';
import TeamOverall from './TeamOverall';

interface ScreenBuildProps {
  lineup: LineupSlot[];
  tactic: TacticKey;
  teamUsage: Record<number, number>;
  onTacticChange: (t: TacticKey) => void;
  onLineupChange: (lineup: LineupSlot[], usage: Record<number, number>) => void;
  onStart: () => void;
  onRollRandom: () => void;
  diceSpinning: boolean;
  activeTeamTab?: number;
  bench: (SelectedPlayer | null)[];
  onBenchChange: (bench: (SelectedPlayer | null)[]) => void;
  gameStyle: GameStyle;
  onGameStyleChange: (s: GameStyle) => void;
  isContinuing: boolean;
  currentRound: number;
  onContinueSim: () => void;
}

const GAME_STYLES: { key: GameStyle; label: string; icon: string; desc: string }[] = [
  { key: 'normal',       label: 'Normal',        icon: '⚖️', desc: 'Jogo equilibrado' },
  { key: 'contraAtaque', label: 'Contra-ataque',  icon: '⚡', desc: 'Defende e explora os espaços' },
  { key: 'retranca',     label: 'Retranca',       icon: '🛡️', desc: 'Foco total na defesa' },
  { key: 'tikaTaka',     label: 'Tiki-Taka',      icon: '🎯', desc: 'Posse e pressão no ataque' },
];

const POS_LABELS: Record<Position, string> = {
  GK: 'Goleiros',
  DF: 'Defensores',
  MF: 'Meio-campistas',
  FW: 'Atacantes',
};

export default function ScreenBuild({
  lineup,
  tactic,
  teamUsage,
  onTacticChange,
  onLineupChange,
  onStart,
  onRollRandom,
  diceSpinning,
  activeTeamTab = 0,
  bench,
  onBenchChange,
  gameStyle,
  onGameStyleChange,
  isContinuing,
  currentRound,
  onContinueSim,
}: ScreenBuildProps) {
  const [activeTab, setActiveTab] = useState(activeTeamTab);
  const [benchPickerIdx, setBenchPickerIdx] = useState<number | null>(null);

  useEffect(() => {
    setActiveTab(activeTeamTab);
  }, [activeTeamTab]);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  const sortedTeams = [...TEAMS.map((t, i) => ({ t, i }))].sort((a, b) =>
    a.t.name.localeCompare(b.t.name, 'pt-BR')
  );

  const count = lineup.filter((s) => s.player).length;
  const team = TEAMS[activeTab];

  // Combined usage: starters + bench count toward 3-per-team limit
  const combinedUsage: Record<number, number> = { ...teamUsage };
  bench.forEach((p) => {
    if (p) combinedUsage[p.tid] = (combinedUsage[p.tid] || 0) + 1;
  });

  const used = combinedUsage[team.id] || 0;
  const full = used >= 3;

  const byPos: Record<Position, typeof team.squad> = { GK: [], DF: [], MF: [], FW: [] };
  team.squad.forEach((p) => byPos[p.p].push(p));

  const photoFor = (tid: number, name: string) =>
    TEAMS.find((x) => x.id === tid)?.squad.find((p) => p.n === name)?.photo;

  const togglePlayer = (tid: number, name: string, pos: Position) => {
    const existIdx = lineup.findIndex(
      (s) => s.player?.n === name && s.player?.tid === tid
    );
    const usage = { ...teamUsage };

    if (existIdx >= 0) {
      usage[tid] = Math.max(0, (usage[tid] || 0) - 1);
      const newLineup = lineup.map((s, i) =>
        i === existIdx ? { ...s, player: null } : s
      );
      onLineupChange(newLineup, usage);
      return;
    }

    const emptyIdx = lineup.findIndex((s) => !s.player && s.pos === pos);
    if (emptyIdx >= 0 && combinedUsage[tid] < 3) {
      const t = TEAMS.find((x) => x.id === tid)!;
      const newLineup = lineup.map((s, i) =>
        i === emptyIdx
          ? {
              ...s,
              player: {
                n: name,
                p: pos,
                photo: photoFor(tid, name),
                tid,
                tc: t.c,
                tl: t.logo,
                tn: t.name,
                ts: t.short,
              },
            }
          : s
      );
      usage[tid] = (usage[tid] || 0) + 1;
      onLineupChange(newLineup, usage);
    }
  };

  const pickPlayer = (tid: number, name: string, pos: Position) => {
    if (pickerIdx === null) return;

    // No modo de continuação do campeonato, troca jogadores entre os já escalados
    if (isContinuing) {
      const fromLineupIdx = lineup.findIndex(
        (s) => s.player?.n === name && s.player?.tid === tid
      );
      const fromBenchIdx = bench.findIndex(
        (p) => p?.n === name && p?.tid === tid
      );
      const currentPlayer = lineup[pickerIdx].player;

      if (fromLineupIdx >= 0 && fromLineupIdx !== pickerIdx) {
        // Troca dois slots do lineup entre si
        const newLineup = lineup.map((s, i) => {
          if (i === pickerIdx) return { ...s, player: lineup[fromLineupIdx].player };
          if (i === fromLineupIdx) return { ...s, player: currentPlayer };
          return s;
        });
        onLineupChange(newLineup, teamUsage);
      } else if (fromBenchIdx >= 0) {
        // Troca slot do lineup com reserva
        const benchPlayer = bench[fromBenchIdx];
        const newLineup = lineup.map((s, i) =>
          i === pickerIdx ? { ...s, player: benchPlayer } : s
        );
        const newBench = bench.map((p, i) =>
          i === fromBenchIdx ? currentPlayer : p
        );
        onLineupChange(newLineup, teamUsage);
        onBenchChange(newBench);
      }

      setPickerIdx(null);
      return;
    }

    // Modo normal: seleciona qualquer jogador dos times
    const usage = { ...teamUsage };
    const slot = lineup[pickerIdx];
    if (slot.player) {
      usage[slot.player.tid] = Math.max(0, (usage[slot.player.tid] || 0) - 1);
    }
    const t = TEAMS.find((x) => x.id === tid)!;
    const newLineup = lineup.map((s, i) =>
      i === pickerIdx
        ? {
            ...s,
            player: {
              n: name,
              p: pos,
              photo: photoFor(tid, name),
              tid,
              tc: t.c,
              tl: t.logo,
              tn: t.name,
              ts: t.short,
            },
          }
        : s
    );
    usage[tid] = (usage[tid] || 0) + 1;
    onLineupChange(newLineup, usage);
    setPickerIdx(null);
  };

  const removeSlot = (idx: number) => {
    const usage = { ...teamUsage };
    const slot = lineup[idx];
    if (slot.player) {
      usage[slot.player.tid] = Math.max(0, (usage[slot.player.tid] || 0) - 1);
    }
    const newLineup = lineup.map((s, i) => (i === idx ? { ...s, player: null } : s));
    onLineupChange(newLineup, usage);
    setPickerIdx(null);
  };

  const pickBenchPlayer = (tid: number, name: string, pos: Position) => {
    if (benchPickerIdx === null) return;
    const t = TEAMS.find((x) => x.id === tid)!;
    const newBench = bench.map((p, i) =>
      i === benchPickerIdx
        ? {
            n: name,
            p: pos,
            photo: photoFor(tid, name),
            tid,
            tc: t.c,
            tl: t.logo,
            tn: t.name,
            ts: t.short,
          }
        : p
    );
    onBenchChange(newBench);
    setBenchPickerIdx(null);
  };

  const removeBenchSlot = (idx: number) => {
    const newBench = bench.map((p, i) => (i === idx ? null : p));
    onBenchChange(newBench);
    setBenchPickerIdx(null);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{isContinuing ? 'Alterar Escalação' : 'Monte seu time'}</h2>
          <p className="section-sub">
            {isContinuing
              ? `Campeonato em andamento · Rodada ${currentRound}/38`
              : 'Máx. 3 jogadores por time · 11 titulares + 5 reservas · Escolha a tática'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRollRandom}
            className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[var(--border2)] bg-[var(--card)] text-2xl transition-colors hover:border-[var(--green-light)] ${diceSpinning ? 'dice-spin' : ''}`}
            title="Sortear time aleatório"
          >
            🎲
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onLineupChange(lineup.map((s) => ({ ...s, player: null })), {})}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[var(--border2)] bg-[var(--card)] text-xl transition-colors hover:border-[var(--red)] hover:text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-30"
            title="Limpar escalação"
          >
            🗑️
          </button>
          {isContinuing ? (
            <button type="button" onClick={onContinueSim} disabled={count < 11} className="btn-primary text-sm sm:text-base">
              <span className="hidden sm:inline">Continuar (R.{currentRound}) →</span>
              <span className="sm:hidden">R.{currentRound} →</span>
            </button>
          ) : (
            <button type="button" onClick={onStart} disabled={count < 11 || bench.filter(Boolean).length < 5} className="btn-primary text-sm sm:text-base">
              <span className="hidden sm:inline">Simular Campeonato →</span>
              <span className="sm:hidden">Simular →</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1fr_340px] md:flex-row">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {sortedTeams.map(({ t, i }) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(i)}
                title={t.name}
                className={`team-tab ${i === activeTab ? 'team-tab-active' : 'team-tab-inactive'}`}
              >
                {t.short}
              </button>
            ))}
          </div>

          <div className="panel max-h-[55vh] overflow-y-auto sm:max-h-[520px]">
            <div className="mb-3 flex items-center gap-3 border-b border-[var(--border)] pb-3">
              <TeamLogo logo={team.logo} fallback={team.c} size={40} />
              <span className="flex-1 font-condensed text-lg font-extrabold uppercase text-[var(--text)]">
                {team.name}
              </span>
              <span className={`text-sm font-medium ${full ? 'text-[var(--red)]' : 'text-[var(--text2)]'}`}>
                {used}/3 selecionados
              </span>
            </div>

            {(['GK', 'DF', 'MF', 'FW'] as Position[]).map((pos) => {
              if (!byPos[pos].length) return null;
              return (
                <div key={pos} className="mb-3">
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text2)]">
                    {POS_LABELS[pos]}
                  </div>
                  {byPos[pos].map((p) => {
                    const inLU = lineup.some(
                      (s) => s.player?.n === p.n && s.player?.tid === team.id
                    );
                    const dis = !inLU && full;
                    return (
                      <div
                        key={p.n}
                        role="button"
                        tabIndex={dis ? -1 : 0}
                        onClick={() => !dis && togglePlayer(team.id, p.n, pos)}
                        onKeyDown={(e) =>
                          !dis && e.key === 'Enter' && togglePlayer(team.id, p.n, pos)
                        }
                        className={`player-row ${inLU ? 'player-row-selected' : ''} ${dis ? 'player-row-disabled' : ''}`}
                      >
                        <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg3)]">
                          <span className={`pl-pbadge pos-${pos} text-[9px] font-bold`}>{pos}</span>
                          {p.photo && (
                            <img
                              src={p.photo}
                              alt={p.n}
                              className="absolute inset-0 h-full w-full object-cover object-top"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </div>
                        <span className="flex-1 text-base text-[var(--text)]">{p.n}</span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                            inLU
                              ? 'border-[var(--green-light)] bg-[var(--green-light)] text-white'
                              : 'border-[var(--border2)] text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:sticky md:top-3">
          <TeamOverall lineup={lineup} />

          <div className="panel">
            <div className="panel-title">Tática</div>
            <div className="flex flex-wrap gap-1.5">
              {TACTIC_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onTacticChange(k)}
                  className={`team-tab ${k === tactic ? 'team-tab-active' : 'team-tab-inactive'}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Estilo de Jogo</div>
            <div className="grid grid-cols-2 gap-1.5">
              {GAME_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onGameStyleChange(s.key)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                    gameStyle === s.key
                      ? 'border-[var(--green-light)] bg-[rgba(31,196,94,0.08)]'
                      : 'border-[var(--border2)] bg-[var(--bg3)] hover:border-[var(--border)]'
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span className={`font-condensed text-sm font-bold ${gameStyle === s.key ? 'text-[var(--green-light)]' : 'text-[var(--text)]'}`}>
                    {s.label}
                  </span>
                  <span className="text-[10px] text-[var(--text3)]">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Clique em uma posição para escalar</div>
            <PitchBuilder lineup={lineup} onSlotClick={setPickerIdx} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg3)] px-4 py-3">
            <span className="text-sm text-[var(--text2)]">
              Titulares: <strong className="text-lg text-[var(--green-light)]">{count}</strong>/11
            </span>
            <div className="flex gap-1.5">
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border-2 ${
                    i < count
                      ? 'border-[var(--green-light)] bg-[var(--green-light)]'
                      : 'border-[var(--border2)] bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title mb-2">Banco de Reservas</div>
            {bench.map((p, i) => (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => setBenchPickerIdx(i)}
                onKeyDown={(e) => e.key === 'Enter' && setBenchPickerIdx(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.04] ${!p ? 'opacity-50' : ''}`}
              >
                <span className="font-condensed w-5 text-center text-xs font-bold text-[var(--text3)]">
                  R{i + 1}
                </span>
                {p ? (
                  <>
                    <TeamLogo logo={p.tl} fallback={p.tc} size={20} />
                    <span className="flex-1 text-[var(--text)]">{p.n}</span>
                    <span className={`pl-pbadge pos-${p.p} text-[9px]`}>{p.p}</span>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-[var(--text3)]">— Clique para escalar</span>
                )}
              </div>
            ))}
          </div>

          <div className="panel max-h-[180px] overflow-y-auto">
            {lineup
              .filter((s) => s.player)
              .map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--text)] hover:bg-white/[0.04]"
                >
                  <TeamLogo logo={s.player!.tl} fallback={s.player!.tc} size={20} />
                  <span className="flex-1 font-medium">{s.player!.n}</span>
                  <span className={`pl-pbadge pos-${s.pos}`}>{s.pos}</span>
                </div>
              ))}
            {count === 0 && (
              <div className="py-2 text-sm text-[var(--text2)]">Nenhum jogador escalado</div>
            )}
          </div>
        </div>
      </div>

      {pickerIdx !== null && (
        <SlotPicker
          slotIdx={pickerIdx}
          lineup={lineup}
          teamUsage={combinedUsage}
          swapMode={isContinuing}
          bench={isContinuing ? bench : undefined}
          onPick={pickPlayer}
          onRemove={removeSlot}
          onClose={() => setPickerIdx(null)}
        />
      )}

      {benchPickerIdx !== null && (
        <SlotPicker
          slotIdx={-1}
          lineup={lineup}
          teamUsage={combinedUsage}
          benchMode
          onPick={pickBenchPlayer}
          onRemove={() => removeBenchSlot(benchPickerIdx)}
          onClose={() => setBenchPickerIdx(null)}
        />
      )}
    </>
  );
}
