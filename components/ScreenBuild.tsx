'use client';

import { useEffect, useState } from 'react';
import { TEAMS } from '@/data/teams';
import { TACTIC_KEYS } from '@/data/tactics';
import type { LineupSlot, Position, TacticKey } from '@/lib/types';
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
}

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
}: ScreenBuildProps) {
  const [activeTab, setActiveTab] = useState(activeTeamTab);

  useEffect(() => {
    setActiveTab(activeTeamTab);
  }, [activeTeamTab]);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  const count = lineup.filter((s) => s.player).length;
  const team = TEAMS[activeTab];
  const used = teamUsage[team.id] || 0;
  const full = used >= 3;

  const byPos: Record<Position, typeof team.squad> = { GK: [], DF: [], MF: [], FW: [] };
  team.squad.forEach((p) => byPos[p.p].push(p));

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
    if (emptyIdx >= 0 && (usage[tid] || 0) < 3) {
      const t = TEAMS.find((x) => x.id === tid)!;
      const newLineup = lineup.map((s, i) =>
        i === emptyIdx
          ? {
              ...s,
              player: { n: name, p: pos, tid, tc: t.c, tl: t.logo, tn: t.name, ts: t.short },
            }
          : s
      );
      usage[tid] = (usage[tid] || 0) + 1;
      onLineupChange(newLineup, usage);
    }
  };

  const pickPlayer = (tid: number, name: string, pos: Position) => {
    if (pickerIdx === null) return;
    const usage = { ...teamUsage };
    const slot = lineup[pickerIdx];
    if (slot.player) {
      usage[slot.player.tid] = Math.max(0, (usage[slot.player.tid] || 0) - 1);
    }
    const t = TEAMS.find((x) => x.id === tid)!;
    const newLineup = lineup.map((s, i) =>
      i === pickerIdx
        ? { ...s, player: { n: name, p: pos, tid, tc: t.c, tl: t.logo, tn: t.name, ts: t.short } }
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Monte seu time</h2>
          <p className="section-sub">
            Máx. 3 jogadores por time · Complete 11 titulares · Escolha a tática
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
          <button type="button" onClick={onStart} disabled={count < 11} className="btn-primary">
            Simular Campeonato →
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TEAMS.map((t, i) => (
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

          <div className="panel max-h-[520px] overflow-y-auto">
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
                        <span className={`pl-pbadge pos-${pos}`}>{pos}</span>
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

        <div className="sticky top-3 flex flex-col gap-3">
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

          <div className="panel max-h-[220px] overflow-y-auto">
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
          teamUsage={teamUsage}
          onPick={pickPlayer}
          onRemove={removeSlot}
          onClose={() => setPickerIdx(null)}
        />
      )}
    </>
  );
}
