'use client';

import { useEffect, useState } from 'react';
import { TEAMS } from '@/data/teams';
import { TACTIC_KEYS } from '@/data/tactics';
import type { GameStyle, LineupSlot, Position, SelectedPlayer, SimSpeed, TacticKey } from '@/lib/types';
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
  speed: SimSpeed;
  onSpeedChange: (s: SimSpeed) => void;
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

const FIRST_ALPHA_IDX = [...TEAMS.map((t, i) => ({ t, i }))]
  .sort((a, b) => a.t.name.localeCompare(b.t.name, 'pt-BR'))[0].i;

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
  speed,
  onSpeedChange,
}: ScreenBuildProps) {
  const [activeTab, setActiveTab] = useState(activeTeamTab === 0 ? FIRST_ALPHA_IDX : activeTeamTab);
  const [benchPickerIdx, setBenchPickerIdx] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');

  useEffect(() => {
    setActiveTab(activeTeamTab === 0 ? FIRST_ALPHA_IDX : activeTeamTab);
    setPlayerSearch('');
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

  // Troca em modo de continuação: banco ↔ titular
  const pickBenchContinuing = (tid: number, name: string) => {
    if (benchPickerIdx === null) return;
    const fromLineupIdx = lineup.findIndex((s) => s.player?.n === name && s.player?.tid === tid);
    const fromBenchIdx = bench.findIndex((p) => p?.n === name && p?.tid === tid);
    const currentBenchPlayer = bench[benchPickerIdx];

    if (fromLineupIdx >= 0) {
      // Titular → banco; reserva atual → posição do titular
      const newBench = bench.map((p, i) => i === benchPickerIdx ? lineup[fromLineupIdx].player : p);
      const newLineup = lineup.map((s, i) => i === fromLineupIdx ? { ...s, player: currentBenchPlayer } : s);
      onBenchChange(newBench);
      onLineupChange(newLineup, teamUsage);
    } else if (fromBenchIdx >= 0 && fromBenchIdx !== benchPickerIdx) {
      // Troca dois slots do banco
      const newBench = bench.map((p, i) => {
        if (i === benchPickerIdx) return bench[fromBenchIdx];
        if (i === fromBenchIdx) return currentBenchPlayer;
        return p;
      });
      onBenchChange(newBench);
    }
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
              : 'Máx. 3 jogadores por time · 11 titulares + 5 reservas'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isContinuing && (
            <button
              type="button"
              onClick={onRollRandom}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[var(--border2)] bg-[var(--card)] text-2xl transition-colors hover:border-[var(--green-light)] ${diceSpinning ? 'dice-spin' : ''}`}
              title="Sortear time aleatório"
            >
              🎲
            </button>
          )}
          {!isContinuing && (
            <button
              type="button"
              disabled={count === 0}
              onClick={() => onLineupChange(lineup.map((s) => ({ ...s, player: null })), {})}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[var(--border2)] bg-[var(--card)] text-xl transition-colors hover:border-[var(--red)] hover:text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-30"
              title="Limpar escalação"
            >
              🗑️
            </button>
          )}
          {isContinuing && (
            <div className="flex items-center gap-2">
              <label className="hidden text-sm text-[var(--text2)] sm:inline">Velocidade</label>
              <select
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value) as SimSpeed)}
                className="h-12 rounded-xl border-2 border-[var(--border2)] bg-[var(--card)] px-3 text-sm text-[var(--text)]"
              >
                <option value={2200}>Normal (~3 min)</option>
                <option value={700}>Rápido</option>
                <option value={120}>Ultra</option>
              </select>
            </div>
          )}
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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(440px,2fr)_minmax(260px,300px)]">
        {/* ── Esquerda: times e jogadores ── */}
        <div className="min-w-0">
          {/* Grade de times — 4 colunas fixas */}
          <div className="panel mb-3 p-2">
            <div className="grid grid-cols-4 gap-1">
              {sortedTeams.map(({ t, i }) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setActiveTab(i); setPlayerSearch(''); }}
                  title={t.name}
                  className={`rounded-lg border py-1.5 text-center text-xs font-bold tracking-wide transition-colors ${
                    i === activeTab
                      ? 'border-[var(--green)] bg-[var(--green)] text-white'
                      : 'border-[var(--border2)] bg-transparent text-[var(--text2)] hover:border-[var(--green-light)] hover:text-[var(--text)]'
                  }`}
                >
                  {t.short}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de jogadores */}
          <div className="panel max-h-[55vh] overflow-y-auto sm:max-h-[460px]">
            {/* Cabeçalho do time */}
            <div className="mb-3 flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
              <TeamLogo logo={team.logo} fallback={team.c} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-condensed text-base font-extrabold uppercase text-[var(--text)]">
                  {team.name}
                </div>
                <div className={`text-xs font-semibold ${full ? 'text-[var(--red)]' : 'text-[var(--text3)]'}`}>
                  {used}/3 jogadores selecionados
                </div>
              </div>
              {/* Barra de uso */}
              <div className="flex gap-0.5">
                {[0, 1, 2].map((n) => (
                  <div
                    key={n}
                    className={`h-2 w-2 rounded-full ${
                      n < used
                        ? full ? 'bg-[var(--red)]' : 'bg-[var(--green-light)]'
                        : 'bg-[var(--border2)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Busca de jogadores */}
            <div className="mb-3">
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Buscar jogador…"
                className="w-full rounded-lg border border-[var(--border2)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--green-light)]"
              />
            </div>

            {(['GK', 'DF', 'MF', 'FW'] as Position[]).map((pos) => {
              const filtered = byPos[pos].filter((p) =>
                p.n.toLowerCase().includes(playerSearch.toLowerCase())
              );
              if (!filtered.length) return null;
              return (
                <div key={pos} className="mb-3 last:mb-0">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={`pl-pbadge pos-${pos} text-[9px] font-bold`}>{pos}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                      {POS_LABELS[pos]}
                    </span>
                  </div>
                  {filtered.map((p) => {
                    const inLU = lineup.some(
                      (s) => s.player?.n === p.n && s.player?.tid === team.id
                    );
                    const inBench = bench.some((b) => b?.n === p.n && b?.tid === team.id);
                    const dis = isContinuing || (!inLU && !inBench && full);
                    return (
                      <div
                        key={p.n}
                        role={isContinuing ? undefined : 'button'}
                        tabIndex={dis ? -1 : 0}
                        onClick={() => !dis && togglePlayer(team.id, p.n, pos)}
                        onKeyDown={(e) =>
                          !dis && e.key === 'Enter' && togglePlayer(team.id, p.n, pos)
                        }
                        className={`player-row ${inLU || inBench ? 'player-row-selected' : ''} ${dis ? 'player-row-disabled' : ''}`}
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
                        <span className="flex-1 truncate text-sm text-[var(--text)]">{p.n}</span>
                        {inBench && !inLU && (
                          <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase text-[var(--text3)] ring-1 ring-[var(--border2)]">
                            RES
                          </span>
                        )}
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
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

        {/* ── Centro: campinho grande ── */}
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3">
          <div className="panel">
            <div className="panel-title">Clique em uma posição para escalar</div>
            <PitchBuilder
              lineup={lineup}
              onSlotClick={setPickerIdx}
              size="large"
              bench={bench}
              onBenchClick={setBenchPickerIdx}
            />
          </div>

        </div>

        {/* ── Direita: configurações ── */}
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3">
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
                  <span className="text-xs text-[var(--text3)]">{s.desc}</span>
                </button>
              ))}
            </div>
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
          slotIdx={isContinuing ? benchPickerIdx : -1}
          lineup={lineup}
          teamUsage={combinedUsage}
          benchMode={!isContinuing}
          swapMode={isContinuing}
          bench={bench}
          onPick={isContinuing ? pickBenchContinuing : pickBenchPlayer}
          onRemove={() => isContinuing ? setBenchPickerIdx(null) : removeBenchSlot(benchPickerIdx)}
          onClose={() => setBenchPickerIdx(null)}
        />
      )}
    </>
  );
}
